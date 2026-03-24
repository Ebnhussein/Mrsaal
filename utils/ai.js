// utils/ai.js — Google Gemini API integration
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({}); // Automatically picks up GEMINI_API_KEY from process.env

async function callGemini(prompt, maxTokens = 1200) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      }
    });

    if (!response || !response.text) {
      throw new Error('لم يتم استلام نص من Gemini');
    }

    return response.text;
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    throw new Error('مشكلة في استدعاء الذكاء الاصطناعي: ' + error.message);
  }
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

اكتب الإيميل الآن. أعطني النتيجة **بهذا التنسيق الحرفي بالضبط** وبدون أي نص إضافي (لا نصوص قبلها ولا بعدها ولا تنسيق MarkDown):
SUBJECT: [الموضوع]
BODY:
[نص الإيميل كامل]`;

  const text = await callGemini(prompt);

  const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);

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

  const text = await callGemini(prompt, 600);
  return text.trim();
}

async function extractPdfText(pdfBuffer) {
  try {
    const prompt = 'أنت خبير في استخراج النصوص. استخرج كل النص الموجود في هذه السيرة الذاتية (CV) بدقة تامة. حافظ على اللغة الأصلية (سواء كانت عربية أو إنجليزية أو مزيج). أعد النص المستخرج فقط ولا تضف أي تعليقات أو مقدمات.';
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { inlineData: { data: pdfBuffer.toString('base64'), mimeType: 'application/pdf' } },
        prompt
      ]
    });
    if (!response || !response.text) throw new Error('لا يوجد نص مستخرج');
    return response.text;
  } catch (error) {
    console.error('Gemini PDF Parse Error:', error.message);
    throw new Error('فشل قراءة الـ PDF بواسطة الذكاء الاصطناعي: ' + error.message);
  }
}

module.exports = { generateEmail, generateWhatsAppMessage, callGemini, extractPdfText };
