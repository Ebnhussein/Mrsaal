const { GoogleGenAI } = require('@google/genai');

function getAI(apiKey) {
  return new GoogleGenAI(apiKey || process.env.GEMINI_API_KEY);
}

async function callGemini(prompt, maxTokens = 1200, apiKey = null) {
  try {
    const ai = getAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text) throw new Error('لم يتم استلام نص من Gemini');
    return text;
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429')) {
      throw new Error('تم استهلاك الحد الأقصى المجاني لطلبات الذكاء الاصطناعي حالياً. يرجى الانتظار دقيقة والمحاولة مرة أخرى.');
    }
    throw new Error('مشكلة في استدعاء الذكاء الاصطناعي: ' + error.message);
  }
}

async function generateEmail({ cv, company, instructions, subjectTemplate, apiKey }) {
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

  const text = await callGemini(prompt, 1200, apiKey);

  const subjectMatch = text.match(/SUBJECT:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);

  return {
    subject: subjectMatch ? subjectMatch[1].trim() : `طلب انضمام إلى ${company.name}`,
    body: bodyMatch ? bodyMatch[1].trim() : text.trim()
  };
}

async function generateWhatsAppMessage({ cv, company, instructions, apiKey }) {
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
${instructions || 'اتب رسالة واتساب مختصرة واحترافية (3-5 أسطر فقط) تبرز أهم المهارات ذات الصلة بمجال الشركة. لا تستخدم تنسيق HTML. استخدم إيموجي مناسب بشكل خفيف.'}
====================

اكتب الرسالة الآن مباشرة بدون أي مقدمات أو تفسيرات.`;

  const text = await callGemini(prompt, 1800, apiKey);
  return text.trim();
}

async function extractPdfText(pdfBuffer, apiKey = null) {
  try {
    const ai = getAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = 'أنت خبير في استخراج النصوص. استخرج كل النص الموجود في هذه السيرة الذاتية (CV) بدقة تامة. حافظ على اللغة الأصلية (سواء كانت عربية أو إنجليزية أو مزيج). أعد النص المستخرج فقط ولا تضف أي تعليقات أو مقدمات.';
    
    const result = await model.generateContent([
      { inlineData: { data: pdfBuffer.toString('base64'), mimeType: 'application/pdf' } },
      prompt
    ]);
    
    const text = result.response.text();
    if (!text) throw new Error('لا يوجد نص مستخرج');
    return text;
  } catch (error) {
    console.error('Gemini PDF Parse Error:', error.message);
    if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429')) {
      throw new Error('حجم ملف الـ PDF كبير جداً أو تم استهلاك الحد المجاني للذكاء الاصطناعي. يرجى الانتظار دقيقة واحدة والمحاولة ثانية.');
    }
    throw new Error('فشل قراءة الـ PDF: ' + error.message);
  }
}

module.exports = { generateEmail, generateWhatsAppMessage, callGemini, extractPdfText };
