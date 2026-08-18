# My Life — نسخة ويب HTML + جاهزة للموبايل

## 1) نسخة الويب
ملفات الويب الجاهزة موجودة داخل مجلد `www`.

الملف الرئيسي:

`www/index.html`

ارفع المشروع كاملًا إلى GitHub. يوجد Workflow باسم:

`Deploy Web App to GitHub Pages`

وسينشر محتويات `www` كنسخة Web/PWA.

> لا تحتاج إلى npm لتشغيل نسخة الويب المنشورة على GitHub Pages.

## 2) تحويل نفس المشروع إلى Android APK
لا تحذف `src` أو `package.json` أو `capacitor.config.json` أو `.github/workflows/android-apk.yml`.

من GitHub Actions شغّل:

`Build Android APK`

هذا الـ Workflow يقوم بتثبيت Dependencies، وإنشاء Bundle الخاص بـ Capacitor، وإنشاء مشروع Android ثم بناء `app-debug.apk`.

## 3) لماذا يوجد Web وNative معًا؟
- على GitHub Pages: التطبيق يشغّل `www/js/app.web.js` ولا يحتاج Capacitor.
- داخل Android: التطبيق يشغّل `www/js/app.bundle.js` الناتج من Build ويستخدم Capacitor للتنبيهات المحلية.

بهذا تملك نسخة ويب حقيقية، وفي نفس Repository يمكنك استخراج APK لاحقًا.
