# التجربة والنسخ الاحتياطي

## Staging
- أنشئ تطبيق Coolify ثانيًا من نفس المستودع على `staging.mrsaal.ebnhussein.co`، وقاعدة PostgreSQL مستقلة.
- قيم BASE_URL وGOOGLE_REDIRECT_URI وأسرار التشفير ومشروع Supabase مختلفة عن الإنتاج.
- لا تستخدم بيانات أو اتصالات المستخدمين الحقيقيين في staging. استخدم بريدك ورقمك فقط للتجربة.
- كل Pull Request يمر باختبار GitHub Actions قبل دمجه. npm ci يستخدم package-lock.json.
- النشر والتفعيل الفعلي في Coolify لم يُنفذ من هذه الملفات.

## النسخ الخارجية
سكربت ops/backup.sh يستخدم restic لتشفير نسخة PostgreSQL والمشروع وأسرار فك تشفير القنوات. اضبط الملف النموذجي على السيرفر، وثبّت restic، ثم نفّذ restic init مرة واحدة للمخزن الخارجي. لا تستخدم مخزنًا على نفس VPS فقط.

انسخ وحدتي service وtimer إلى /etc/systemd/system وعدّل مسار ExecStart إلى مشروعك، ثم:

```bash
sudo chmod 600 /etc/mrsaal-backup.env /etc/mrsaal-restic-password
sudo chmod +x /opt/mrsaal/ops/backup.sh
sudo systemctl daemon-reload
sudo systemctl enable --now mrsaal-backup.timer
sudo systemctl start mrsaal-backup.service
sudo journalctl -u mrsaal-backup.service --no-pager
```

اختر اسم حاوية PostgreSQL الخاصة بمرسال، لا coolify-db. APP_ENV_FILE يجب أن يحتوي على إعدادات التطبيق الفعلية: SESSION_SECRET وCONNECTIONS_SECRET وWHATSAPP_AUTH_SECRET وبيانات DB. فقدانها يمنع فك الأسرار.

## اختبار الاستعادة
1. restic snapshots --tag mrsaal ثم restic restore SNAPSHOT_ID --target /tmp/mrsaal-restore.
2. استرجع database.dump إلى قاعدة staging فارغة بـ pg_restore. لا تسترجع فوق قاعدة الإنتاج.
3. تحقق من عدد المستخدمين والشركات وPDF والحملات والتذاكر وإعدادات AI والإشعارات.
4. استخدم الأسرار الأصلية فقط لفحص فك التشفير في بيئة معزولة؛ لا تشغّل الجدولة أو جلسات واتساب المستعادة بالتوازي مع الإنتاج.
5. سجل تاريخ النسخة ووقت الاستعادة والنتيجة. فحص restic وحده لا يثبت صلاحية تشغيل التطبيق المستعاد.

النسخ الخارجية غير مفعّلة قبل إدخال بيانات المخزن وتشغيل الوحدات على السيرفر. اختبار استعادة بياناتك الحقيقية لم يتم هنا.
