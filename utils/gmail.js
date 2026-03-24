// utils/gmail.js — Gmail OAuth & send helpers
const { google } = require('googleapis');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl() {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
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
    expiry_date: user.token_expiry
  });
  return oauth2Client;
}

// Build RFC 2822 MIME message
// Build RFC 2822 MIME message with optional attachment
function buildMimeMessage({ from, to, subject, body, trackingPixelUrl, attachment }) {
  const boundary = `__mrsaal_boundary_${Date.now()}__`;
  const trackingPixel = trackingPixelUrl
    ? `<br><div style="display:none"><img src="${trackingPixelUrl}" width="1" height="1" border="0" alt=""></div>`
    : '';

  const htmlBody = `<html><body style="font-family: sans-serif; line-height: 1.5; color: #333;">
    ${body.replace(/\n/g, '<br>')}
    ${trackingPixel}
  </body></html>`;

  let message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody).toString('base64'),
    ''
  ];

  if (attachment && attachment.data) {
    message.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType || 'application/pdf'}; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      attachment.data.toString('base64'),
      ''
    );
  }

  message.push(`--${boundary}--`);

  return Buffer.from(message.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendEmail({ user, to, subject, body, trackingPixelUrl, attachment }) {
  const auth = buildAuthClient(user);
  const gmail = google.gmail({ version: 'v1', auth });

  // Get sender profile
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const from = profile.data.emailAddress;

  const raw = buildMimeMessage({ from, to, subject, body, trackingPixelUrl, attachment });

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw }
  });

  return { 
    messageId: result.data.id, 
    threadId: result.data.threadId,
    from 
  };
}

module.exports = { getAuthUrl, getTokensFromCode, getUserInfo, sendEmail, buildAuthClient };
