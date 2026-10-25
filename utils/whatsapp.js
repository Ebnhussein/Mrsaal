const crypto = require('crypto');
const retryStore=require('./whatsapp-retry-store');
const policy=require('./whatsapp-policy');
const {buildWhatsAppContent}=require('./whatsapp-content');
const { all, get, run } = require('./db');
const QRCode = require('qrcode');
const pino = require('pino');
const {ensureTrackingSchema,attachTracking}=require('./whatsapp-tracking');
const sessions = new Map();
let libraryPromise;
let schemaPromise;
let stopping = false;
const configuredMax=Number(process.env.WHATSAPP_MAX_SESSIONS);
const MAX_SESSIONS=Number.isInteger(configuredMax)&&configuredMax>=1&&configuredMax<=100?configuredMax:10;
function occupied(){return [...sessions.values()].filter(e=>e.status!=='disconnected').length;}
function capacity(){return {capacity:MAX_SESSIONS,availableSlots:Math.max(0,MAX_SESSIONS-occupied())};}
function cleanDisconnected(userId,entry){clearTimeout(entry.cleanup);entry.cleanup=setTimeout(()=>{if(sessions.get(userId)===entry&&entry.status==='disconnected')disconnect(userId,false).catch(()=>{});},60000);entry.cleanup.unref?.();}

