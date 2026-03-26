const { GoogleGenerativeAI } = require('@google/genai');

function getAI(apiKey) {
  return new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
}

async function callGemini(prompt, maxTokens = 1200, apiKey = null, modelName = 'gemini-1.5-flash') {
  try {
    const ai = getAI(apiKey);
    const model = ai.getGenerativeModel({ model: modelName || 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error('لم يتم استلام نص من Gemini');
    return text;
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429')) {
      throw new Error('تم استهلاك الحد الأقصى المجاني. يرجى الانتظار دقيقة والمحاولة مرة أخرى.');
    }
    throw new Error('مشكلة في الذكاء الاصطناعي: ' + error.message);
  }
}

async function generateEmail({ cv, company, instructions, subjectTemplate, apiKey, modelName }) {
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

اكتب الإيميل الآن بهذا التنسيق الحرفي بالضبط وبدون أي نص إضافي:
SUBJECT: [الموضوع]
BODY:
[نص الإيميل كامل]`;

  const text = await callGemini(prompt, 1200, apiKey, modelName);
  const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);
  return {
    subject: subjectMatch ? subjectMatch[1].trim() : `طلب انضمام إلى ${company.name}`,
    body: bodyMatch ? bodyMatch[1].trim() : text.trim()
  };
}

async function generateWhatsAppMessage({ cv, company, instructions, apiKey, modelName }) {
  const prompt = `أنت متخصص في كتابة رسائل تقديم وظيفي للواتساب.

===== السيرة الذاتية =====
${cv}
=========================

===== الشركة المستهدفة =====
الاسم: ${company.name}
المجال: ${company.field || 'غير محدد'}
===========================

===== تعليمات =====
${instructions || 'اكتب رسالة واتساب مختصرة واحترافية (3-5 أسطر فقط). لا تستخدم HTML.'}
====================

اكتب الرسالة مباشرة بدون مقدمات.`;

  return (await callGemini(prompt, 800, apiKey, modelName)).trim();
}

module.exports = { generateEmail, generateWhatsAppMessage, callGemini };
