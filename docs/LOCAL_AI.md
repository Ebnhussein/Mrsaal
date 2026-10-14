# ربط مرسال بالذكاء المحلي

إعداد ربط ذكاء مرسال المحلي وحدود الاستخدام.

## النشر
1. احتفظ بنسخة من قاعدة البيانات والمشروع قبل النشر.
2. التغييرات موجودة في الريبو. انشر آخر commit من Coolify.
3. أضف إعدادات Coolify أدناه كمتغيرات Runtime ثم Save وRedeploy.
4. تحديث قاعدة البيانات يتم تلقائيًا عند تشغيل التطبيق. يضيف 3 جداول للاستخدام وتحديد سرعة الطلبات والأماكن المتاحة، بدون تعديل حدود المستخدمين السابقة. لا توجد مكتبات جديدة أو تغيير package.json.
5. افتح الموقع واعمل Ctrl+Shift+R لتحديث ملفات الأدمن.

## إعدادات Coolify
LOCAL_AI_BASE_URL=https://ai.ebnhussein.co/v1
LOCAL_AI_MODEL=local-ai
LOCAL_AI_API_KEY=ضع_مفتاح_خدمة_AI_الحقيقي_هنا
LOCAL_AI_MAX_CONCURRENT=1
LOCAL_AI_REQUESTS_PER_MINUTE=3
LOCAL_AI_MAX_OUTPUT_TOKENS=2400
LOCAL_AI_MAX_PROMPT_CHARS=50000
AI_TOTAL_TIMEOUT_MS=90000

استبدل قيمة LOCAL_AI_API_KEY فقط بالمفتاح الصحيح داخل Coolify، ولا ترفعه في GitHub أو ترسله في المحادثة. Base URL ينتهي /v1 بدون /chat/completions؛ التطبيق يضيف المسار. ملف .env.example يحتوي أمثلة بدون مفتاح، ولا يقرأه التطبيق تلقائيًا.
LOCAL_AI_MAX_CONCURRENT: من 1 إلى 8، إجمالي طلبات مرسال إلى نفس عنوان الخدمة عبر نسخ التطبيق التي تشترك في قاعدة البيانات. ابدأ بـ1؛ لا يحد طلبات التطبيقات الأخرى التي تستخدم نفس الجهاز.
LOCAL_AI_REQUESTS_PER_MINUTE: من 1 إلى 30 لكل مستخدم. هنا 3 طلبات فعلية خلال الدقيقة حسب توقيت قاعدة البيانات، والمحاولات الفاشلة بعد الوصول للخدمة تُحسب في حد السرعة.
LOCAL_AI_MAX_OUTPUT_TOKENS: من 128 إلى 8000، سقف إخراج وليس عدد كلمات مطلوب. التطبيق يستخدم الأصغر بين هذا السقف والحد المطلوب من وظيفة الكتابة أو المساعد.
LOCAL_AI_MAX_PROMPT_CHARS: من 1000 إلى 100000. عدّ حروف وليس توكنز؛ إذا سياق موديلك صغير قلّل هذه القيمة ونص السيرة والأمثلة. الحد وحده لا يضمن أن المحتوى يلائم سياق الموديل.
AI_TOTAL_TIMEOUT_MS: إجمالي عملية الكتابة، الحد الأقصى 90000. نستخدم 90 ثانية كبداية للموديل المحلي؛ ليس ضمانًا أن جهازك سينهي الكتابة في الوقت.

## مصدر الموديل
- المستخدم الافتراضي ومَن اختار «ذكاء مرسال» يستخدم الـAPI المحلي بمجرد وجود LOCAL_AI_BASE_URL.
- لا يحتاج المستخدم إلى إضافة Provider أو مفتاح. لا يصل مفتاح الخدمة إلى المتصفح.
- اختيار المنصات الشخصية الصريح للمستخدم يظل محترمًا. لا نعيد تعيين اختيارات المستخدمين الموجودة.
- عند تعطل المحلي لا يحدث انتقال خفي إلى OpenRouter أو Gemini. المنصات الشخصية قد تستخدم فقط إذا كان المستخدم قد وافق على البديل الشخصي بالفعل.
- AI_MODEL_CHAIN لا يتحكم في المحلي. يمكن ترك إعدادات OpenRouter/Gemini كخطة رجوع يدوي: لإعادة النظام السابق احذف LOCAL_AI_BASE_URL ثم Redeploy.
- جهاز الموديل والاتصال والنفق/البوابة يجب أن يظلوا شغالين؛ توقفهم يعني توقف ذكاء مرسال المحلي.

