// utils/whatsapp.js — WhatsApp client via whatsapp-web.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Ensure auth folder exists
fs.mkdirSync(path.join(__dirname, '..', 'data', 'wwebjs_auth'), { recursive: true });

let client = null;
let status = 'disconnected'; // disconnected | qr_ready | connecting | ready | failed
let currentQR = null; // base64 QR image

function initWhatsApp() {
  if (client) return; // already initialised

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '..', 'data', 'wwebjs_auth')
    }),
    puppeteer: {
      headless: true,
      timeout: 0,
      protocolTimeout: 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-accelerated-2d-canvas',
        '--disable-site-isolation-trials',
        '--disable-features=IsolateOrigins,site-per-process',
        '--js-flags="--max-old-space-size=250"'
      ]
    }
  });

  client.on('qr', async (qr) => {
    status = 'qr_ready';
    currentQR = null;
    try {
      currentQR = await qrcode.toDataURL(qr);
    } catch (e) {
      console.error('QR generation error:', e.message);
    }
    console.log('📱 WhatsApp: QR code ready — scan from the app');
  });

  client.on('loading_screen', () => {
    status = 'connecting';
    currentQR = null;
    console.log('⏳ WhatsApp: loading...');
  });

  client.on('authenticated', () => {
    status = 'connecting';
    currentQR = null;
    console.log('✅ WhatsApp: authenticated');
  });

  client.on('ready', () => {
    status = 'ready';
    currentQR = null;
    console.log('✅ WhatsApp: ready to send messages');
  });

  client.on('disconnected', (reason) => {
    status = 'disconnected';
    currentQR = null;
    client = null;
    console.log('❌ WhatsApp disconnected:', reason);
  });

  client.on('auth_failure', (msg) => {
    status = 'failed';
    currentQR = null;
    client = null;
    console.error('❌ WhatsApp auth failure:', msg);
  });

  status = 'connecting';
  client.initialize().catch((err) => {
    status = 'failed';
    client = null;
    console.error('❌ WhatsApp init error:', err.message);
  });
}

function getWhatsAppStatus() {
  return { status, hasQR: !!currentQR };
}

function getQR() {
  return currentQR;
}

/**
 * Send a WhatsApp message to a phone number.
 * @param {string} phone - international format e.g. 201012345678 (no + or spaces)
 * @param {string} text  - message body
 */
async function sendWhatsAppMessage(phone, text) {
  if (status !== 'ready' || !client) {
    throw new Error('واتساب غير متصل. امسح الـ QR أولاً من إعدادات التطبيق.');
  }

  // Normalise number — remove non-digits, strip leading +
  const normalised = String(phone).replace(/\D/g, '');
  const chatId = `${normalised}@c.us`;

  await client.sendMessage(chatId, text);
  return { chatId };
}

async function logoutWhatsApp() {
  if (client) {
    try { await client.logout(); } catch (_) {}
    try { await client.destroy(); } catch (_) {}
    client = null;
  }
  status = 'disconnected';
  currentQR = null;
}

module.exports = { initWhatsApp, getWhatsAppStatus, getQR, sendWhatsAppMessage, logoutWhatsApp };
