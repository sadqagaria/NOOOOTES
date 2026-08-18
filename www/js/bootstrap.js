// Use the Capacitor bundle inside the native app; otherwise run the dependency-free web modules.
(function () {
  const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  if (isNative) {
    const script = document.createElement('script');
    script.src = './js/app.bundle.js';
    script.defer = true;
    document.head.appendChild(script);
  } else {
    import('./app.web.js').catch(err => {
      console.error('Failed to start My Life web app', err);
      document.body.innerHTML = '<main style="font-family:Arial,sans-serif;padding:24px;direction:rtl"><h1>تعذر تشغيل التطبيق</h1><p>ارفع الملفات إلى GitHub Pages أو شغّلها من خادم محلي بسيط.</p></main>';
    });
  }
})();
