// Load the bundled Android application. Keep the UI visible on any failure.
(function () {
  const showError = function (message) {
    document.body.classList.add('ready');
    if (document.getElementById('startup-error')) return;
    const el = document.createElement('div');
    el.id = 'startup-error';
    el.setAttribute('role', 'alert');
    el.dir = 'rtl';
    el.style.cssText = 'position:fixed;z-index:99999;top:15px;left:15px;right:15px;background:#fff4e4;border:1px solid #ddb46a;color:#6c4410;padding:15px;border-radius:13px;box-shadow:0 8px 25px #0002;font:15px Tahoma,Arial,sans-serif';
    const text = document.createElement('div');
    text.textContent = message || 'تعذر بدء تشغيل بعض المميزات.';
    const retry = document.createElement('button');
    retry.textContent = 'إعادة المحاولة';
    retry.style.cssText = 'margin-top:10px;padding:7px 14px;border:1px solid #b68c4c;border-radius:8px;background:white';
    retry.onclick = () => location.reload();
    el.append(text, retry);
    document.body.appendChild(el);
  };
  window.addEventListener('error', function (event) {
    if (!document.body.classList.contains('ready')) {
      console.error('Application startup error', event.error || event.message);
      showError('حصل خطأ أثناء بدء التطبيق. يمكنك إعادة المحاولة؛ بياناتك لم يتم حذفها.');
    }
  });
  window.addEventListener('unhandledrejection', function (event) {
    if (!document.body.classList.contains('ready')) {
      console.error('Application startup promise error', event.reason);
      showError('تعذر تحميل بيانات التطبيق. أعد المحاولة بدون حذف بياناته.');
    }
  });
  const script = document.createElement('script');
  script.src = './js/app.bundle.js';
  script.async = false;
  script.onerror = function () {
    console.error('Native bundle unavailable; trying web entrypoint');
    import('./app.web.js').catch(function (err) {
      console.error('Web fallback failed', err);
      showError('لم يتم العثور على ملفات تشغيل التطبيق. أعد تثبيت النسخة السليمة.');
    });
  };
  document.head.appendChild(script);
})();
