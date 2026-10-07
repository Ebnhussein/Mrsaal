// utils/gmail.js — Gmail OAuth & send helpers
const { google } = require('googleapis');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    state,
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
  });
}

async function getTokensFromCode(code) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function getUserInfo(accessToken) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data;
}

function buildAuthClient(user) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: user.access_token,
    refresh_token: user.refresh_token,
    expiry_date: Number(user.expiry_date || user.token_expiry) || undefined
  });
  if(user.gmail_account_id) oauth2Client.on('tokens',tokens=>require('./gmail-accounts').persistTokens(user,tokens).catch(()=>console.error('Gmail token persistence failed')));
  return oauth2Client;
}

// Standards-compliant MIME: plain text, HTML alternative and exact original PDF.
function buildMimeMessage({ from, to, subject, body, trackingPixelUrl, attachment }) {
  const {randomUUID}=require('crypto');
  for(const address of [from,to]) if(typeof address!=='string'||! /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) throw new Error('عنوان البريد غير صالح');
  if(/[\r\n]/.test(String(subject)))throw new Error('موضوع البريد غير صالح');
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold=data=>Buffer.from(data).toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
  const mixed='mixed_'+randomUUID(), alternative='alt_'+randomUUID();
  const text=String(body||'').replace(/\r\n?/g,'\n');
  const direction=/[\u0600-\u06ff]/.test(text)?'rtl':'ltr';
  let pixel='';
  if(trackingPixelUrl){const url=new URL(trackingPixelUrl);if(!['https:','http:'].includes(url.protocol))throw new Error('رابط التتبع غير صالح');pixel=`<img src="${escape(url.href)}" width="1" height="1" alt="" style="width:1px;height:1px;border:0">`;}
  // Keep the submitted plain text intact. Only the HTML presentation gains paragraphs.
  let paragraphs=text.split(/\n[ \t]*\n/);
  if(paragraphs.length===1&&!text.includes('\n')&&text.length>280){
    const sentences=text.split(/(?<=[.!?؟])\s+(?=[\p{L}])/u);
    const grouped=[];let current='';
    for(const sentence of sentences){if(current.length>180){grouped.push(current);current='';}current+=(current?' ':'')+sentence;}
    if(current)grouped.push(current);paragraphs=grouped;
  }
  const content=paragraphs.map(x=>'<p dir="'+direction+'" style="margin:0 0 20px;line-height:1.9;overflow-wrap:break-word">'+escape(x).replace(/\n/g,'<br>')+'</p>').join('');
  const html=`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body dir="${direction}" style="margin:0;padding:20px 8px;background:#ffffff;color:#202124"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;margin:0 auto"><tr><td dir="${direction}" style="padding:4px 12px;font-family:Arial,Tahoma,sans-serif;font-size:16px;line-height:1.9;text-align:${direction==='rtl'?'right':'left'}">${content}${pixel}</td></tr></table></body></html>`;
  // Split encoded words so Arabic subjects also stay within MIME header limits.
  const words=Array.from(String(subject||''));const encoded=[];
  while(words.length)encoded.push('=?UTF-8?B?'+Buffer.from(words.splice(0,12).join('')).toString('base64')+'?=');
  const message=[`From: ${from}`,`To: ${to}`,`Subject: ${encoded.join('\r\n ')}`,`Date: ${new Date().toUTCString()}`,`Message-ID: <${randomUUID()}@${from.split('@')[1]}>`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${mixed}"`,'',`--${mixed}`,`Content-Type: multipart/alternative; boundary="${alternative}"`,''];
  for(const [type,value]of [['text/plain',text],['text/html',html]])message.push(`--${alternative}`,`Content-Type: ${type}; charset=utf-8`,'Content-Transfer-Encoding: base64','',fold(value),'');
  message.push(`--${alternative}--`,'');
  if(attachment){
    const bytes=attachment.data;
    if(!Buffer.isBuffer(bytes)||!bytes.length)throw new Error('ملف السيرة الذاتية غير صالح. أعد رفع PDF.');
    const filename=String(attachment.filename||'CV.pdf').replace(/[\r\n\x00-\x1f]/g,'').slice(0,150);
    message.push(`--${mixed}`,`Content-Type: application/pdf; name="=?UTF-8?B?${Buffer.from(filename).toString('base64')}?="`,'Content-Disposition: attachment;',` filename*=UTF-8\'\'${encodeURIComponent(filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,'Content-Transfer-Encoding: base64','',fold(bytes),'');
  }
  message.push(`--${mixed}--`,'');
  return Buffer.from(message.join('\r\n')).toString('base64url');
}

async function sendEmailRequest({ user, account = null, logId = null, to, subject, body, trackingPixelUrl, attachment }) {
  const {resolveAccount}=require('./gmail-accounts');
  account = account || await resolveAccount(user.id);
  const auth = buildAuthClient(account);
  const gmail = google.gmail({ version: 'v1', auth });

  // Get sender profile
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const from = profile.data.emailAddress;

  const raw = buildMimeMessage({ from, to, subject, body, trackingPixelUrl, attachment });

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw }
  });

  if(logId) await require('./db').run('UPDATE email_log SET sender_account_id=$1,sender_email=$2 WHERE id=$3 AND user_id=$4',[account.gmail_account_id,from,logId,user.id]);
  return { 
    senderAccountId: account.gmail_account_id,
    messageId: result.data.id, 
    threadId: result.data.threadId,
    from 
  };
}

async function sendEmail(args){try{return await sendEmailRequest(args);}catch(error){throw require('./gmail-errors').gmailError(error);}}

module.exports = { getAuthUrl, getTokensFromCode, getUserInfo, sendEmail, buildAuthClient, buildMimeMessage };
