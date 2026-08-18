# My Life — Personal Organizer

تطبيق منظم حياة شخصي Offline-first مبني بـ HTML5 + CSS3 + Vanilla JavaScript، مع IndexedDB للبيانات الكبيرة وCapacitor لتغليف التطبيق على Android.

## الموجود في V1

- Dashboard متجاوب عربي RTL.
- Notes فعلية مع Plain Text وRich Text وترتيب Blocks ومرفقات صور/فيديو/صوت/PDF/Word/TXT وروابط.
- التقاط صورة من كاميرا المتصفح/الهاتف عند الدعم.
- تسجيل صوتي عبر MediaRecorder.
- Favorite + Pin + Tags + Categories + 16 ألوان + خلفيات خفيفة.
- Expense Tracker مع إجمالي تلقائي، فلاتر، إحصائيات، Calculator، حذف وUndo وReset.
- Reminders مع مرة واحدة/يومي/أسبوعي/شهري/سنوي.
- Android Local Notifications عبر Capacitor عند بناء APK.
- File Manager محلي مع Open/Download/Rename/Delete.
- Global Search.
- Light / Dark / System + Accent Color.
- Export/Import JSON للبيانات المنظمة. ملفات الوسائط الكبيرة لا يتم تضمينها في JSON في V1؛ ZIP backup للوسائط خطوة لاحقة.
- PWA + Service Worker + Offline cache.
- GitHub Actions لبناء APK وللنشر على GitHub Pages.

## التشغيل على الكمبيوتر

يتطلب Node.js 22 أو أحدث.

```bash
npm install
npm run build
npx serve www
```

أو استخدم أي static server على مجلد `www`.

## بناء Android محليًا

```bash
npm install
npm run build
npx cap add android
npm run patch:android
npx cap sync android
npx cap open android
```

بعدها Build من Android Studio، أو:

```bash
cd android
./gradlew assembleDebug
```

ملف APK سيكون في:

`android/app/build/outputs/apk/debug/app-debug.apk`

## البناء من GitHub بدون Android Studio

1. ارفع المشروع كله إلى Repository واجعل الفرع الرئيسي `main`.
2. افتح تبويب **Actions**.
3. افتح Workflow باسم **Build Android APK**.
4. شغّل **Run workflow**، أو اعمل Push جديد على `main`.
5. بعد اكتمال البناء افتح الـ Run ثم نزّل Artifact باسم `my-life-debug-apk`.
6. فك الضغط وستجد `app-debug.apk` لتثبيته على Android.

## ملاحظات مهمة

- الـ APK الناتج من GitHub Action هو Debug APK للتجربة والتثبيت المباشر، وليس إصدار Google Play موقعًا بمفتاح Production.
- الإشعارات الأصلية تستخدم `@capacitor/local-notifications` في Android.
- Service Worker يتم تسجيله على الويب/PWA فقط، وليس داخل Capacitor Native، لتجنب التعارض مع حقن Capacitor Plugins.
- البيانات الأساسية والوسائط تحفظ محليًا في IndexedDB، لذلك حذف بيانات التطبيق/المتصفح يحذفها إذا لم تكن لديك نسخة احتياطية.
