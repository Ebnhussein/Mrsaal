const health=require('./ai-health');
const { GoogleGenAI } = require('@google/genai');
const {withRecovery,retryAfter,hardQuota}=require('./ai-retry');

// =====================================================
// قائمة الموديلات الافتراضية — ضيف أو رتّب الموديلات هنا.
// provider يدعم: gemini أو openrouter
// موديلات OpenRouter مسموح منها المجاني فقط.
// =====================================================
const DEFAULT_MODELS = [
  { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
  { provider: 'openrouter', model: 'openrouter/free' }
];

const setting=(name,value,min,max)=>{const n=Number(process.env[name]);return Number.isFinite(n)&&n>=min&&n<=max?Math.floor(n):value;};
const MODEL_TIMEOUT_MS=setting('AI_MODEL_TIMEOUT_MS',20000,5000,60000);
const TOTAL_TIMEOUT_MS=setting('AI_TOTAL_TIMEOUT_MS',45000,MODEL_TIMEOUT_MS,90000);

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

function makeError(code, type=null) {
  const error = new Error('AI request failed');
  error.status = Number(code) || 0;
  error.code=type||(error.status===429?'RATE_LIMIT':error.status>=500?'TEMPORARY':'UNKNOWN');
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
    throw makeError(0,'TRUNCATED');
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
      const error=makeError(data?.error?.code || response.status);
      error.code=error.status===429?(hardQuota(data)?'QUOTA':'RATE_LIMIT'):error.status>=500?'TEMPORARY':'UNKNOWN';
      error.retryAfterMs=retryAfter(response.headers);throw error;
    }

    const choice = data?.choices?.[0];

    if (choice?.finish_reason === 'length') {
      throw makeError(0,'TRUNCATED');
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
  validate = null,
  operationDeadline = null
) {
  const models = getModelChain(modelName);
  const deadline = Math.min(operationDeadline || Infinity, Date.now() + TOTAL_TIMEOUT_MS);
  if(Date.now()>=deadline)throw Object.assign(new Error('انتهت مهلة الكتابة. جرّب موديلًا أسرع.'),{code:'TIMEOUT'});
  const blockedProviders = new Set();
  const failures=[];

  const keys = {
    gemini: apiKey || process.env.GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY
  };

  for (const { provider, model } of models) {
    const key = keys[provider]?.trim();

    if (!key || blockedProviders.has(provider)) continue;
    const cooldown=health.available(provider,key,model);
    if(cooldown){failures.push(`${provider} / ${model}: الموديل في فترة انتظار بعد خطأ سابق`);continue;}

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const timeout = Math.min(MODEL_TIMEOUT_MS, remaining);

    try {
      console.log(`🔄 AI trying: ${provider} / ${model}`);

      const request = provider === 'gemini'
        ? requestGemini
        : requestOpenRouter;

      const text = await withRecovery(async()=>{
        try{return await request({prompt,maxTokens,model,apiKey:key,timeout:Math.min(timeout,Math.max(1,deadline-Date.now()))});}
        catch(error){if(hardQuota({error:{message:error.message}})){error.code='QUOTA';}if(!error.code||typeof error.code==='number'){const status=Number(error.status||error.code)||0;error.code=status===429?'RATE_LIMIT':status>=500?'TEMPORARY':error.name==='TypeError'?'NETWORK':'UNKNOWN';}throw error;}
      },deadline);

      if (typeof text !== 'string' || !text.trim()) {
        throw makeError(0,'EMPTY');
      }

      const result = text.trim();

      if (validate && !validate(result)) {
        throw makeError(0,'FORMAT');
      }

      console.log(`✅ AI succeeded: ${provider} / ${model}`);
      health.success(provider,key,model);return result;
    } catch (error) {
      const status = Number(error.status || error.code) || 0;
      const code=typeof error.code==='string'&&error.code!=='UNKNOWN'?error.code:status===401||status===403?'AUTH':status===404?'MODEL_UNAVAILABLE':status===429?'RATE_LIMIT':status===402?'CREDITS':status>=500?'TEMPORARY':error.name==='AbortError'||error.name==='TimeoutError'?'TIMEOUT':'UNKNOWN';health.failed(provider,key,model,code,error.retryAfterMs);
      const reason=error.code==='FORMAT'?'الرد وصل بتنسيق غير صالح':error.code==='TRUNCATED'?'الرد اتقطع قبل اكتماله':error.code==='EMPTY'?'الموديل لم يرجع نصًا':error.code==='QUOTA'?'الحد اليومي مستهلك':status===429?'تقييد مؤقت لعدد الطلبات':status===401||status===403?'راجع صلاحيات المفتاح':status===404?'الموديل غير متاح':error.name==='AbortError'||error.name==='TimeoutError'?'انتهت مهلة الرد':status>=500?'الموديل مزدحم مؤقتًا':'تعذر استلام رد صالح أو الاتصال';
      failures.push(`${provider} / ${model}: ${reason}`);

      // اللوج لا يحتوي على المفاتيح أو السيرة الذاتية.
      console.warn(
        `⚠️ AI failed: ${provider} / ${model}; status=${status}; code=${code}`
      );

      // لو المفتاح مرفوض، نتخطى باقي موديلات نفس المزود.
      if (
        error.code === 'QUOTA' ||
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

  throw Object.assign(new Error(
    'تعذر تنفيذ طلب الذكاء الاصطناعي. '+(failures.slice(0,3).join(' | ')||(Date.now()>=deadline?'انتهت مهلة الكتابة. جرّب موديلًا أسرع.':'لم يتم ضبط مفتاح لمنصة متاحة.'))
  ),{code:'AI_UNAVAILABLE',status:503});
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
