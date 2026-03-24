# ✉️ مرسال — أداة التقدم الذكي للوظائف

أداة ويب متعددة المستخدمين لإرسال إيميلات ورسائل تقديم مخصصة لكل شركة تلقائياً عبر Gmail وواتساب، مدعومة بـ **Google Gemini AI**.

---

## 🚀 الرفع على Railway + Hostinger

### لماذا Railway؟
- ✅ مجاني (رصيد $5/شهر — كافي للاستخدام العادي)
- ✅ يدعم Node.js بشكل مثالي
- ✅ يتربط بـ subdomain على Hostinger بسهولة
- ✅ لا يحتاج خبرة في السيرفرات

---

## الخطوة 1: إعداد Google OAuth

1. اذهب إلى [console.cloud.google.com](https://console.cloud.google.com)
2. اضغط **New Project** → سمّيه `mrsaal`
3. من القائمة → **APIs & Services** → **Library** → ابحث عن **Gmail API** → **Enable**
4. اذهب إلى **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. في **Authorized redirect URIs** أضف:
   ```
   https://mrsaal.yourdomain.com/auth/google/callback
   ```
7. احفظ الـ **Client ID** و **Client Secret**

> ⚠️ في **OAuth consent screen**: أضف بريد كل مستخدم كـ **Test User** أو اطلب **Publish** للوصول العام

---

## الخطوة 2: رفع المشروع على Railway

### أ) عبر GitHub (الأسهل):

1. اعمل **repository جديد** اسمه `mrsaal` على GitHub
2. ارفع ملفات المشروع:
   ```bash
   cd mrsaal
   git init
   git add .
   git commit -m "first commit"
   git remote add origin https://github.com/USERNAME/mrsaal.git
   git push -u origin main
   ```
3. اذهب إلى [railway.app](https://railway.app) → سجّل دخول بـ GitHub
4. اضغط **New Project** → **Deploy from GitHub repo** → اختر `mrsaal`
5. Railway سيكتشف Node.js تلقائياً ويبدأ البناء ✅

---

## الخطوة 3: إضافة Environment Variables على Railway

في لوحة Railway → مشروعك → **Variables** → أضف هذه المتغيرات:

```
GEMINI_API_KEY        = AIzaSyxxxxxxxxx
GOOGLE_CLIENT_ID      = xxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET  = GOCSPX-xxxxxxxxx
GOOGLE_REDIRECT_URI   = https://mrsaal.yourdomain.com/auth/google/callback
BASE_URL              = https://mrsaal.yourdomain.com
SESSION_SECRET        = نص_عشوائي_طويل_جداً
NODE_ENV              = production
PORT                  = 3000
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = true
```

> 💡 لتوليد SESSION_SECRET آمن:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## الخطوة 4: ربط Subdomain من Hostinger

### أ) احصل على Railway CNAME:
1. Railway → مشروعك → **Settings** → **Domains**
2. اضغط **Add Custom Domain** → اكتب: `mrsaal.yourdomain.com`
3. Railway سيعطيك CNAME مثل: `mrsaal-production.up.railway.app`

### ب) أضف DNS Record على Hostinger:
1. اذهب إلى [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. دومينك → **DNS / Nameservers** → **DNS Records** → **Add Record**

```
Type:  CNAME
Name:  mrsaal
Value: mrsaal-production.up.railway.app.
TTL:   3600
```

3. احفظ — انتظر 5-30 دقيقة لانتشار الـ DNS
4. Railway سيفعّل SSL تلقائياً (Let's Encrypt مجاني) ✅

---

## الخطوة 5: تحديث Google OAuth

ارجع إلى Google Cloud Console → **Credentials** → OAuth Client:
- تأكد وجود: `https://mrsaal.yourdomain.com/auth/google/callback` ✅

---

## ✅ اختبار التثبيت

1. افتح `https://mrsaal.yourdomain.com`
2. يجب أن تظهر شاشة تسجيل الدخول بـ Google
3. سجّل دخولك → يجب أن تنتقل للأداة مباشرة
4. جرّب رفع CV وإيميل تجريبي

---

## 📊 حدود الاستخدام المجاني

| الخدمة | الحد المجاني |
|--------|-------------|
| Railway | $5/شهر رصيد ≈ 500 ساعة تشغيل |
| Gmail API | 100 إيميل/يوم |
| Gemini API | مجاني (حتى 15 طلب/دقيقة) |
| Open Tracking | مجاني (مدمج) |

---

## ❓ مشاكل شائعة

**"redirect_uri_mismatch"** → تأكد أن الـ URI في Google Console مطابق حرفياً لـ `GOOGLE_REDIRECT_URI` في Railway

**"Application not verified"** → أضف بريد المستخدم كـ Test User في Google OAuth consent screen

**الـ subdomain مش شغال** → انتظر 30 دقيقة لانتشار DNS، تحقق من CNAME في Hostinger

**الإيميلات مش بتتبعت** → تأكد أن `BASE_URL` = `https://mrsaal.yourdomain.com` (بدون / في النهاية)

---

## 📁 هيكل المشروع

```
mrsaal/
├── server.js              # نقطة الدخول
├── railway.json           # إعدادات Railway
├── Procfile               # أمر التشغيل
├── .gitignore
├── public/
│   └── index.html         # الواجهة الكاملة
├── routes/
│   ├── auth.js            # Google OAuth
│   ├── companies.js       # إدارة الشركات
│   ├── cv.js              # السيرة الذاتية والقوالب
│   ├── email.js           # Email & WhatsApp Logic
│   └── tracking.js        # Open tracking pixel
├── utils/
│   ├── db.js              # SQLite
│   ├── gmail.js           # Gmail API
│   ├── ai.js              # Google Gemini API
│   └── scheduler.js       # Cron جدولة
└── middleware/
    └── auth.js
```
