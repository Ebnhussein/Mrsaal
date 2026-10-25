'use strict';
const crypto=require('crypto');
// Newest secret first. seal() always uses the first; unseal() also tries the rest, so adding
// CONNECTIONS_SECRET or rotating it (old value -> CONNECTIONS_SECRET_PREVIOUS, comma-separated) never strands saved data.
function secrets(){const list=[process.env.CONNECTIONS_SECRET,process.env.SESSION_SECRET,...String(process.env.CONNECTIONS_SECRET_PREVIOUS||'').split(',')].map(v=>String(v||'').trim()).filter(Boolean);if(!list.length)throw new Error('SESSION_SECRET is required');return [...new Set(list)];}
function derive(value){return crypto.createHash('sha256').update('mrsaal-connections-v1:'+value).digest();}
function seal(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',derive(secrets()[0]),iv);const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),bytes].map(v=>v.toString('base64')).join('.');}
function unseal(value){const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v,'base64'));let failure;for(const secret of secrets()){try{const cipher=crypto.createDecipheriv('aes-256-gcm',derive(secret),iv);cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8'));}catch(error){failure=error;}}throw failure;}
module.exports={seal,unseal};
