const crypto = require('crypto');
const retryStore=require('./whatsapp-retry-store');
const {buildWhatsAppContent}=require('./whatsapp-content');
const { all, get, run } = require('./db');
const QRCode = require('qrcode');
const pino = require('pino');
const {ensureTrackingSchema,attachTracking}=require('./whatsappTracking');
const sessions = new Map();
let libraryPromise;
let schemaPromise;
let stopping = false;
const MAX_SESSIONS = Number(process.env.WHATSAPP_MAX_SESSIONS || 10);

function library() {
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
    if(entry.cancelled) return;
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
  return {status:entry?.status||'disconnected',qr:entry?.qr||null,phone:entry?.phone||null,error:entry?.error||null};
}
async function openSocket(userId,entry) {
  const lib=await library();
  if(entry.cancelled || stopping) return;
  const auth=await authState(userId,lib,entry);
  if(entry.cancelled || stopping) return;
  entry.deviceCache=retryStore.deviceCache();
  const sock=lib.default({auth:auth.state,logger:pino({level:'silent'}),userDevicesCache:entry.deviceCache,
    printQRInTerminal:false,markOnlineOnConnect:false,syncFullHistory:false,
    shouldSyncHistoryMessage:()=>false,connectTimeoutMs:30000,
    maxMsgRetryCount:5,
    getMessage:async key=>{try{return await retryStore.getMessage(userId,key,lib.proto);}catch(error){console.warn('WhatsApp retry lookup failed:',error.code||'STORE_ERROR');return undefined;}}});
  entry.sock=sock;
  attachTracking(sock,userId,entry);
  sock.ev.on('creds.update',()=>{auth.saveCreds().catch(()=>{
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
      entry.notifiedDisconnect=false;entry.status='connected';entry.qr=null;entry.rawQr=null;entry.error=null;entry.retries=0;
      entry.phone=String(sock.user?.id||'').split(':')[0].split('@')[0];
    }
    if(update.connection==='close') {
      entry.qr=null;entry.phone=null;
      const code=update.lastDisconnect?.error?.output?.statusCode;
      const terminal=[lib.DisconnectReason.loggedOut,lib.DisconnectReason.badSession,lib.DisconnectReason.connectionReplaced,lib.DisconnectReason.multideviceMismatch].includes(code);
      if(terminal || entry.retries>=5) {
        require('./notifications').whatsappDisconnected(userId,entry);
        entry.status='disconnected';entry.error=terminal?'انتهى الاتصال. افصل الربط ثم اربط واتساب من جديد.':'تعذر الاتصال. جرّب الربط من جديد.';
        return;
      }
      entry.status='connecting';entry.retries++;
      entry.timer=setTimeout(()=>{
        entry.pending=openSocket(userId,entry).catch(()=>{entry.status='disconnected';entry.error='تعذر إعادة الاتصال بواتساب';require('./notifications').whatsappDisconnected(userId,entry);});
      },Math.min(1000*2**entry.retries,30000));
    }
  });
}
async function connect(userId) {
  secretKey();await ensureSchema();
  if(stopping) throw new Error('التطبيق يعيد التشغيل');
  let entry=sessions.get(userId);
  if(entry && ['connected','connecting','qr'].includes(entry.status)) return status(userId);
  if(entry) await disconnect(userId,false);
  if(sessions.size>=MAX_SESSIONS) throw new Error('وصل السيرفر لعدد جلسات واتساب المتاحة');
  entry={status:'connecting',qr:null,phone:null,error:null,retries:0,cancelled:false,writes:Promise.resolve(),sendQueue:Promise.resolve()};
  sessions.set(userId,entry);
  entry.pending=openSocket(userId,entry);
  try {await entry.pending;} catch(err) {
    entry.status='disconnected';entry.error='تعذر بدء جلسة واتساب. راجع لوج التطبيق.';
    console.error('WhatsApp start failed:',err.code||err.name);
    throw new Error(entry.error);
  }
  return status(userId);
}
async function disconnect(userId,forget=true) {
  const entry=sessions.get(userId);
  if(entry) {
    entry.cancelled=true;clearTimeout(entry.timer);
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
  if(entry?.status!=='connected') throw new Error('اربط واتساب من صفحة الإعدادات وانتظر ظهور متصل');
  return entry;
}
async function sendWhatsAppMessage(userId,phone,body,attachment) {
  if(typeof body!=='string' || !body.trim()) throw new Error('نص رسالة واتساب مطلوب');
  const number=String(phone||'').replace(/^00/,'').replace(/\D/g,'');
  if(!/^[1-9]\d{7,14}$/.test(number)) throw new Error('رقم واتساب لازم يحتوي على كود الدولة');
  const content=buildWhatsAppContent(body,attachment);
  const entry=await requireConnected(userId);
  const work=entry.sendQueue.then(async()=>{
    if(entry.cancelled || entry.status!=='connected') throw new Error('واتساب غير متصل');
    const results=await entry.sock.onWhatsApp(number);
    const target=results?.find(x=>x.exists);
    if(!target) throw new Error('الرقم غير مسجل على واتساب');
    // إرسال الـCV والنص في رسالة واحدة لتجنب نجاح النص وفشل المرفق.
    const lib=await library();
    // Build and persist the complete encrypted-message payload before relaying it.
    // A recipient device can then request the same message ID for re-encryption.
    const result=await lib.generateWAMessage(target.jid,content,{userJid:entry.sock.user.id,upload:entry.sock.waUploadToServer,logger:pino({level:'silent'})});
    await retryStore.saveMessage(userId,result,lib.proto);
    entry.deviceCache?.flushAll();
    await entry.sock.relayMessage(target.jid,result.message,{messageId:result.key.id,useUserDevicesCache:false});
    return {messageId:result?.key?.id||null,threadId:result?.key?.remoteJid||target.jid};
  });
  entry.sendQueue=work.catch(()=>{});
  return work;
}
async function restoreSessions() {
  await ensureSchema();
  if(!process.env.WHATSAPP_AUTH_SECRET) return;
  secretKey();
  const rows=await all("SELECT user_id FROM whatsapp_auth WHERE key_id='creds' LIMIT $1",[MAX_SESSIONS]);
  for(const row of rows) await connect(row.user_id).catch(()=>{});
}
async function shutdown() {
  stopping=true;
  for(const id of [...sessions.keys()]) await disconnect(id,false);
}
module.exports={connect,disconnect,status,requireConnected,sendWhatsAppMessage,restoreSessions,shutdown};
