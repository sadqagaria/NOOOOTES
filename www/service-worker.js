const CACHE='mofakkirati-glass-v1';
const ASSETS=[
  './','./index.html','./css/style.css','./css/mofakkirati-theme.css','./manifest.webmanifest',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './js/bootstrap.js','./js/app.web.js','./js/capacitor-web.js',
  './js/utils.js','./js/storage.js','./js/notes.js','./js/expenses.js',
  './js/reminders.js','./js/files.js','./js/search.js','./js/settings.js'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response;}).catch(()=>caches.match('./index.html'))));
});