## حدود كل مستخدم
من /admin → المستخدمون → «الاستخدام والحدود»:
- حد AI اليومي يضبط العدد الموجود أصلًا في users.ai_limit. الصفر يمنع الاستخدام، والبداية للمستخدمين الجدد 100 حسب إعداد المشروع الحالي؛ لا نغيّر المستخدمين السابقين تلقائيًا.
- المسودة الناجحة تستهلك مرة واحدة من عداد ai؛ فشلها يعيد الحجز. حدود الباقة للفترة، إذا اختار الحساب باقة محددة، ما زالت تطبق فوق الحد اليومي.
- المساعد assistant وتحليل الأسلوب style لهما عدادات منفصلة موجودة سابقًا. المساعد حتى min(ai_limit,50)، والأسلوب حتى ai_limit. ليس ai_limit مجموعًا واحدًا لكل الوظائف.
- طلب واحد للمستخدم في نفس الوقت عبر القفل الموجود أصلًا. يوجد حد إجمالي للمحلي أيضًا، وحد سرعة 3 طلبات فعلية للدقيقة.
- البوب أب يعرض إحصاءات الـAPI المحلي: الطلبات الفعلية (بما فيها الفشل)، عدد الطلبات التي رجّعت قياسًا، والتوكنز المبلّغة. هذه ليست نفس رصيد المسودات.
- التوكنز إحصاء وليست حصة صلبة لكل مستخدم في هذه المرحلة. يمكن تحديد عدد المسودات لكل حساب وسقف التوكنز لكل طلب؛ إذا احتجت سقف توكنز يوميًا خاصًا بكل مستخدم فهو إضافة مستقلة.
- اليوم يُجدد حسب CURRENT_DATE في قاعدة البيانات. لا نفترض أنه منتصف الليل بتوقيت جهاز المستخدم.

## التشخيص والخصوصية
لا نسجل نص السيرة أو الرسالة أو المفاتيح أو الرد الخام للمزود. نسجل التوكنز التي يرجعها الـAPI، ولا نختلق قيمة لطلبات لم ترجع usage.
عند Timeout أو انقطاع الاتصال قد يظل الموديل يحسب على الجهاز؛ يحتفظ مرسال بمكان الطلب حتى انتهاء فترة الحجز بدل إطلاق طلب آخر فورًا. ينبغي أن تدعم البوابة نفسها حدود التزامن والإلغاء إذا كانت تخدم برامج أخرى؛ مرسال يتحكم في طلباته فقط.
الجداول مرتبطة بالمستخدم بـON DELETE CASCADE. لا توجد تسوية تلقائية للتوكنز التي استُهلكت بعد انقطاع الاتصال ولم يبلغ عنها المزود.

## تحقق قبل إتاحته للجميع
[ ] حساب جديد بدون Provider يكتب مسودة بالمحلي، وتظهر AI trying: local ثم AI succeeded: local في اللوج.
[ ] حد المستخدم AI=1، نجاح أول مسودة ثم رفض الثانية في نفس اليوم. راجع خطة الحساب أيضًا.
[ ] حد AI=0 يمنع الكتابة.
[ ] حسابان يكتبان معًا: واحد فقط يصل للخدمة، والثاني يرى أن الخدمة مشغولة، ولا يفقد رصيد مسودة ناجحة.
[ ] رفض/تعطل الخدمة يعرض خطأ واضحًا ولا يرسل رسالة أو يمسح مسودة قديمة.
[ ] المستخدم الذي اختار personal صراحة ما زال يستخدم منصته.
[ ] الاستخدام يظهر للأدمن بعد الطلب. إذا usage غير موجود يظهر نقص القياس بدل ادعاء عدد دقيق للتوكنز.
[ ] جرّب المساعد، كتابة Gmail، وكتابة WhatsApp على الكمبيوتر والموبايل؛ صلاحية API وحدها لا تثبت قدرة الموديل على الالتزام بـJSON أو جودة العربية.

