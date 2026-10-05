const { GoogleGenAI } = require('@google/genai');

// =====================================================
// قائمة الموديلات الافتراضية — ضيف أو رتّب الموديلات هنا.
// provider يدعم: gemini أو openrouter
// موديلات OpenRouter مسموح منها المجاني فقط.
// =====================================================
const DEFAULT_MODELS = [
  { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
  { provider: 'openrouter', model: 'openrouter/free' }
];

const MODEL_TIMEOUT_MS = 30000;
const TOTAL_TIMEOUT_MS = 90000;

function getModelChain(selectedGeminiModel) {
  let models;

  // لو موجود في Coolify، يستخدم القائمة دي بدل قائمة الملف.
  if (process.env.AI_MODEL_CHAIN?.trim()) {
    try {
      models = JSON.parse(process.env.AI_MODEL_CHAIN);
    } catch {
      throw new Error('AI_MODEL_CHAIN لازم يكون JSON صحيح.');
    }
  } else {
    models = [...DEFAULT_MODELS];

    // الحفاظ على اختيار موديل Gemini من إعدادات المستخدم.
    if (selectedGeminiModel) {
      models.unshift({
        provider: 'gemini',
        model: selectedGeminiModel
      });
    }
  }

  if (!Array.isArray(models) || !models.length) {
    throw new Error('قائمة موديلات الذكاء الاصطناعي فارغة.');
  }

  const seen = new Set();

  return models.map(item => {
    if (
      !item ||
      !['gemini', 'openrouter'].includes(item.provider) ||
      typeof item.model !== 'string' ||
      !item.model.trim()
    ) {
      throw new Error('كل موديل لازم يكون له provider وmodel صحيحين.');
    }

    const model = item.model.trim();

    if (
      item.provider === 'openrouter' &&
      model !== 'openrouter/free' &&
      !model.endsWith(':free')
    ) {
      throw new Error(
        'موديلات OpenRouter لازم تكون مجانية وتنتهي بـ :free، أو openrouter/free.'
      );
    }

    return { provider: item.provider, model };
  }).filter(item => {
    const key = `${item.provider}:${item.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeError(code) {
  const error = new Error('AI request failed');
  error.status = Number(code) || 0;
  return error;
}

async function requestGemini({
  prompt, maxTokens, model, apiKey, timeout
}) {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout }
  });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { maxOutputTokens: maxTokens }
  });

  if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw makeError(0);
  }

  return response.text;
}

async function requestOpenRouter({
  prompt, maxTokens, model, apiKey, timeout
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            process.env.BASE_URL || 'https://mrsaal.ebnhussein.co',
          'X-Title': 'Mrsaal'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'استخدم المعلومات المقدمة فقط. لا تختلق خبرات أو مهارات أو معلومات عن الشركة. التزم بالتنسيق المطلوب.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: maxTokens,
          stream: false
        })
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || data?.error) {
      throw makeError(data?.error?.code || response.status);
    }

    const choice = data?.choices?.[0];

    if (choice?.finish_reason === 'length') {
      throw makeError(0);
    }

    return choice?.message?.content;
  } finally {
    clearTimeout(timer);
  }
}

// الاسم القديم محفوظ عشان باقي المشروع يفضل شغال.
// apiKey وmodelName هنا يخصّوا Gemini.
// OpenRouter بيستخدم مفتاحه المستقل من Coolify.
async function callGemini(
  prompt,
  maxTokens = 1200,
  apiKey = null,
  modelName = null,
  validate = null
) {
  const models = getModelChain(modelName);
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const blockedProviders = new Set();

  const keys = {
    gemini: apiKey || process.env.GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY
  };

  for (const { provider, model } of models) {
    const key = keys[provider]?.trim();

    if (!key || blockedProviders.has(provider)) continue;

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const timeout = Math.min(MODEL_TIMEOUT_MS, remaining);

    try {
      console.log(`🔄 AI trying: ${provider} / ${model}`);

      const request = provider === 'gemini'
        ? requestGemini
        : requestOpenRouter;

      const text = await request({
        prompt,
        maxTokens,
        model,
        apiKey: key,
        timeout
      });

      if (typeof text !== 'string' || !text.trim()) {
        throw makeError(0);
      }

      const result = text.trim();

      if (validate && !validate(result)) {
        throw makeError(0);
      }

      console.log(`✅ AI succeeded: ${provider} / ${model}`);
      return result;
    } catch (error) {
      const status = Number(error.status || error.code) || 0;

      // اللوج لا يحتوي على المفاتيح أو السيرة الذاتية.
      console.warn(
        `⚠️ AI failed: ${provider} / ${model}; status=${status}`
      );

      // لو المفتاح مرفوض، نتخطى باقي موديلات نفس المزود.
      if (
        status === 401 ||
        status === 403 ||
        (
          provider === 'gemini' &&
          /API_KEY_INVALID|API key not valid/i.test(
            String(error.message || '')
          )
        )
      ) {
        blockedProviders.add(provider);
      }
    }
  }

  throw new Error(
    'الموديلات المتاحة لم تستطع توليد رد صالح. راجع المفاتيح وحدود الاستخدام أو حاول لاحقًا.'
  );
}

function parseEmail(text) {
  const subjectMatch = text.match(/^SUBJECT:[ \t]*(.+)$/im);
  const bodyMatch = text.match(/^BODY:[ \t]*\r?\n?([\s\S]+)/im);

  if (!subjectMatch || !bodyMatch || !bodyMatch[1].trim()) {
    return null;
  }

  return {
    subject: subjectMatch[1].trim(),
    body: bodyMatch[1].trim()
  };
}

async function generateEmail({
  cv, company, instructions, subjectTemplate, apiKey, modelName
}) {
  const prompt = `أنت متخصص في كتابة إيميلات تقديم وظيفي احترافية.
استخدم المعلومات المقدمة فقط ولا تختلق مهارات أو خبرات.
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
اكتب الإيميل بهذا التنسيق الحرفي وبدون Markdown أو نص إضافي:
SUBJECT: [الموضوع]
BODY:
[نص الإيميل كامل]`;

  const text = await callGemini(
    prompt,
    1200,
    apiKey,
    modelName,
    result => parseEmail(result) !== null
  );

  return parseEmail(text);
}

async function generateWhatsAppMessage({
  cv, company, instructions, apiKey, modelName
}) {
  const prompt = `أنت متخصص في كتابة رسائل تقديم وظيفي للواتساب.
استخدم المعلومات المقدمة فقط ولا تختلق مهارات أو خبرات.
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

  return callGemini(prompt, 800, apiKey, modelName);
}

module.exports = {
  generateEmail,
  generateWhatsAppMessage,
  callGemini
};
