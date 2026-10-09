/* Shared bilingual guide for tours and the product assistant. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MrsaalGuide=factory();})(typeof window!=='undefined'?window:globalThis,function(){return {
  "version": "2026-10-08-launch",
  "tours": {
    "home": [
      {
        "id": "home-companies",
        "title": "مساحة متابعتك",
        "body": "الرقم ده عدد الشركات المحفوظة في حسابك، مش عدد الرسائل. افتح «الشركات» عشان تراجع الأسماء ووسائل التواصل.",
        "title_en": "Your application workspace",
        "body_en": "This number counts companies saved in your account, not available jobs. Use the Companies section to review and organise your own list."
      },
      {
        "id": "home-next-block",
        "title": "الخطوة المناسبة دلوقتي",
        "body": "مرسال يعرض المهمة الناقصة اللي محتاجها: السيرة، القناة أو الأسلوب. إكمالها أو تخطيها يخفيها من المهام المتبقية؛ التخطي لا يلغي متطلبات الإرسال.",
        "title_en": "A useful next step",
        "body_en": "This card adapts to your saved CV, connected channels and company list. Completed or skipped setup steps are not repeated."
      },
      {
        "id": "home-activity",
        "title": "آخر نشاط",
        "body": "الرسائل والردود المرصودة تظهر هنا. افتح التقرير لمراجعة نص الرسالة وتوقيتها وبريد المرسل بدل الاكتفاء بعدد الرسائل.",
        "title_en": "Recent activity",
        "body_en": "See your latest sending results here. Open a message to review its text, status and timeline. Results come from your account data."
      },
      {
        "id": "nt-bell",
        "title": "كل جديد من الجرس",
        "body": "الجرس يعرض عدد غير المقروء. افتحه لمتابعة الردود ورصد فتح البريد وواتساب والتذاكر والتحديثات. اضغط شوف التفاصيل للوصول للسجل، أو افتح الترس لاختيار الأنواع والصوت والمتصفح.",
        "title_en": "Stay up to date from the bell",
        "body_en": "The bell counts unread notifications. Open it for replies, email-open indicators, WhatsApp receipts, support tickets and updates. View details opens the original record; Settings lets you choose events, sound and browser alerts."
      }
    ],
    "onboarding": [
      {
        "id": "onboard-counter",
        "title": "ابدأ بثلاث خطوات",
        "body": "ارفع سيرتك، اربط قنوات التواصل، وظبط أسلوب الكتابة. الشريط يحسب المكتمل فعليًا؛ الخطوة المتخطاة لا تُحسب مكتملة.",
        "title_en": "Start with three steps",
        "body_en": "Prepare your CV, WhatsApp if needed, and writing preferences. You can skip a step and complete it later in Settings."
      },
      {
        "id": "onboard-cards",
        "title": "كمّل اللي تحتاجه",
        "body": "كل كارت يفتح إعداد الخطوة. ممكن تتخطاه وترجع له من الإعدادات. لو هتبعت على Gmail فقط، مش لازم تربط واتساب.",
        "title_en": "Complete what you need",
        "body_en": "Use each card to open its settings. Completed steps disappear. Skipping postpones setup and does not delete account data."
      }
    ],
    "companies": [
      {
        "id": "import-panel",
        "title": "رفع الملف مش آخر خطوة",
        "body": "افتح الاستيراد واختار XLSX أو XLS أو CSV/TSV، حتى 10 MB. مرسال يقرأ أول ورقة وأول صف كعناوين؛ بعد القراءة لازم تطابق الأعمدة وتؤكد الاستيراد. يمكنك تنزيل نموذج Excel من أعلى قسم الاستيراد. املأ الورقة الأولى؛ الأمثلة والتعليمات في ورقتين منفصلتين.",
        "title_en": "Uploading is not the final step",
        "body_en": "Upload your Excel or CSV file, map its columns and confirm the import. Then review the added and skipped counts."
      },
      {
        "id": "xl-zone",
        "title": "اختيار الملف من الموبايل",
        "body": "اختار ملفًا محفوظًا في تطبيق الملفات. لو الملف مش ظاهر استخدم زر «اختار من كل الملفات». لو جاي من Drive أو واتساب نزّله أولًا؛ الرابط أو الصورة مش ملف شركات.",
        "title_en": "Choosing a file on mobile",
        "body_en": "Download the spreadsheet from Drive or WhatsApp first. Use the device Files app or Browse all files. XLSX, XLS or CSV up to 10 MB."
      },
      {
        "id": "mc-name",
        "title": "طابق عمود اسم الشركة",
        "body": "اختار العمود اللي فيه أسماء الشركات. أول صف لازم يكون عناوين وليس أول شركة؛ غيّر ملفك لو العناوين غير موجودة.",
        "title_en": "Map company names",
        "body_en": "Choose the column containing company names. A company name and at least one contact method are required."
      },
      {
        "id": "mc-email",
        "title": "اختار بريد المستلم",
        "body": "حدد عمود الإيميل. لو ملفك فيه أرقام فقط سيب الإيميل «لا يوجد»، لكن اختار الهاتف. الإيميل المستخدم هنا بريد الشركة، وليس حساب الإرسال الخاص بك.",
        "title_en": "Choose recipient emails",
        "body_en": "Choose the email column, not your own sending account. Invalid or missing addresses can cause rows to be skipped."
      },
      {
        "id": "mc-phone",
        "title": "احتفظ بالرقم كاملًا",
        "body": "اختار عمود الهاتف، ويفضل حفظه كنص في Excel مع كود الدولة. الأصفار اللي اتحذفت من أصل الملف لا يمكن استعادتها تلقائيًا. لو الشركة لها إيميل ورقم، اختار القناة بنفسك من الإرسال أو المعاينة. البيانات الناقصة للقناة تتسجل كتخطي.",
        "title_en": "Keep phone numbers intact",
        "body_en": "Store phone numbers as text in your spreadsheet, including country codes. Having a number does not guarantee it is registered on WhatsApp."
      },
      {
        "id": "btn-import-companies",
        "title": "أكد ثم راجع النتيجة",
        "body": "اضغط استيراد الشركات بعد المطابقة. راجع المضاف والمتخطي؛ الصفوف الناقصة أو الإيميلات غير الصالحة أو المكررة قد تتخطى. رفع الملف وحده لا يضيف البيانات.",
        "title_en": "Confirm and review results",
        "body_en": "Click Import companies after mapping the columns. Read the result and skipped reasons. Review the list before retrying to avoid duplicate attempts."
      },
      {
        "id": "company-search",
        "title": "ابحث عن اللي استوردته",
        "body": "ابحث بالاسم أو الإيميل أو الهاتف أو المجال. لو مش لاقي بياناتك امسح البحث وراجع فلتر الحالة قبل إعادة الاستيراد.",
        "title_en": "Find imported companies",
        "body_en": "Search by company name, email or field. Clear the search and change the status filter if a company seems missing."
      },
      {
        "id": "filter-status",
        "title": "افهم حالة الشركة",
        "body": "انتظار: لم تُرسل بعد. أُرسل: الطلب تم. مجدول: في موعد لاحق. فشل: راجع السبب في التقارير. الحالة لا تثبت إن المستلم قرأ الرسالة.",
        "title_en": "Understand company status",
        "body_en": "Pending, sent, scheduled, failed and skipped reflect the saved sending workflow. A sent status does not prove delivery or reading."
      },
      {
        "id": "companies-container",
        "title": "اختار ثم عاين",
        "body": "حدد الشركات المطلوبة، وافتح المعاينة لتراجع المستلم والنص قبل الإرسال. اختيار شركة لا يرسل لها تلقائيًا.",
        "title_en": "Select and preview",
        "body_en": "Choose companies using the checkboxes. Preview a message to review its recipient, channel, draft and CV attachment before sending."
      },
      {
        "id": "applications-selection",
        "title": "جهز الإرسال بعد التحديد",
        "body": "بعد تحديد شركة أو أكثر يظهر شريط الإجراءات. اضغط تجهيز الإرسال لاختيار القناة والحساب والتوقيت. إلغاء التحديد يزيل الاختيارات كلها، والحذف داخل المزيد مع تأكيد.",
        "title_en": "Prepare sending after selection",
        "body_en": "Select one or more companies to show the action bar. Prepare sending opens the channel, account and timing controls. Clear selection removes all selections; deletion is under More and requires confirmation."
      }
    ],
    "send": [
      {
        "id": "send-channel",
        "title": "اختار قناة الدفعة",
        "body": "اختار إيميل أو واتساب. لو الشركة عندها الاتنين نستخدم اختيارك فقط. لو ناقص إيميل أو رقم صالح للقناة المختارة، هتظهر كتخطي في التقارير من غير طلب AI أو تحويل تلقائي. الرقم الصالح لا يضمن وجود حساب واتساب.",
        "title_en": "Choose a batch channel",
        "body_en": "Select Email or WhatsApp for this batch. Missing contact details for the selected channel are skipped; Mrsaal does not switch channels automatically."
      },
      {
        "id": "channel-summary",
        "title": "راجع الشركات المحددة",
        "body": "الشركات المحددة من صفحة الشركات والتقديم هي المستلمون فقط. الملخص يوضح المناسبين للقناة المختارة ومن سيتم تخطيهم. إخفاء شركة بفلتر البحث لا يلغي تحديدها؛ راجع العدد قبل التأكيد.",
        "title_en": "Review selected companies",
        "body_en": "Only companies selected in Companies & applications are recipients. The summary shows eligible companies and those skipped for missing contact details. Hiding a company with a filter does not clear its selection; review the count before confirming."
      },
      {
        "id": "send-sender",
        "title": "من أي Gmail؟",
        "body": "اختار بريد المرسل. القائمة تعرض حسابات Google المرتبطة من قنوات التواصل. التبديل لا يغير حساب تسجيل دخول مرسال. الرسائل المجدولة تُثبت هذا الحساب وقت الجدولة.",
        "title_en": "Choose the Gmail sender",
        "body_en": "Select a connected Gmail account. The account selected when scheduling remains attached to those scheduled jobs."
      },
      {
        "id": "opt-preview",
        "title": "راجع كل رسالة",
        "body": "تفعيل المعاينة يفتح المسودة لتعدلها وتعتمدها قبل الإرسال. التوليد والمراجعة لا يرسلان الرسالة؛ زر التأكيد هو قرار الإرسال.",
        "title_en": "Review each message",
        "body_en": "Enable previews to edit each draft before approval. Check the company, facts, wording and attachment before sending."
      },
      {
        "id": "sched-type",
        "title": "الوقت المناسب",
        "body": "الآن يبدأ الإرسال عند تأكيدك. في وقت محدد يحتاج تاريخًا ووقتًا في المستقبل؛ المهام تُفحص كل دقيقة، فالتنفيذ ليس مضمونًا في نفس الثانية.",
        "title_en": "Choose a suitable time",
        "body_en": "Send now or schedule for a future time. The browser date field uses your device time zone."
      },
      {
        "id": "send-dt",
        "title": "حدد موعدًا مستقبلًا",
        "body": "اختار موعدك من الجهاز وراجع التاريخ والوقت. لو عايز تغيير حساب المرسل، اعمله قبل الجدولة؛ تغييره بعد كده لا يبدل الحساب المثبت للرسائل المجدولة.",
        "title_en": "Set a future date",
        "body_en": "Choose a valid future date and time before scheduling. Review the time shown before confirming."
      },
      {
        "id": "delay-s",
        "title": "فاصل بين الرسائل",
        "body": "الفاصل ينظم الإرسال المباشر داخل المجموعة. وجود فاصل لا يضمن سماح المنصة بالإرسال أو يمنع حدود الاستخدام. ابدأ برسالة اختبار إلى حسابك.",
        "title_en": "Delay between messages",
        "body_en": "Set the supported delay in seconds. This spaces requests; it does not bypass provider quotas or guarantee inbox delivery."
      },
      {
        "id": "btn-send",
        "title": "ابدأ بعد المراجعة",
        "body": "السيرة لازم تكون جاهزة، وGmail مصرح له، وواتساب متصل لو فيه مستلمين على واتساب. لو فشل الإرسال راجع التقرير قبل إعادة المحاولة لتجنب تكرار رسالة وصلت.",
        "title_en": "Start after reviewing",
        "body_en": "Confirm your channel, recipients and account connection. The send action creates real messages or scheduled jobs after your approval."
      },
      {
        "id": "btn-stop",
        "title": "إيقاف المجموعة",
        "body": "الإيقاف يطلب وقف باقي المجموعة في الواجهة؛ لا يسحب رسالة أُرسلت بالفعل. الرسائل المجدولة لا تُلغى بمجرد إغلاق الصفحة.",
        "title_en": "Stop a batch",
        "body_en": "Stop requests halt the remaining batch. A message already being sent may finish; review the results before retrying."
      }
    ],
    "report": [
      {
        "id": "r-sent",
        "title": "الإرسال والقراءة مختلفان",
        "body": "أُرسل يعني إن خدمة الإرسال قبلت الطلب؛ مش معناه إنه اتقرأ أو فيه رد. افتح التفاصيل لكل رسالة لمراجعة الحالة.",
        "title_en": "Sending and reading differ",
        "body_en": "Sent means the sending service accepted the message. Delivery, read indicators and replies have separate evidence and timestamps."
      },
      {
        "id": "r-opens",
        "title": "حدود التتبع",
        "body": "فتح الإيميل يعتمد على تحميل صورة التتبع وقد يتأثر ببرامج البريد. واتساب يعتمد على أحداث القراءة والتسليم اللي تصل للتطبيق، وقد تتأخر أو لا تظهر.",
        "title_en": "Tracking has limits",
        "body_en": "Email opens depend on loading a small image and are not proof of reading. WhatsApp read status depends on the service confirming it."
      },
      {
        "id": "log-container",
        "title": "راجع الرسالة نفسها",
        "body": "افتح التفاصيل لترى نص الرسالة والخط الزمني وبريد المرسل والرد المرصود. الردود في Gmail تُراجع دوريًا؛ زر التزامن يطلب تحديثها.",
        "title_en": "Review the actual message",
        "body_en": "Open a log entry to see the sent text, timeline and latest detected reply. Missing confirmations do not prove the message was unread."
      },
      {
        "id": "nt-bell",
        "title": "كل جديد من الجرس",
        "body": "الجرس يعرض عدد غير المقروء. افتحه لمتابعة الردود ورصد فتح البريد وواتساب والتذاكر والتحديثات. اضغط شوف التفاصيل للوصول للسجل، أو افتح الترس لاختيار الأنواع والصوت والمتصفح.",
        "title_en": "Stay up to date from the bell",
        "body_en": "The bell counts unread notifications. Open it for replies, email-open indicators, WhatsApp receipts, support tickets and updates. View details opens the original record; Settings lets you choose events, sound and browser alerts."
      }
    ],
    "settings-account": [
      {
        "id": "profile-email",
        "title": "هوية حساب مرسال",
        "body": "البريد هنا هو حساب تسجيل دخول مرسال، والشركات والسيرة والإعدادات تابعة له. إضافة Gmail للإرسال لا تبدل الهوية دي.",
        "title_en": "Your Mrsaal account identity",
        "body_en": "This is your sign-in account. You can connect separate Gmail sending accounts in Communication channels without changing your saved data."
      },
      {
        "id": "settings-account",
        "title": "المظهر والإعدادات",
        "body": "اختار فاتح أو داكن أو حسب الجهاز. إعداد المظهر وتخطي الجولة محفوظان في المتصفح، لذلك قد تحتاج اختيارهما مرة أخرى على جهاز آخر.",
        "title_en": "Appearance and setup",
        "body_en": "Choose Light, Dark or System. Appearance is saved on this device. Return to setup whenever you need it."
      }
    ],
    "settings-cv": [
      {
        "id": "cv-zone",
        "title": "ارفع ملفًا قابلًا للقراءة",
        "body": "PDF أو TXT حتى 20 MB. على الموبايل استخدم تطبيق الملفات ونزّل الملف من Drive أو واتساب أولًا. لو لا يظهر في الاختيار استخدم اختيار كل الملفات.",
        "title_en": "Upload a readable document",
        "body_en": "Upload a PDF or TXT up to 20 MB. On mobile, download the file first and use Files or Browse all files if it is not visible."
      },
      {
        "id": "cv-status",
        "title": "استنى نتيجة الرفع",
        "body": "رسالة النجاح معناها إن النص اتقرأ واتحفظ. لو الملف تالف أو مصوّر بدون نص، هتظهر رسالة خطأ، وتظل السيرة السابقة محفوظة. جرّب استخراج النص أو ملفًا آخر.",
        "title_en": "Wait for upload confirmation",
        "body_en": "Success means readable text was saved. A corrupted or scanned PDF with no text shows an error and keeps your previous CV."
      },
      {
        "id": "cv-text",
        "title": "راجع النص قبل الكتابة",
        "body": "تأكد إن اسمك وخبراتك والأرقام واضحة. مرسال يستخدم النص ده في AI؛ استخراج PDF قد يغيّر ترتيب السطور، فراجع النتيجة بنفسك.",
        "title_en": "Review extracted text",
        "body_en": "Check your name, experience and numbers. PDF extraction may reorder lines, so review the text before using it for AI writing."
      },
      {
        "id": "cv-text",
        "title": "الحفظ اليدوي يحافظ على المرفق",
        "body": "رفع PDF يحفظ النص والمرفق. تعديل النص وحفظه يحافظ على PDF الأصلي ويُرفق بالإيميل أو واتساب؛ تعديل النص لا يغيّر محتوى ملف PDF نفسه. لو السيرة نص فقط ارفع PDF لإرفاقه. ملفات PDF المصوّرة تحتاج OCR خارج مرسال حاليًا.",
        "title_en": "Text edits keep your PDF",
        "body_en": "Saving edited text keeps the original PDF attachment. It does not change the PDF contents. Upload a PDF if your CV is text-only. Scanned PDFs need OCR outside Mrsaal."
      }
    ],
    "settings-channels": [
      {
        "id": "gmail-channel-card",
        "title": "حساب Google إضافي",
        "body": "اضغط إضافة حساب Google، اختار البريد ووافق على الصلاحيات. ده حساب إرسال إضافي، لا ينقل الشركات ولا يسجلك بهوية مرسال أخرى.",
        "title_en": "Connect another Google account",
        "body_en": "Use Add Google account to connect another Gmail sender through Google. This does not replace your Mrsaal sign-in account."
      },
      {
        "id": "gmail-accounts",
        "title": "التبديل بين حساباتك",
        "body": "استخدم «استخدم للإرسال» لاختيار المرسل، أو القائمة في المعاينة والإرسال. الحساب المختار ظاهر. الفصل يوقف استخدامه ومتابعة ردوده حتى إعادة الربط، ولا يسجلك خروجًا.",
        "title_en": "Switch your sending account",
        "body_en": "Choose Use for sending on a connected account. New sends use it; already-scheduled messages retain their selected sender."
      },
      {
        "id": "wa-connect",
        "title": "امسح QR من واتساب",
        "body": "اضغط الربط، وافتح واتساب على الموبايل ← الأجهزة المرتبطة ← ربط جهاز. امسح الرمز وانتظر الحالة؛ لا تغلق الخطوة قبل التأكد.",
        "title_en": "Scan the WhatsApp QR code",
        "body_en": "In WhatsApp, open Linked devices and Link a device. Scan the QR code from your primary phone. Each user has their own session."
      },
      {
        "id": "wa-status",
        "title": "متصل قبل الإرسال",
        "body": "وجود رقم أو QR لا يكفي؛ الحالة لازم تكون متصل. لو الرسالة لم تصل أو ظهرت Waiting for this message، جرّب رسالة اختبار وراجع الاتصال قبل تكرار مجموعة كاملة.",
        "title_en": "Confirm connection before sending",
        "body_en": "Refresh the status and wait for Connected. If disconnected, reconnect before sending a WhatsApp batch."
      }
    ],
    "settings-template": [
      {
        "id": "ws-goal",
        "title": "سبب التواصل",
        "body": "اختار سؤالًا عن فرص، أو تقديمًا على وظيفة معلنة فعلًا، أو متابعة لتواصل سابق فعلًا. اختيار الهدف يغيّر معنى الرسالة وليس مجرد نبرتها.",
        "title_en": "Why are you reaching out?",
        "body_en": "Choose an opportunity enquiry, advertised role or follow-up. Use the latter options only when they reflect the real situation."
      },
      {
        "id": "ws-role",
        "title": "الدور المطلوب",
        "body": "اكتب الدور اللي بتدور عليه، مثل مصمم أو مسؤول تسويق. ده هدفك، ولا يُستخدم كخبرة مثبتة إلا لو السيرة تدعمها.",
        "title_en": "Your target role",
        "body_en": "An optional role helps focus the draft. Your experience and skills still come from your saved CV."
      },
      {
        "id": "ws-language",
        "title": "اختار لغة الرسالة",
        "body": "اللغة هنا لها أولوية على أمثلة الكتابة والتعليمات المتعارضة. اختار المصري أو العربية أو الخليجي أو الإنجليزية حسب المستلم.",
        "title_en": "Choose message language",
        "body_en": "This controls generated message language separately from the interface language. It takes priority over conflicting examples."
      },
      {
        "id": "ws-example-0",
        "title": "أمثلة من كتابتك أنت",
        "body": "ضيف مثالين أو ثلاثة قصار كتبتهم فعلًا. الأمثلة لتقليد طريقة الكلام فقط؛ خبراتك مصدرها السيرة. احذف أسماء أو بيانات لا تحتاج مشاركتها مع مزود AI.",
        "title_en": "Examples in your own voice",
        "body_en": "Add two or three examples you wrote. Remove sensitive details before sharing them with the AI provider for analysis and drafting."
      },
      {
        "id": "ws-analyze",
        "title": "حلل ثم اعتمد",
        "body": "الـAI يقترح وصفًا لطريقتك. راجع الوصف وعدّله ثم اضغط الاعتماد وبعدها الحفظ؛ التحليل وحده لا يطبّق الوصف تلقائيًا.",
        "title_en": "Analyse, then approve",
        "body_en": "Analyse your examples to receive an editable style suggestion. Approve it, then save your style to use it in future drafts."
      },
      {
        "id": "ws-forbidden",
        "title": "استبعد العبارات المزعجة",
        "body": "كل عبارة ممنوعة في سطر، مثل «يسعدني أن أتقدم». أضف تعليمات واضحة بدل طلب عام مثل «خليها بشرية». راجع النتيجة لأن الموديل قد لا يلتزم دائمًا.",
        "title_en": "Avoid unwanted phrases",
        "body_en": "Enter one phrase per line. These are writing preferences, not a guarantee of perfect output; always review the draft."
      },
      {
        "id": "ws-mode",
        "title": "AI أم قالب ثابت؟",
        "body": "AI يولّد مسودة ويراجعها. القالب الثابت يحافظ على النص ويبدّل {company_name} و{field} و{role} فقط؛ المتغير الناقص يوقف المعاينة حتى تصلحه.",
        "title_en": "AI or fixed template?",
        "body_en": "AI creates a reviewed draft. A fixed template preserves your wording and substitutes the supported variables."
      },
      {
        "id": "ws-email-tone",
        "title": "إيميل وواتساب منفصلان",
        "body": "ظبط النبرة والطول والبداية والنهاية لكل قناة. الإيميل له عنوان، واتساب رسالة قصيرة بدون عنوان؛ الاختيارات الخاصة بالقناة تُستخدم عند التوليد.",
        "title_en": "Email and WhatsApp differ",
        "body_en": "Set the tone and length for each channel. Email can include a subject; WhatsApp should be concise and easy to read."
      },
      {
        "id": "ws-save",
        "title": "احفظ ثم جرّب",
        "body": "الحفظ يطبق الأسلوب على الطلبات الجديدة. اختر شركة للتجربة وتأكد من النص قبل الإرسال. حفظ مسودة كمرجع يحتاج ضغطك الصريح، ولا يرسلها.",
        "title_en": "Save and try a draft",
        "body_en": "Save your preferences and choose a company for a test draft. This does not send a message; sending requires your normal approval."
      }
    ],
    "settings-ai": [
      {
        "id": "ai-providers",
        "title": "اختار مصدر الذكاء الاصطناعي",
        "body": "ذكاء مرسال هو الافتراضي وموجود ضمن الباقة. تقدر تختار مفاتيحك الشخصية بدلًا منه؛ سعر الباقة ثابت. جرّب ربط منصة واختيار موديل وتفعيلها، وبعدها اختار المصدر واحفظه. استخدام مفاتيحك كبديل تلقائي يحتاج موافقتك. المسودة الناجحة فقط تتخصم؛ المعاينة والتعديل اليدوي والفشل لا تتخصم، والمساعد له حد مستقل.",
        "title_en": "Choose your AI source",
        "body_en": "Mrsaal AI is the included default. Personal keys are optional and do not change your plan price. Connect and enable a personal provider, then select and save your source. Personal fallback requires permission. Only successful drafts count; preview, manual edits and failures do not. The help assistant has its own limit."
      },
      {
        "id": "ai-providers",
        "title": "المفتاح وجلب الموديلات",
        "body": "الصق المفتاح الخاص بنفس المنصة واضغط تحديث القائمة. المفتاح المحفوظ يمكن الاحتفاظ به بترك الخانة فارغة. جلب القائمة وحده لا يحفظ المفتاح.",
        "title_en": "Key and available models",
        "body_en": "Paste a key from the same provider and fetch the model list. Leave the field blank to keep a saved key. Fetching alone does not save it."
      },
      {
        "id": "ai-providers",
        "title": "اختار واختبر",
        "body": "في الخطوة الثانية اختار الأساسي. افتح «اختياري: البدائل وترتيب المنصة» لو محتاج بديلًا أو اثنين. في الخطوة الثالثة اختبر الأساسي؛ الطلب قد يستهلك رصيدًا ولا يختبر البدائل تلقائيًا.",
        "title_en": "Choose and test",
        "body_en": "Choose a primary model. Optional settings contain fallbacks. The test checks the primary model only and may use provider credit."
      },
      {
        "id": "ai-providers",
        "title": "فعّل ورتّب واحفظ",
        "body": "التفعيل والأولوية موجودان داخل الخيارات الاختيارية في الخطوة الثانية. الرقم الأقل يبدأ أولًا ثم بدائل المنصة. اضغط حفظ في الخطوة الثالثة لتطبيق الاختيار. لحفظ المفاتيح دون استخدامها، سيب المصدر على ذكاء مرسال. لتشغيلها اختار المصدر الشخصي واحفظه.",
        "title_en": "Enable, prioritise and save",
        "body_en": "Enable the provider and set its priority in optional settings. Lower numbers run first, then their fallbacks. Save to apply your choices."
      },
      {
        "id": "ai-providers",
        "title": "المجاني وحدود الاستخدام",
        "body": "OpenRouter يعرض المجاني فقط افتراضيًا؛ إلغاء الاختيار قد يسمح بتكلفة. باقي المنصات حسب حسابك ورصيدك. نجاح الاختبار الآن لا يضمن عدم الوصول للحد لاحقًا. تقييد الطلبات المؤقت يختلف عن استهلاك الحصة اليومية؛ راجع نوع الخطأ. مرسال يعيد المحاولة مرة واحدة للأخطاء المؤقتة القصيرة ثم ينتقل للبدائل المحددة، ولا يتجاوز مواعيد الانتظار أو حدود الحساب.",
        "title_en": "Free models and quotas",
        "body_en": "OpenRouter defaults to free models. Other providers depend on your account and credit. Temporary limits differ from daily quotas. Mrsaal respects waiting times and uses configured fallbacks."
      }
    ],
    "preview": [
      {
        "id": "preview-channel",
        "title": "اختيار قناة هذه الرسالة",
        "body": "اختار الإيميل أو الواتساب للشركة. تغيير الاختيار يولد مسودة جديدة مناسبة للقناة. لو بياناتها ناقصة مش هنرسل؛ ممكن تختار القناة التانية بنفسك.",
        "title_en": "Choose this message channel",
        "body_en": "Changing the channel creates a new draft. Companies missing the selected contact details are skipped rather than sent through another channel."
      },
      {
        "id": "prev-company",
        "title": "راجع الشركة والمستلم",
        "body": "تأكد من الاسم والبريد أو الرقم. تصحيح النص لا يصحح بيانات المستلم؛ لو البيانات غلط ارجع إلى مصدر الشركات.",
        "title_en": "Check company and recipient",
        "body_en": "Verify the recipient belongs to the intended company. A valid format does not prove the address or phone reaches the right person."
      },
      {
        "id": "preview-sender",
        "title": "راجع بريد المرسل",
        "body": "في رسائل الإيميل اختار حساب Gmail المرتبط المطلوب. الاختيار لا يغير هوية مرسال، ويتثبت للرسالة لو هتجدولها.",
        "title_en": "Check the sending account",
        "body_en": "For email, verify the connected Gmail account. This account is also retained if the message is scheduled."
      },
      {
        "id": "prev-subject",
        "title": "عنوان واضح",
        "body": "للإيميل فقط. خليه مختصرًا ومناسبًا لسبب التواصل، وراجع أي متغير أو اسم. العنوان لا يظهر في رسالة واتساب.",
        "title_en": "Use a clear subject",
        "body_en": "Keep the email subject accurate and concise. WhatsApp messages do not use an email subject."
      },
      {
        "id": "prev-body",
        "title": "راجع الحقائق والأسلوب",
        "body": "اقرأ المسودة بنفسك، خاصة الخبرات والأسماء والمرفقات. حالة PDF تظهر في المعاينة للإيميل وواتساب؛ «راجع الملف» يفتح الأصل المحفوظ. على واتساب يُرسل المستند والنص كتعليق في رسالة واحدة. الـAI يُطلب منه تدقيق الصياغة ضمن نفس طلب الكتابة لتقليل الانتظار؛ ده مش ضمان للدقة. الحقول تُقفل مؤقتًا أثناء التوليد عشان التعديلات ما تضيعش.",
        "title_en": "Review facts and style",
        "body_en": "Edit the draft to sound like you. Check names, experience, numbers and claims. AI can make mistakes, even after review."
      },
      {
        "id": "writing-note",
        "title": "تعديل محدد أفضل",
        "body": "اكتب مثلًا «احذف المقدمة وخلي الطلب في أول سطر»، أو استخدم الاختصار والتبسيط. التعديل يعيد صياغة المسودة ولا يرسلها.",
        "title_en": "Give specific feedback",
        "body_en": "Use a targeted instruction such as shorten the opening. Your previous draft is kept if revision fails."
      },
      {
        "id": "btn-confirm",
        "title": "اعتمد للإرسال أو الجدولة",
        "body": "راجع توقيت الإرسال المختار قبل التأكيد. زر التأكيد هو تنفيذ الطلب؛ الجولة نفسها لا تضغطه ولا تغير الإعدادات.",
        "title_en": "Approve sending or scheduling",
        "body_en": "Check the attachment and recipient one last time. Approval sends the message or creates the scheduled job according to your selected mode."
      }
    ]
  },
  "topics": [
    {
      "id": "tour",
      "title": "إعادة الجولة",
      "keywords": "جولة شرح توتريال walkthrough spotlight",
      "answer": "اضغط «اشرحلي الصفحة» أعلى التطبيق أو من المساعدة ← ابدأ شرح الصفحة. التالي والسابق للتنقل، والتخطي للخروج. يمكنك إعادة الجولة يدويًا حتى لو أوقفت ظهورها التلقائي. حفظ الإكمال والتخطي على نفس المتصفح للحساب.",
      "action": "tour",
      "title_en": "Replay a walkthrough",
      "answer_en": "Use Page walkthrough in the top bar, or Help → Start page walkthrough. The spotlight highlights a control and explains it. Next and Back move between steps. Skip closes it without changing account data. You can choose to start future tours manually. Tours adapt to the current page and visible controls.",
      "keywords_en": "guide tour walkthrough spotlight tutorial"
    },
    {
      "id": "cv",
      "title": "رفع السيرة من الموبايل",
      "keywords": "pdf سيرة cv موبايل ملف",
      "answer": "1. ارفع ملفًا قابلًا للقراءة: PDF أو TXT حتى 20 MB. على الموبايل استخدم تطبيق الملفات ونزّل الملف من Drive أو واتساب أولًا. لو لا يظهر في الاختيار استخدم اختيار كل الملفات.\n\n2. استنى نتيجة الرفع: رسالة النجاح معناها إن النص اتقرأ واتحفظ. لو الملف تالف أو مصوّر بدون نص، هتظهر رسالة خطأ، وتظل السيرة السابقة محفوظة. جرّب استخراج النص أو ملفًا آخر.\n\n3. راجع النص قبل الكتابة: تأكد إن اسمك وخبراتك والأرقام واضحة. مرسال يستخدم النص ده في AI؛ استخراج PDF قد يغيّر ترتيب السطور، فراجع النتيجة بنفسك.\n\n4. الحفظ اليدوي يحافظ على المرفق: رفع PDF يحفظ النص والمرفق. تعديل النص وحفظه يحافظ على PDF الأصلي ويُرفق بالإيميل أو واتساب؛ تعديل النص لا يغيّر محتوى ملف PDF نفسه. لو السيرة نص فقط ارفع PDF لإرفاقه. ملفات PDF المصوّرة تحتاج OCR خارج مرسال حاليًا.",
      "action": "cv",
      "title_en": "Upload a CV from mobile",
      "answer_en": "In Settings → CV & documents, upload a PDF or TXT up to 20 MB. Download files from Drive or WhatsApp to your device first and use Browse all files if needed. A readable PDF saves both text and the attachment. Scanned PDFs require external OCR. Review extracted text. Saving text edits keeps the original PDF but does not change its contents. If your CV is text-only, upload a PDF to include an attachment. Failed parsing preserves the previous CV.",
      "keywords_en": "pdf cv resume mobile upload attachment document"
    },
    {
      "id": "companies",
      "title": "استيراد الشركات",
      "keywords": "excel xlsx csv شركات أعمدة موبايل",
      "answer": "نموذج Excel: اضغط تنزيل نموذج الشركات من صفحة الشركات. اكتب بياناتك في الورقة الأولى «الشركات» فقط؛ ورقة الأمثلة لا تُستورد. كل صف يحتاج اسمًا وبريدًا أو رقم واتساب دوليًا. لا ترسل للأمثلة الوهمية.\n\n1. رفع الملف مش آخر خطوة: افتح الاستيراد واختار XLSX أو XLS أو CSV/TSV، حتى 10 MB. مرسال يقرأ أول ورقة وأول صف كعناوين؛ بعد القراءة لازم تطابق الأعمدة وتؤكد الاستيراد.\n\n2. اختيار الملف من الموبايل: اختار ملفًا محفوظًا في تطبيق الملفات. لو الملف مش ظاهر استخدم زر «اختار من كل الملفات». لو جاي من Drive أو واتساب نزّله أولًا؛ الرابط أو الصورة مش ملف شركات.\n\n3. طابق عمود اسم الشركة: اختار العمود اللي فيه أسماء الشركات. أول صف لازم يكون عناوين وليس أول شركة؛ غيّر ملفك لو العناوين غير موجودة.\n\n4. اختار بريد المستلم: حدد عمود الإيميل. لو ملفك فيه أرقام فقط سيب الإيميل «لا يوجد»، لكن اختار الهاتف. الإيميل المستخدم هنا بريد الشركة، وليس حساب الإرسال الخاص بك.\n\n5. احتفظ بالرقم كاملًا: اختار عمود الهاتف، ويفضل حفظه كنص في Excel مع كود الدولة. الأصفار اللي اتحذفت من أصل الملف لا يمكن استعادتها تلقائيًا. لو الشركة لها إيميل ورقم، اختار القناة بنفسك من الإرسال أو المعاينة. البيانات الناقصة للقناة تتسجل كتخطي.\n\n6. أكد ثم راجع النتيجة: اضغط استيراد الشركات بعد المطابقة. راجع المضاف والمتخطي؛ الصفوف الناقصة أو الإيميلات غير الصالحة أو المكررة قد تتخطى. رفع الملف وحده لا يضيف البيانات.\n\n7. ابحث عن اللي استوردته: ابحث بالاسم أو الإيميل أو الهاتف أو المجال. لو مش لاقي بياناتك امسح البحث وراجع فلتر الحالة قبل إعادة الاستيراد.\n\n8. افهم حالة الشركة: انتظار: لم تُرسل بعد. أُرسل: الطلب تم. مجدول: في موعد لاحق. فشل: راجع السبب في التقارير. الحالة لا تثبت إن المستلم قرأ الرسالة.\n\n9. اختار ثم عاين: حدد الشركات المطلوبة، وافتح المعاينة لتراجع المستلم والنص قبل الإرسال. اختيار شركة لا يرسل لها تلقائيًا.",
      "action": "companies",
      "title_en": "Import companies",
      "answer_en": "Open Companies → Import companies. Use XLSX, XLS or CSV up to 10 MB. The first sheet is read and its first row contains headers. Map the company name and at least email or phone, then click Import companies. Review added and skipped counts. Missing names or contacts, invalid addresses and duplicates can be skipped. Store phone numbers as text with country codes. Clear search and status filters if records seem missing. Use the downloadable template; examples are on a separate sheet.",
      "keywords_en": "companies company excel spreadsheet csv xlsx import column list contacts"
    },
    {
      "id": "style",
      "title": "أسلوبي في الكتابة",
      "keywords": "كتابة أسلوب لغة تحليل أمثلة",
      "answer": "1. سبب التواصل: اختار سؤالًا عن فرص، أو تقديمًا على وظيفة معلنة فعلًا، أو متابعة لتواصل سابق فعلًا. اختيار الهدف يغيّر معنى الرسالة وليس مجرد نبرتها.\n\n2. الدور المطلوب: اكتب الدور اللي بتدور عليه، مثل مصمم أو مسؤول تسويق. ده هدفك، ولا يُستخدم كخبرة مثبتة إلا لو السيرة تدعمها.\n\n3. اختار لغة الرسالة: اللغة هنا لها أولوية على أمثلة الكتابة والتعليمات المتعارضة. اختار المصري أو العربية أو الخليجي أو الإنجليزية حسب المستلم.\n\n4. أمثلة من كتابتك أنت: ضيف مثالين أو ثلاثة قصار كتبتهم فعلًا. الأمثلة لتقليد طريقة الكلام فقط؛ خبراتك مصدرها السيرة. احذف أسماء أو بيانات لا تحتاج مشاركتها مع مزود AI.\n\n5. حلل ثم اعتمد: الـAI يقترح وصفًا لطريقتك. راجع الوصف وعدّله ثم اضغط الاعتماد وبعدها الحفظ؛ التحليل وحده لا يطبّق الوصف تلقائيًا.\n\n6. استبعد العبارات المزعجة: كل عبارة ممنوعة في سطر، مثل «يسعدني أن أتقدم». أضف تعليمات واضحة بدل طلب عام مثل «خليها بشرية». راجع النتيجة لأن الموديل قد لا يلتزم دائمًا.\n\n7. AI أم قالب ثابت؟: AI يولّد مسودة ويراجعها. القالب الثابت يحافظ على النص ويبدّل {company_name} و{field} و{role} فقط؛ المتغير الناقص يوقف المعاينة حتى تصلحه.\n\n8. إيميل وواتساب منفصلان: ظبط النبرة والطول والبداية والنهاية لكل قناة. الإيميل له عنوان، واتساب رسالة قصيرة بدون عنوان؛ الاختيارات الخاصة بالقناة تُستخدم عند التوليد.\n\n9. احفظ ثم جرّب: الحفظ يطبق الأسلوب على الطلبات الجديدة. اختر شركة للتجربة وتأكد من النص قبل الإرسال. حفظ مسودة كمرجع يحتاج ضغطك الصريح، ولا يرسلها.",
      "action": "template",
      "title_en": "Your writing style",
      "answer_en": "In Settings → Writing preferences, choose purpose, target role, message language and desired next step. Add two or three examples you wrote and remove sensitive details. AI can analyse them to suggest a style description. Approve and save the description before using it. Set tone, length and avoided phrases separately for email and WhatsApp. Save and test on a company creates a draft only. Review factual accuracy before sending. Interface language does not change message language.",
      "keywords_en": "style writing examples tone language analyse preferences"
    },
    {
      "id": "template",
      "title": "القالب الثابت",
      "keywords": "قالب template متغير ثابت",
      "answer": "1. سبب التواصل: اختار سؤالًا عن فرص، أو تقديمًا على وظيفة معلنة فعلًا، أو متابعة لتواصل سابق فعلًا. اختيار الهدف يغيّر معنى الرسالة وليس مجرد نبرتها.\n\n2. الدور المطلوب: اكتب الدور اللي بتدور عليه، مثل مصمم أو مسؤول تسويق. ده هدفك، ولا يُستخدم كخبرة مثبتة إلا لو السيرة تدعمها.\n\n3. اختار لغة الرسالة: اللغة هنا لها أولوية على أمثلة الكتابة والتعليمات المتعارضة. اختار المصري أو العربية أو الخليجي أو الإنجليزية حسب المستلم.\n\n4. أمثلة من كتابتك أنت: ضيف مثالين أو ثلاثة قصار كتبتهم فعلًا. الأمثلة لتقليد طريقة الكلام فقط؛ خبراتك مصدرها السيرة. احذف أسماء أو بيانات لا تحتاج مشاركتها مع مزود AI.\n\n5. حلل ثم اعتمد: الـAI يقترح وصفًا لطريقتك. راجع الوصف وعدّله ثم اضغط الاعتماد وبعدها الحفظ؛ التحليل وحده لا يطبّق الوصف تلقائيًا.\n\n6. استبعد العبارات المزعجة: كل عبارة ممنوعة في سطر، مثل «يسعدني أن أتقدم». أضف تعليمات واضحة بدل طلب عام مثل «خليها بشرية». راجع النتيجة لأن الموديل قد لا يلتزم دائمًا.\n\n7. AI أم قالب ثابت؟: AI يولّد مسودة ويراجعها. القالب الثابت يحافظ على النص ويبدّل {company_name} و{field} و{role} فقط؛ المتغير الناقص يوقف المعاينة حتى تصلحه.\n\n8. إيميل وواتساب منفصلان: ظبط النبرة والطول والبداية والنهاية لكل قناة. الإيميل له عنوان، واتساب رسالة قصيرة بدون عنوان؛ الاختيارات الخاصة بالقناة تُستخدم عند التوليد.\n\n9. احفظ ثم جرّب: الحفظ يطبق الأسلوب على الطلبات الجديدة. اختر شركة للتجربة وتأكد من النص قبل الإرسال. حفظ مسودة كمرجع يحتاج ضغطك الصريح، ولا يرسلها.",
      "action": "template",
      "title_en": "Fixed templates",
      "answer_en": "Choose Fixed template in Writing preferences. Supported variables are {company_name}, {field} and {role}. Write your name yourself. The template preserves your wording and replaces supported variables. Use a blank line between paragraphs. You can request a targeted AI revision from Preview; this does not send a message. Check the subject, recipient and PDF attachment before approving.",
      "keywords_en": "template fixed variables placeholders"
    },
    {
      "id": "whatsapp",
      "title": "ربط واتساب",
      "keywords": "qr واتساب waiting تشفير",
      "answer": "1. حساب Google إضافي: اضغط إضافة حساب Google، اختار البريد ووافق على الصلاحيات. ده حساب إرسال إضافي، لا ينقل الشركات ولا يسجلك بهوية مرسال أخرى.\n\n2. التبديل بين حساباتك: استخدم «استخدم للإرسال» لاختيار المرسل، أو القائمة في المعاينة والإرسال. الحساب المختار ظاهر. الفصل يوقف استخدامه ومتابعة ردوده حتى إعادة الربط، ولا يسجلك خروجًا.\n\n3. امسح QR من واتساب: اضغط الربط، وافتح واتساب على الموبايل ← الأجهزة المرتبطة ← ربط جهاز. امسح الرمز وانتظر الحالة؛ لا تغلق الخطوة قبل التأكد.\n\n4. متصل قبل الإرسال: وجود رقم أو QR لا يكفي؛ الحالة لازم تكون متصل. لو الرسالة لم تصل أو ظهرت Waiting for this message، جرّب رسالة اختبار وراجع الاتصال قبل تكرار مجموعة كاملة.",
      "action": "channels",
      "title_en": "Connect WhatsApp",
      "answer_en": "In Settings → Communication channels, choose Connect WhatsApp and scan the QR code using your primary phone: Linked devices → Link a device. Each user has a separate session. Refresh status and wait for Connected before sending. WhatsApp requires a valid recipient number, but a saved number does not prove it is registered. Missing numbers are skipped. Delivery and reading depend on confirmations from the service. A saved PDF CV can be attached; text-only CVs have no PDF attachment. If linked devices show Waiting for this message, check the primary device and session; the interface cannot guarantee decryption on every linked device.",
      "keywords_en": "whatsapp qr phone pairing waiting encryption connection device"
    },
    {
      "id": "google",
      "title": "حسابات Gmail",
      "keywords": "google gmail جوجل ميل oauth دخول",
      "answer": "1. حساب Google إضافي: اضغط إضافة حساب Google، اختار البريد ووافق على الصلاحيات. ده حساب إرسال إضافي، لا ينقل الشركات ولا يسجلك بهوية مرسال أخرى.\n\n2. التبديل بين حساباتك: استخدم «استخدم للإرسال» لاختيار المرسل، أو القائمة في المعاينة والإرسال. الحساب المختار ظاهر. الفصل يوقف استخدامه ومتابعة ردوده حتى إعادة الربط، ولا يسجلك خروجًا.\n\n3. امسح QR من واتساب: اضغط الربط، وافتح واتساب على الموبايل ← الأجهزة المرتبطة ← ربط جهاز. امسح الرمز وانتظر الحالة؛ لا تغلق الخطوة قبل التأكد.\n\n4. متصل قبل الإرسال: وجود رقم أو QR لا يكفي؛ الحالة لازم تكون متصل. لو الرسالة لم تصل أو ظهرت Waiting for this message، جرّب رسالة اختبار وراجع الاتصال قبل تكرار مجموعة كاملة.",
      "action": "channels",
      "title_en": "Gmail sending accounts",
      "answer_en": "In Communication channels, use Add Google account to connect Gmail through Google OAuth. Select Use for sending to change the sender for new messages. This does not change your Mrsaal sign-in account, companies or CV. Scheduled messages retain their selected account. Disconnecting a sender stops its reply tracking until reconnected. Gmail API and OAuth permissions must be enabled for the configured Google project. Reconnect if permission or token errors persist. Mrsaal does not guarantee inbox placement.",
      "keywords_en": "gmail google email oauth sender accounts connection permissions"
    },
    {
      "id": "preview",
      "title": "مراجعة المسودة",
      "keywords": "معاينة اختصار تعديل رسالة",
      "answer": "1. راجع الشركة والمستلم: تأكد من الاسم والبريد أو الرقم. تصحيح النص لا يصحح بيانات المستلم؛ لو البيانات غلط ارجع إلى مصدر الشركات.\n\n2. راجع بريد المرسل: في رسائل الإيميل اختار حساب Gmail المرتبط المطلوب. الاختيار لا يغير هوية مرسال، ويتثبت للرسالة لو هتجدولها.\n\n3. عنوان واضح: للإيميل فقط. خليه مختصرًا ومناسبًا لسبب التواصل، وراجع أي متغير أو اسم. العنوان لا يظهر في رسالة واتساب.\n\n4. راجع الحقائق والأسلوب: اقرأ المسودة بنفسك، خاصة الخبرات والأسماء والمرفقات. حالة PDF تظهر في المعاينة للإيميل وواتساب؛ «راجع الملف» يفتح الأصل المحفوظ. على واتساب يُرسل المستند والنص كتعليق في رسالة واحدة. الـAI يُطلب منه تدقيق الصياغة ضمن نفس طلب الكتابة لتقليل الانتظار؛ ده مش ضمان للدقة. الحقول تُقفل مؤقتًا أثناء التوليد عشان التعديلات ما تضيعش.\n\n5. تعديل محدد أفضل: اكتب مثلًا «احذف المقدمة وخلي الطلب في أول سطر»، أو استخدم الاختصار والتبسيط. التعديل يعيد صياغة المسودة ولا يرسلها.\n\n6. اعتمد للإرسال أو الجدولة: راجع توقيت الإرسال المختار قبل التأكيد. زر التأكيد هو تنفيذ الطلب؛ الجولة نفسها لا تضغطه ولا تغير الإعدادات.",
      "action": "companies",
      "title_en": "Review a draft",
      "answer_en": "Open Preview on a company. Check the recipient, channel, Gmail sender and CV attachment. Changing the channel creates a new draft. Edit the subject and body, then use specific AI feedback if needed. A failed revision keeps your previous draft. Copying or saving a style reference does not send it. Approve only after checking facts and wording; approval sends or schedules according to the selected mode.",
      "keywords_en": "preview draft message edit rewrite review attachment"
    },
    {
      "id": "send",
      "title": "الإرسال والجدولة",
      "keywords": "إرسال ارسال جدولة وقت scheduled bulk",
      "answer": "من الشركات والتقديم، حدد المستلمين ثم اضغط تجهيز الإرسال. اختار قناة الدفعة: إيميل أو واتساب. الشركة اللي ناقصها بيانات القناة هتتخطى بسبب واضح في التقارير، من غير تحويل تلقائي. تخطي المرسل سابقًا يخص نفس القناة، والجدولة تثبت القناة المختارة.\n\nاختار قناة الدفعة: إيميل أو واتساب. بيانات القناة الناقصة تتسجل كتخطي بسبب واضح، من غير تحويل تلقائي. تخطي المرسل سابقًا يخص نفس القناة. المعاينة والجدولة تحتفظان بالاختيار.\n\n1. حدد المستلمين: الإرسال يخص الشركات المحددة فقط. الفلاتر لا تلغي تحديد الشركات المخفية؛ راجع العدد. راجع عدد الشركات والقناة قبل البدء؛ المستخدم يختار القناة، والشركة اللي ناقصها بياناتها تتخطى من غير تحويل للقناة التانية.\n\n2. من أي Gmail؟: اختار بريد المرسل. القائمة تعرض حسابات Google المرتبطة من قنوات التواصل. التبديل لا يغير حساب تسجيل دخول مرسال. الرسائل المجدولة تُثبت هذا الحساب وقت الجدولة.\n\n3. راجع كل رسالة: تفعيل المعاينة يفتح المسودة لتعدلها وتعتمدها قبل الإرسال. التوليد والمراجعة لا يرسلان الرسالة؛ زر التأكيد هو قرار الإرسال.\n\n4. الوقت المناسب: الآن يبدأ الإرسال عند تأكيدك. في وقت محدد يحتاج تاريخًا ووقتًا في المستقبل؛ المهام تُفحص كل دقيقة، فالتنفيذ ليس مضمونًا في نفس الثانية.\n\n5. حدد موعدًا مستقبلًا: اختار موعدك من الجهاز وراجع التاريخ والوقت. لو عايز تغيير حساب المرسل، اعمله قبل الجدولة؛ تغييره بعد كده لا يبدل الحساب المثبت للرسائل المجدولة.\n\n6. فاصل بين الرسائل: الفاصل ينظم الإرسال المباشر داخل المجموعة. وجود فاصل لا يضمن سماح المنصة بالإرسال أو يمنع حدود الاستخدام. ابدأ برسالة اختبار إلى حسابك.\n\n7. ابدأ بعد المراجعة: السيرة لازم تكون جاهزة، وGmail مصرح له، وواتساب متصل لو فيه مستلمين على واتساب. لو فشل الإرسال راجع التقرير قبل إعادة المحاولة لتجنب تكرار رسالة وصلت.\n\n8. إيقاف المجموعة: الإيقاف يطلب وقف باقي المجموعة في الواجهة؛ لا يسحب رسالة أُرسلت بالفعل. الرسائل المجدولة لا تُلغى بمجرد إغلاق الصفحة.",
      "action": "send",
      "title_en": "Sending and scheduling",
      "answer_en": "In Companies & applications, select recipients and click Prepare sending. Only selected companies are included; filters do not clear selections outside the visible results. Choose Email or WhatsApp and your target set: selected companies. Missing details for that channel are skipped; there is no automatic channel switch. You can skip companies already contacted on the same channel. Preview messages before sending, set a delay and choose now or a future time. Scheduled messages keep their selected Gmail sender. Stop halts remaining batch work, but a message already in progress may finish. Review results before retrying. Account suspension cancels pending scheduled jobs; a general pause postpones new sends until resumed.",
      "keywords_en": "send sending schedule scheduled batch bulk delay time channel skip stop"
    },
    {
      "id": "reports",
      "title": "القراءة والردود",
      "keywords": "تقارير فتح قراءة تسليم ردود",
      "answer": "تقارير الإيميل: «تم رصد فتح البريد» يعني أن صورة صغيرة اتطلبت من البريد، وليس إثبات قراءة الشخص. حجب الصور أو وضع السبام قد يمنع الرصد، والكاش والفحص التلقائي قد يؤثران على النتيجة. غياب الرصد لا يعني عدم القراءة.\n\nالردود: مرسال يقرأ نص آخر رد في المحادثة وينظف الاقتباس من الرسالة السابقة. تُراجع رسائل آخر ٣٠ يومًا كل دقيقة في الخلفية، وكل ٣٠ ثانية أثناء فتح التقارير، بحسب عدد الرسائل واتصال Gmail. افتح تفاصيل الرسالة لقراءة الرد كاملًا ومعرفة توقيته.\n\nالواتساب: تأكيد التسليم والقراءة يختلف عن تتبع صورة الإيميل؛ إعدادات خصوصية المستلم قد تمنع تأكيد القراءة.",
      "action": "report",
      "title_en": "Tracking and replies",
      "answer_en": "Reports show saved sending results and each message timeline. Sent means the service accepted it, not that it was read. Email open tracking uses a small image; blocked images, spam filters or image proxies can affect detection, and image loading is not proof of reading. WhatsApp delivery and reads rely on service confirmations. Gmail replies from the last 30 days are checked in the background and refreshed while Reports is open. Sync replies requests a check when eligible. Open Details for the sent text and latest detected reply. Export CSV downloads your report.",
      "keywords_en": "report reports tracking open read delivery replies timeline sync export"
    },
    {
      "id": "ai",
      "title": "منصات AI والموديلات",
      "keywords": "ai api gemini openrouter openai groq موديل مفتاح بطيء فشل 404 429",
      "answer": "1. اختار مصدر الذكاء الاصطناعي: ذكاء مرسال هو الافتراضي وموجود ضمن الباقة. تقدر تختار مفاتيحك الشخصية بدلًا منه؛ سعر الباقة ثابت. جرّب ربط منصة واختيار موديل وتفعيلها، وبعدها اختار المصدر واحفظه. استخدام مفاتيحك كبديل تلقائي يحتاج موافقتك. المسودة الناجحة فقط تتخصم؛ المعاينة والتعديل اليدوي والفشل لا تتخصم، والمساعد له حد مستقل.\n\n2. المفتاح وجلب الموديلات: الصق المفتاح الخاص بنفس المنصة واضغط تحديث القائمة. المفتاح المحفوظ يمكن الاحتفاظ به بترك الخانة فارغة. جلب القائمة وحده لا يحفظ المفتاح.\n\n3. اختار واختبر: في الخطوة الثانية اختار الأساسي. افتح «اختياري: البدائل وترتيب المنصة» لو محتاج بديلًا أو اثنين. في الخطوة الثالثة اختبر الأساسي؛ الطلب قد يستهلك رصيدًا ولا يختبر البدائل تلقائيًا.\n\n4. فعّل ورتّب واحفظ: التفعيل والأولوية موجودان داخل الخيارات الاختيارية في الخطوة الثانية. الرقم الأقل يبدأ أولًا ثم بدائل المنصة. اضغط حفظ في الخطوة الثالثة لتطبيق الاختيار. لحفظ المفاتيح دون استخدامها، سيب المصدر على ذكاء مرسال. لتشغيلها اختار المصدر الشخصي واحفظه.\n\n5. المجاني وحدود الاستخدام: OpenRouter يعرض المجاني فقط افتراضيًا؛ إلغاء الاختيار قد يسمح بتكلفة. باقي المنصات حسب حسابك ورصيدك. نجاح الاختبار الآن لا يضمن عدم الوصول للحد لاحقًا. تقييد الطلبات المؤقت يختلف عن استهلاك الحصة اليومية؛ راجع نوع الخطأ. مرسال يعيد المحاولة مرة واحدة للأخطاء المؤقتة القصيرة ثم ينتقل للبدائل المحددة، ولا يتجاوز مواعيد الانتظار أو حدود الحساب.",
      "action": "ai",
      "title_en": "AI providers and models",
      "answer_en": "In Settings → AI providers, Mrsaal AI is included by default. Personal providers are optional; choose and save your source explicitly. Your plan price remains unchanged. Only successful drafts use credits; preview, edits and failures do not. The assistant has a separate counter. For personal providers, follow Key, Model, Test & Save. Use the Connection guide for official key links. Fetching models does not save the key. Choose a primary model and optional fallbacks; lower provider priority numbers run first. Enable and save the provider. Tests check the primary model only and may use credit. OpenRouter defaults to free models, which still have quotas. 401/403 indicate key or access problems; 402 often indicates credit; 404 an unavailable model; 429 quota or request limits. A new key does not guarantee a new quota. Try a smaller model for timeouts and keep the mobile tab open. Mrsaal AI is the default; personal providers run only when selected or explicitly allowed as a fallback. Successful personal drafts do not spend included Mrsaal credits, but provider fees and daily protection limits may apply.",
      "keywords_en": "ai api gemini openrouter openai groq model key quota timeout slow 404 429"
    },
    {
      "id": "setup",
      "title": "تجهيز الحساب",
      "keywords": "خطوات تخطي skip إعداد جاهز",
      "answer": "1. ابدأ بثلاث خطوات: ارفع سيرتك، اربط قنوات التواصل، وظبط أسلوب الكتابة. الشريط يحسب المكتمل فعليًا؛ الخطوة المتخطاة لا تُحسب مكتملة.\n\n2. كمّل اللي تحتاجه: كل كارت يفتح إعداد الخطوة. ممكن تتخطاه وترجع له من الإعدادات. لو هتبعت على Gmail فقط، مش لازم تربط واتساب.",
      "action": "account",
      "title_en": "Set up your account",
      "answer_en": "Quick setup helps you prepare a CV, WhatsApp if needed and writing preferences. Completed or skipped steps disappear from the remaining list. Skipping does not delete your account data; return from Settings → Show setup steps. Google sign-in and Gmail senders are separate. WhatsApp pairing is only necessary if you choose WhatsApp. The Home next-step card adapts to your actual saved data.",
      "keywords_en": "setup onboarding skip ready steps account"
    },
    {
      "id": "tickets",
      "title": "التواصل مع الدعم ومتابعة الشكوى",
      "keywords": [
        "شكوى",
        "شكواي",
        "دعم",
        "مشكلة",
        "تذكرة",
        "تواصل",
        "إدارة"
      ],
      "answer": "اضغط مساعدة أسفل الصفحة، ثم تواصل مع الدعم. اختار شكوى جديدة، اكتب عنوانًا والقسم والخطوات التي أدت للمشكلة. لا تشارك مفاتيح API أو كلمات مرور. الشكوى وبريد حسابك يظهران لمسؤول الدعم. تابع الردود من تذاكري أو إشعارات الجرس؛ شوف التفاصيل يفتح التذكرة. لا يوجد إشعار بريد تلقائي. سجل التشخيص يحتفظ بالقسم ورمز HTTP والتوقيت لمدة 30 يومًا؛ لا يسجل نص السيرة أو الرسائل. المساعد يفهم المحادثة ويصيغ شرحًا من الدليل، بدون تنفيذ تغييرات. سياق آخر ٦ رسائل في الذاكرة لمدة ٣٠ دقيقة ويمكن مسحه بمحادثة جديدة. لوحة الإدارة متاحة فقط للحسابات التي يحددها صاحب مرسال على السيرفر.",
      "action": "tickets",
      "title_en": "Contact support and follow a ticket",
      "answer_en": "Open Help → Contact support. Describe your steps, expected result and actual result. Never share API keys, passwords or sensitive documents. Your ticket and account email are visible to support. Replies are in My tickets and the notification centre; View details opens the ticket. There is no automatic email notification. Diagnostics retain the category, HTTP status and time for 30 days, not CV or message content. The assistant explains the product but cannot change your account. Conversation context stores the last six messages in memory for 30 minutes and can be cleared with New conversation. Admin access is restricted to accounts authorised by the owner.",
      "keywords_en": "support help ticket complaint issue contact admin dashboard"
    },
    {
      "id": "notifications",
      "title": "الإشعارات والتحديثات",
      "keywords": [
        "إشعارات",
        "اشعارات",
        "جرس",
        "تنبيه",
        "صوت",
        "تحديث",
        "نوتفكيشن",
        "متصفح"
      ],
      "answer": "الجرس أعلى مساحة مرسال يعرض عدد غير المقروء. منه تتابع رصد فتح البريد والردود، تأكيد تسليم وقراءة ورد واتساب، نتائج الجدولة، ردود الدعم وحالات التذاكر، والتحديثات المنشورة. الفتح مؤشر تحميل صور وليس إثبات قراءة. إشعارات الفتح والتسليم والجدولة تتجمع خلال خمس دقائق؛ نفس الحدث لا يتكرر. شوف التفاصيل يفتح التقرير أو التذكرة؛ تحديد كمقروء لا يمسح السجل. من ترس الإشعارات أو الإعدادات ← حسابك ← إعدادات الإشعارات اختار الأنواع والصوت والتنبيه الصغير. الصوت والمتصفح مقفولان افتراضيًا. تفعيل على هذا الجهاز يطلب إذن المتصفح، ويتطلب HTTPS ودعم Push؛ بعض أجهزة الموبايل تحتاج إضافة مرسال للشاشة الرئيسية. إيقاف لكل الأجهزة يمنع Push، وفصل هذا الجهاز يلغي اشتراك الجهاز فقط. تنبيه شاشة القفل عام ولا يحتوي نصوص الردود. إشعارات الموقع تتحدث كل 30 ثانية أثناء فتح الصفحة؛ رد Gmail يعتمد على المزامنة التي تعمل كل دقيقة. الإشعارات محفوظة 90 يومًا. الأدمن يمكنه نشر إعلان تحديث عربي وإنجليزي من تحديثات وإشعارات، وتوصله التذاكر الجديدة والأخطاء المتكررة. لا يوجد إرسال بريد تلقائي للإشعارات. بعد تفعيل الصوت اضغط تجربة صوت الإشعار مرة لفتح الصوت في المتصفح. الصوت خارج الموقع يعتمد على إعدادات النظام؛ صلاحية الإشعارات وحدها لا تفتح تشغيل الصوت داخل الصفحة.",
      "action": "notifications",
      "title_en": "Notifications and product updates",
      "answer_en": "Open the bell at the top of the workspace to see unread notifications: replies, email-open indicators, WhatsApp delivery/read/reply confirmations, scheduled-send results, ticket replies and statuses, and product updates. Email opens are image-load indicators, not proof of reading. Opens, receipts and scheduled events are grouped within five minutes and deduplicated. View details opens the original report or ticket; marking read does not delete records. Choose event types, in-app toasts, sound and browser push from the gear or Settings → Account → Notification settings. Sound and browser push are off by default. Enable on this device requests permission and requires HTTPS and Push support; some phones require adding Mrsaal to the Home Screen. Disable on all devices blocks push; Disconnect this device removes only that subscription. Lock-screen alerts contain no personal reply text. In-app alerts refresh every 30 seconds while visible; Gmail replies depend on the one-minute sync. Notifications are kept for 90 days. Admins can publish bilingual product updates and receive new ticket/repeated-error alerts. Notifications do not send automatic emails. After enabling sound, tap Test notification sound to unlock browser audio. Background sound is controlled by device settings; notification permission alone does not unlock page audio.",
      "keywords_en": "notifications bell unread alert push browser sound updates ticket reply"
    },
    {
      "id": "campaigns",
      "title": "حملات الإرسال والمسودات",
      "title_en": "Campaigns and saved drafts",
      "keywords": [
        "حملة",
        "حملات",
        "مسودة",
        "اكتب",
        "معاينة",
        "استكمال",
        "توقيف"
      ],
      "keywords_en": "campaign review draft write pause resume cancel",
      "answer": "فتح المعاينة يحمل آخر مسودة محفوظة أو الرسالة السابقة ولا يبدأ AI. اكتب بنفسك أو اضغط اكتب؛ بعد وجود نص يظهر إعادة الكتابة. تقدر تعدّل العنوان والنص قبل الإرسال. حفظ التعديلات تلقائي بعد نصف ثانية. زر بدء الإرسال للشركات المختارة ينشئ حملة: راجع كل رسالة واضغط اعتماد هذه المسودة ثم ابدأ. لا يبدأ إرسال رسالة غير معتمدة. الحملة تعمل على السيرفر حتى لو قفلت الصفحة، ويمكن إيقافها مؤقتًا واستكمالها أو إلغاء المتبقي. الرسالة الجاري إرسالها قد تصل بعد الإيقاف. uncertain معناها النتيجة غير مؤكدة؛ راجع القناة قبل إعادة الإرسال. تغيير المستلم بعد المراجعة يوقف الحملة.",
      "answer_en": "Preview loads a saved draft or previous message without requesting AI. Write manually or press Write; an existing body changes the action to Rewrite. Edit subject and body before sending; changes autosave after half a second. Starting a selected-company batch creates a campaign: review and approve every draft before starting. Unapproved messages are blocked. The server continues after you close the page. Pause, resume or cancel remaining items. An in-flight message may still arrive after pausing. Uncertain results require checking the channel before retrying. Changing a recipient after review pauses sending.",
      "action": "companies"
    },
    {
      "id": "account-email",
      "title": "تسجيل البريد وحفظ بياناتك",
      "title_en": "Email login and your data",
      "keywords": [
        "سوبابيز",
        "تسجيل",
        "باسورد",
        "كلمة",
        "حذف",
        "تصدير",
        "حدود"
      ],
      "keywords_en": "supabase email login password account export delete limits",
      "answer": "تسجيل البريد يعمل عند تفعيل Supabase من مسؤول الموقع. أنشئ حسابًا وأكد البريد من الرسالة، ثم ادخل بكلمة المرور. نسيت كلمة المرور يرسل رابط الاستعادة. لو عندك حساب Google سابق بنفس البريد، سجل Google واربط تسجيل البريد من إعدادات الحساب بعد تأكيد حساب البريد. ربط Gmail مستقل عن الدخول ويطلب صلاحيات الإرسال والمتابعة فقط عند الربط. من إعدادات الحساب تقدر تشوف استخدامك اليومي وتصدّر بياناتك أو تحذف الحساب بعد التأكيد. الحذف الكامل لهوية Supabase يحتاج تفعيل الإدارة على السيرفر. لا تحذف أثناء إرسال نشط.",
      "answer_en": "Email login is available after the administrator enables Supabase. Create an account, verify your email, then sign in. Forgot password sends a reset link. For an existing Google account, sign in with Google and link verified email login from Account settings. Gmail permissions are requested separately when linking a sending channel. Account settings show daily usage, data export and confirmed account deletion. Complete Supabase identity deletion requires server-side administration setup. Active sending must finish or be stopped before deletion.",
      "action": "account"
    },
    {
      "id": "cv-versions",
      "title": "نسخ CV وقوائم المتابعة",
      "title_en": "CV versions and follow-up lists",
      "keywords": [
        "نسخ",
        "سيرة",
        "متابعة",
        "تذكير",
        "قوائم"
      ],
      "keywords_en": "CV versions list follow up reminder notes",
      "answer": "كل رفع سيرة يحفظ نسخة جديدة ولا يمسح النسخ القديمة. من إعدادات السيرة افتح نسخ السيرة الذاتية وحدد النسخة المستخدمة. تعديل النص يحفظ نسخة ويحافظ على مرفق PDF الموجود، لكن لا يغير نص ملف PDF الأصلي. الحملة تثبت نسخة السيرة وقت إنشائها. من الشركات افتح القوائم والمتابعة لتسمية قائمة وتسجيل ملاحظات ومرحلة التقديم وموعد تذكير. هذه متابعة تقديمك وليست البحث عن وظائف.",
      "answer_en": "Each CV upload saves a new version. Open CV versions in Settings and select your active CV. Editing text preserves the original PDF attachment but does not rewrite the PDF. Campaigns pin the chosen CV version when created. From Companies, open Lists and follow-up to record a list name, private notes, application stage and reminder date. This tracks your applications; it does not search for jobs.",
      "action": "cv"
    }
  ]
};});
