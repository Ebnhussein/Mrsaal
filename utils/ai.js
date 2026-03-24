// utils/ai.js — Claude API integration
const https = require('https');

async function callClaude(prompt, maxTokens = 1200) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed.content?.map(b => b.text || '').join('') || '';
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateEmail({ cv, company, instructions, subjectTemplate }) {
  const prompt = `أنت متخصص في كتابة إيميلات تقديم وظيفي احترافية.

===== السيرة الذاتية =====
${cv}
=========================

===== الشركة المستهدفة =====
الاسم: ${company.name}
البريد: ${company.email}
المجال: ${company.field || 'غير محدد'}
الموقع: ${company.location || 'غير محدد'}
===========================

===== تعليمات الأسلوب =====
${instructions || 'اكتب إيميل تقديم احترافي ومختصر يبرز أهم المهارات ذات الصلة بمجال الشركة.'}
===========================

${subjectTemplate ? `قالب الموضوع المقترح: ${subjectTemplate}` : ''}

اكتب الإيميل الآن. أعطني النتيجة **بهذا التنسيق الحرفي بالضبط** وبدون أي نص إضافي:
SUBJECT: [الموضوع]
BODY:
[نص الإيميل كامل]`;

  const text = await callClaude(prompt);

  const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);

  return {
    subject: subjectMatch ? subjectMatch[1].trim() : `طلب انضمام إلى ${company.name}`,
    body: bodyMatch ? bodyMatch[1].trim() : text.trim()
  };
}

async function generateWhatsAppMessage({ cv, company, instructions }) {
  const prompt = `أنت متخصص في كتابة رسائل تقديم وظيفي احترافية ومختصرة لتُرسل عبر واتساب.

===== السيرة الذاتية =====
${cv}
=========================

===== الشركة المستهدفة =====
الاسم: ${company.name}
المجال: ${company.field || 'غير محدد'}
الموقع: ${company.location || 'غير محدد'}
===========================

===== تعليمات =====
${instructions || 'اكتب رسالة واتساب مختصرة واحترافية (3-5 أسطر فقط) تبرز أهم المهارات ذات الصلة بمجال الشركة. لا تستخدم تنسيق HTML. استخدم إيموجي مناسب بشكل خفيف.'}
====================

اكتب الرسالة الآن مباشرة بدون أي مقدمات أو تفسيرات.`;

  const text = await callClaude(prompt, 600);
  return text.trim();
}

module.exports = { generateEmail, generateWhatsAppMessage, callClaude };