function library() {
  if(libraryPromise)return libraryPromise;
  require('./safe-signal').install();
  return libraryPromise ||= import('@whiskeysockets/baileys').then(mod => {
    const base = typeof mod.default === 'object' ? mod.default : {};
    return {...base, ...mod, default: typeof mod.default === 'function' ? mod.default : base.default};
  });
}
function secretKey() {
  const secret = process.env.WHATSAPP_AUTH_SECRET;
  if(!secret || secret.length < 32) throw new Error('أضف WHATSAPP_AUTH_SECRET عشوائيًا بطول 32 حرفًا على الأقل');
  return crypto.createHash('sha256').update(secret).digest();
}
function seal(value, BufferJSON) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value, BufferJSON.replacer),'utf8'),cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
function unseal(value, BufferJSON) {
  const data = Buffer.from(value,'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm',secretKey(),data.subarray(0,12));
  decipher.setAuthTag(data.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8'),BufferJSON.reviver);
}
function ensureSchema() {
  return schemaPromise ||= (async()=>{
    await ensureTrackingSchema();
    await retryStore.ensureRetrySchema();
    return run(`CREATE TABLE IF NOT EXISTS whatsapp_auth (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id TEXT NOT NULL, encrypted_value TEXT NOT NULL,
    PRIMARY KEY(user_id,key_id)
  )`);
  })().catch(err=>{schemaPromise=null;throw err;});
}
async function authState(userId, lib, entry) {
  const read = async key => {
    const row = await get('SELECT encrypted_value FROM whatsapp_auth WHERE user_id=$1 AND key_id=$2',[userId,key]);
    return row ? unseal(row.encrypted_value,lib.BufferJSON) : null;
  };
  const write = async (key,value) => {
    if(entry.cancelled&&entry.forget) return;
    if(value == null) await run('DELETE FROM whatsapp_auth WHERE user_id=$1 AND key_id=$2',[userId,key]);
    else await run(`INSERT INTO whatsapp_auth(user_id,key_id,encrypted_value) VALUES($1,$2,$3)
      ON CONFLICT(user_id,key_id) DO UPDATE SET encrypted_value=EXCLUDED.encrypted_value`,[userId,key,seal(value,lib.BufferJSON)]);
  };
  const creds = await read('creds') || lib.initAuthCreds();
  return {
    state:{creds,keys:{
      get:async(type,ids)=>{
        const result={};
        for(const id of ids) {
          let value=await read(`${type}-${id}`);
          if(type==='app-state-sync-key' && value) value=lib.proto.Message.AppStateSyncKeyData.fromObject(value);
          result[id]=value;
        }
        return result;
      },
      set:async data=>{
        const work=entry.writes.then(async()=>{
          for(const type of Object.keys(data)) for(const id of Object.keys(data[type])) await write(`${type}-${id}`,data[type][id]);
        });
        entry.writes=work.catch(()=>{});
        await work;
      }
    }},
    saveCreds:()=>{
      const work=entry.writes.then(()=>write('creds',creds));
      entry.writes=work.catch(()=>{});
      return work;
    }
  };
}
function status(userId) {
  const entry=sessions.get(userId);
  return {status:entry?.status||'disconnected',qr:entry?.qr||null,phone:entry?.phone||null,error:entry?.error||null,provider:'baileys',retryAttempt:entry?.retries||0,nextRetryAt:entry?.nextRetryAt||null,lastDisconnectCode:entry?.lastDisconnectCode||null};
}
async function openSocket(userId,entry) {
  const lib=await library();
  if(entry.cancelled || stopping) return;
  const generation=(entry.generation||0)+1;entry.generation=generation;
  const previous=entry.sock;entry.sock=null;previous?.end(new Error('Reconnecting'));
  await entry.writes;
  if(entry.cancelled||stopping||entry.generation!==generation)return;
  const auth=await authState(userId,lib,entry);
  if(entry.cancelled || stopping) return;
  entry.deviceCache=retryStore.deviceCache();
  const sock=lib.default({auth:auth.state,logger:pino({level:'silent'}),userDevicesCache:entry.deviceCache,
    printQRInTerminal:false,markOnlineOnConnect:false,syncFullHistory:false,
    shouldSyncHistoryMessage:()=>false,connectTimeoutMs:30000,defaultQueryTimeoutMs:20000,keepAliveIntervalMs:25000,
    maxMsgRetryCount:5,
    getMessage:async key=>{try{return await retryStore.getMessage(userId,key,lib.proto);}catch(error){console.warn('WhatsApp retry lookup failed:',error.code||'STORE_ERROR');return undefined;}}});
  entry.sock=sock;let closed=false;
  attachTracking(sock,userId,entry);
  sock.ev.on('creds.update',()=>{if(entry.cancelled||entry.sock!==sock)return;auth.saveCreds().catch(()=>{
    entry.error='تعذر حفظ جلسة واتساب';console.error('WhatsApp credential save failed');
  });});
  sock.ev.on('connection.update',update=>{
    if(entry.cancelled || entry.sock!==sock || stopping) return;
    if(update.qr) {
      entry.status='qr';entry.qr=null;
      const current=update.qr;entry.rawQr=current;
      QRCode.toDataURL(current,{width:280,margin:2}).then(qr=>{
        if(!entry.cancelled && entry.sock===sock && entry.rawQr===current) entry.qr=qr;
      }).catch(()=>{entry.error='تعذر عرض رمز QR';});
    }
    if(update.connection==='open') {
      entry.notifiedDisconnect=false;entry.status='connected';entry.qr=null;entry.rawQr=null;entry.error=null;entry.connectedAt=Date.now();entry.nextRetryAt=null;clearTimeout(entry.timer);clearTimeout(entry.cleanup);
      entry.phone=String(sock.user?.id||'').split(':')[0].split('@')[0];
    }
    if(update.connection==='close') {
      if(closed)return;closed=true;clearTimeout(entry.timer);entry.nextRetryAt=null;
      if(entry.connectedAt&&Date.now()-entry.connectedAt>=60000)entry.retries=0;entry.connectedAt=null;
      entry.qr=null;entry.rawQr=null;entry.phone=null;
      const code=Number(update.lastDisconnect?.error?.output?.statusCode);entry.lastDisconnectCode=Number.isInteger(code)?code:null;
      console.info('WhatsApp connection closed:',JSON.stringify({code:entry.lastDisconnectCode,attempt:entry.retries}));
      const terminal=Number.isInteger(code)&&[lib.DisconnectReason.loggedOut,lib.DisconnectReason.badSession,lib.DisconnectReason.connectionReplaced,lib.DisconnectReason.multideviceMismatch].filter(Number.isInteger).includes(code);
      if(terminal || entry.retries>=5) {
        require('./notifications').whatsappDisconnected(userId,entry);
        entry.status='disconnected';cleanDisconnected(userId,entry);entry.error=terminal?'انتهى الاتصال. افصل الربط ثم اربط واتساب من جديد.':'تعذر الاتصال. جرّب الربط من جديد.';
        return;
      }
      entry.status='connecting';entry.retries++;
      const delay=policy.reconnectDelay(entry.retries);entry.nextRetryAt=Date.now()+delay;
      entry.timer=setTimeout(()=>{
        entry.pending=openSocket(userId,entry).catch(()=>{if(entry.cancelled||stopping)return;entry.status='disconnected';cleanDisconnected(userId,entry);entry.error='تعذر إعادة الاتصال بواتساب';require('./notifications').whatsappDisconnected(userId,entry);});
      },delay);entry.timer.unref?.();
    }
  });
}
async function connect(userId) {
  secretKey();await ensureSchema();
  if(stopping) throw new Error('التطبيق يعيد التشغيل');
  let entry=sessions.get(userId);
  if(entry && ['connected','connecting','qr'].includes(entry.status)) return status(userId);
  if(entry) await disconnect(userId,false);
  if(occupied()>=MAX_SESSIONS) throw new Error('وصل السيرفر لعدد جلسات واتساب المتاحة');
  entry={status:'connecting',qr:null,phone:null,error:null,retries:0,cancelled:false,writes:Promise.resolve(),sendQueue:Promise.resolve()};
  sessions.set(userId,entry);
  entry.pending=openSocket(userId,entry);
  try {await entry.pending;} catch(err) {
    entry.status='disconnected';cleanDisconnected(userId,entry);entry.error='تعذر بدء جلسة واتساب. راجع لوج التطبيق.';
    console.error('WhatsApp start failed:',err.code||err.name);
    throw new Error(entry.error);
  }
  return status(userId);
}
async function disconnect(userId,forget=true) {
  const entry=sessions.get(userId);
  if(entry) {
    entry.forget=forget;entry.cancelled=true;clearTimeout(entry.timer);clearTimeout(entry.cleanup);
    await entry.pending?.catch(()=>{});
    if(forget && entry.sock) await entry.sock.logout().catch(()=>{});
    entry.sock?.end(new Error('Session closed'));
    await entry.writes.catch(()=>{});
    sessions.delete(userId);
  }
  if(forget) {
    await ensureSchema();
    await run('DELETE FROM whatsapp_sent_messages WHERE user_id=$1',[userId]);
    await run('DELETE FROM whatsapp_auth WHERE user_id=$1',[userId]);
  }
}
async function requireConnected(userId) {
  let entry=sessions.get(userId);
  if(!entry) {await connect(userId);entry=sessions.get(userId);}
  const deadline=Date.now()+20000;
  while(entry?.status==='connecting' && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,250));
  if(entry?.status!=='connected') throw policy.error('WA_NOT_CONNECTED');
  return entry;
}
async function sendWhatsAppMessage(userId,phone,body,attachment) {
  if(typeof body!=='string' || !body.trim()) throw Object.assign(new Error('نص رسالة واتساب مطلوب'),{status:400,beforeSend:true});
  const number=String(phone||'').replace(/^00/,'').replace(/\D/g,'');
  if(!/^[1-9]\d{7,14}$/.test(number)) throw policy.error('WA_RECIPIENT_FORMAT',400);
  let content;try{content=buildWhatsAppContent(body,attachment);}catch(e){e.status=400;e.beforeSend=true;throw e;}
  let entry;try{entry=await requireConnected(userId);}catch(e){e.beforeSend=true;throw e;}
  const work=entry.sendQueue.then(async()=>{
    const sock=entry.sock;policy.active(entry,sock);
    const results=await policy.lookup(sock,number);policy.active(entry,sock);
    if(!Array.isArray(results)||!results.length)throw policy.error('WA_LOOKUP_FAILED',503);
    const target=results.find(x=>x.exists);
    if(!target)throw policy.error('WA_NUMBER_INVALID',400);
    // Persist the exact payload before one relay; never replay a send after a lost acknowledgement.
    const lib=await library();policy.active(entry,sock);let result;
    try{
      result=await lib.generateWAMessage(target.jid,content,{userJid:sock.user.id,upload:sock.waUploadToServer,logger:pino({level:'silent'})});
      policy.active(entry,sock);
      await retryStore.saveMessage(userId,result,lib.proto);
      policy.active(entry,sock);
    }catch(error){if(error.beforeSend)throw error;throw policy.error('WA_PREPARE_FAILED',503);}
    entry.deviceCache?.flushAll();
    try{await sock.relayMessage(target.jid,result.message,{messageId:result.key.id,useUserDevicesCache:false});}
    catch(error){throw policy.error('WA_SEND_UNCERTAIN',502);}
    return {messageId:result?.key?.id||null,threadId:result?.key?.remoteJid||target.jid};
  });
  entry.sendQueue=work.catch(()=>{});
  return work;
}
async function restoreSessions() {
  await ensureSchema();
  if(!process.env.WHATSAPP_AUTH_SECRET) return;
  secretKey();
  const rows=await all("SELECT a.user_id FROM whatsapp_auth a WHERE a.key_id='creds' AND NOT EXISTS(SELECT 1 FROM whatsapp_preferences p WHERE p.user_id=a.user_id AND p.provider='mrsaalwa') LIMIT $1",[MAX_SESSIONS]);
  for(const row of rows) await connect(row.user_id).catch(()=>{});
}
async function shutdown() {
  stopping=true;
  for(const id of [...sessions.keys()]) await disconnect(id,false);
}
module.exports={capacity,connect,disconnect,status,requireConnected,sendWhatsAppMessage,restoreSessions,shutdown};