الاختبارات: npm ci --ignore-scripts نجح، npm run check نجح لـ125 ملف JavaScript/أصول واجهة، وجميع 192 اختبارًا نجحت بما فيها اختبارات قاعدة البيانات. لم نستعمل مفتاحك ولم نختبر الاستجابة الفعلية لجهازك؛ الإعدادات أعلاه تحتاج تجربة بعد النشر.

## معالجة صيغة JSON
عند طلب مسودة أو رد دعم محدد البنية، نرسل response_format=json_object وتعليمات نظام تطلب كائن JSON واحدًا بكل الحقول. LOCAL_AI_JSON_MODE=off يعطل هذا الحقل إذا كانت البوابة ترفضه، مع استمرار التعليمات والفحص. لا يضمن JSON mode أن الموديل يرجع جميع الحقول المطلوبة.
نزيل غلاف Markdown وكتلة think مغلقة في بداية الإجابة فقط، ولا نستخدم التفكير كنص الرسالة، ولا نقبل ردًا أعلن المزود أنه مقطوع. المسودة ذات التنسيق المرفوض تحصل على محاولة واحدة إضافية داخل المهلة الأصلية وبنفس حجز رصيد المسودة، مع احتساب كل طلب في حد السرعة والاستهلاك الفعلي.
التشخيص الآمن Local AI output invalid يعرض صلاحية JSON وأسماء الحقول المعروفة وطول الإجابة فقط، بدون محتواها.

العنوان ونص الرسالة هما الحقلان المطلوبان للمسودة. notes وneedsUserInput اختياريان؛ إذا وُجدا يجب أن يكونا بالنوع الصحيح، وneedsUserInput=true يمنع إخراج المسودة. غيابهما لا يعني مراجعة مؤكدة: reviewed يبقى false، ولا يحدث إرسال قبل اعتماد المستخدم.

## Latency and structured responses

Local drafts use a compact instruction set, keep the selected CV facts and writing examples, omit unrelated channel templates, and request at most 1200 output tokens (also capped by LOCAL_AI_MAX_OUTPUT_TOKENS). No automatic increase of the operation deadline is made. A formatting retry requires at least 20 seconds left within the same operation and credit reservation.

Drafts and support answers request a typed JSON schema with temperature 0. The LiteLLM/Ollama route must support forwarding response_format. If your gateway rejects json_schema, explicitly set LOCAL_AI_JSON_MODE=object for JSON-object compatibility, or off to disable response_format. Do not silently remove validation.

`Local AI timing` logs elapsed milliseconds, prompt character count, requested output tokens, reported prompt/completion token counts, finish reason and whether the request was aborted. It never logs CV text, messages or keys. Use these metrics for one real draft before deciding whether to change model/hardware or gateway configuration. A short synthetic API reply is not a performance guarantee for a full CV.

Support greetings and identity questions return an immediate local introduction without spending AI quota. Product questions still use the configured AI and current product guide; unavailable AI is explicitly identified and a guide is offered. Outside requests remain restricted.

## Reviewed CV summaries

Settings → CV offers an editable candidate copied from original CV lines. It uses no AI request, never fabricates facts, and is never used until explicitly approved. Candidates may omit relevant facts; users must add them before approving. The limit is 1800 characters. The approved summary is stored per CV version and tied to a SHA-256 hash of its source text. A changed source invalidates approval. Revert to full text with Use full CV text.

All draft-generation endpoints pass the server-verified summary. Only the platform local generation path uses it; explicit personal providers keep the full CV. Attachments still use the original saved PDF. Fixed templates are unchanged. CV and writing style precede variable company/revision information in local prompts to improve prefix reuse; cache retention and speed remain dependent on Ollama and other traffic.

Support selects at most two relevant guide topics, with excerpts of up to 1100 characters each and four recent messages of at most 450 characters. It asks a clarifying question when excerpts lack necessary detail and offers the full source guide as fallback. The product guide now documents summary approval, so the assistant uses the updated knowledge automatically.
