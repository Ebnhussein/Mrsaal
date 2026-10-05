'use strict';
const crypto=require('crypto');
function key(){const value=process.env.CONNECTIONS_SECRET||process.env.SESSION_SECRET;if(!value)throw new Error('SESSION_SECRET is required');return crypto.createHash('sha256').update('mrsaal-connections-v1:'+value).digest();}
function seal(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),bytes].map(v=>v.toString('base64')).join('.');}
function unseal(value){const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v,'base64'));const cipher=crypto.createDecipheriv('aes-256-gcm',key(),iv);cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8'));}
module.exports={seal,unseal};
