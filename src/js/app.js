import { Capacitor } from '@capacitor/core';
import { initDocumentStudio } from './document-studio.js';
import { $, $$, escapeHTML, formatMoney } from './utils.js';
import { initNotesUI, renderNotes, getNotes, openNoteEditor, setNotesRefreshCallback } from './notes.js';
import { initExpensesUI, renderExpenses, getExpenseStats, openExpenseDialog, setExpensesRefreshCallback } from './expenses.js';
import { initRemindersUI, renderReminders, getReminders, openReminderDialog, startWebReminderWatcher, setRemindersRefreshCallback } from './reminders.js';
import { initFilesUI, renderFiles, getFiles, setFilesRefreshCallback } from './files.js';
import { initSettingsUI, applySettings, setSettingsRefreshCallback } from './settings.js';
import { globalSearch } from './search.js';

let activeSection='home';
let noteView=localStorage.getItem('noteView')||'grid';
let expenseFilter='all';

async function refreshAll(){
  await refreshDashboard();
  if(activeSection==='notes') await renderNotes($('#notes-container'),{search:$('#notes-search').value,category:$('#notes-category-filter').value,view:noteView});
  if(activeSection==='expenses') await renderExpenses($('#expenses-container'),expenseFilter);
  if(activeSection==='reminders') await renderReminders($('#reminders-container'));
  if(activeSection==='files') await renderFiles($('#files-container'));
}

async function refreshDashboard(){
  const [notes,stats,reminders,files]=await Promise.all([getNotes(),getExpenseStats(),getReminders(),getFiles()]);
  $('#metric-notes').textContent=notes.length;
  $('#metric-expenses').textContent=formatMoney(stats.total);
  const now=new Date(); const future=reminders.filter(r=>new Date(r.dateTime)>=now || r.repeat!=='once');
  $('#metric-reminders').textContent=future.length;
  const noteAttachments=notes.reduce((sum,n)=>sum+(n.blocks||[]).filter(b=>['image','video','audio','pdf','file'].includes(b.type)).length,0);
  $('#metric-files').textContent=files.length+noteAttachments;
  $('#home-date').textContent=new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const recent=notes.slice(0,3);
  $('#recent-notes').innerHTML=recent.length?recent.map(n=>`<button class="recent-note" data-recent-note="${n.id}"><span>📝</span><div><strong>${escapeHTML(n.title||'بدون عنوان')}</strong><small>${new Date(n.updatedAt).toLocaleDateString('ar-EG')}</small></div></button>`).join(''):`<div class="mini-empty">لا توجد ملاحظات حتى الآن.</div>`;
  $$('[data-recent-note]').forEach(b=>b.onclick=()=>openNoteEditor(b.dataset.recentNote));
}

function showSection(name){
  activeSection=name;
  $$('.app-section').forEach(s=>s.classList.toggle('active',s.dataset.section===name));
  $$('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  $('#page-title').textContent=({home:'الرئيسية',notes:'الملاحظات',expenses:'مصاريفي',reminders:'تنبيهاتي',files:'ملفاتي',settings:'الإعدادات'})[name]||'My Life';
  closeFab();
  refreshAll();
}

function openFab(){ $('#fab-menu').classList.add('open'); $('#main-fab').classList.add('open'); }
function closeFab(){ $('#fab-menu').classList.remove('open'); $('#main-fab').classList.remove('open'); }

async function renderSearch(){
  const q=$('#global-search').value;
  const box=$('#global-results');
  if(!q.trim()){box.hidden=true;box.innerHTML='';return;}
  const results=await globalSearch(q); box.hidden=false;
  box.innerHTML=results.length?results.slice(0,20).map(r=>`<button class="search-result" data-type="${r.type}" data-id="${r.id}"><span>${r.icon}</span><div><strong>${escapeHTML(r.title)}</strong><small>${escapeHTML(r.subtitle||'')}</small></div></button>`).join(''):`<div class="search-empty">لا توجد نتائج</div>`;
  $$('[data-type]',box).forEach(btn=>btn.onclick=()=>{box.hidden=true;$('#global-search').value='';const t=btn.dataset.type;if(t==='note')openNoteEditor(btn.dataset.id);else if(t==='reminder')openReminderDialog(btn.dataset.id);else if(t==='file')showSection('files');else showSection('expenses');});
}

function initNavigation(){
  $$('[data-nav]').forEach(b=>b.onclick=()=>showSection(b.dataset.nav));
  $$('[data-go]').forEach(b=>b.onclick=()=>showSection(b.dataset.go));
  $('#main-fab').onclick=()=>$('#fab-menu').classList.contains('open')?closeFab():openFab();
  $('#fab-new-note').onclick=()=>{closeFab();openNoteEditor();};
  $('#fab-expense').onclick=()=>{closeFab();openExpenseDialog();};
  $('#fab-reminder').onclick=()=>{closeFab();openReminderDialog();};
  $('#fab-file').onclick=()=>{closeFab();showSection('files');$('#add-file-btn').click();};
  $('#fab-photo').onclick=()=>{closeFab();openNoteEditor().then(()=>$('#add-camera').click());};
  $('#fab-voice').onclick=()=>{closeFab();openNoteEditor().then(()=>$('#add-record').click());};
  $('#quick-note').onclick=()=>openNoteEditor();
  $('#quick-expense').onclick=()=>openExpenseDialog();
  $('#quick-reminder').onclick=()=>openReminderDialog();
  $('#quick-file').onclick=()=>{showSection('files');$('#add-file-btn').click();};
  $('#global-search').addEventListener('input',()=>{clearTimeout(window.__searchTimer);window.__searchTimer=setTimeout(renderSearch,120);});
  document.addEventListener('click',e=>{if(!e.target.closest('.global-search-wrap'))$('#global-results').hidden=true;});
}

function initFilters(){
  $('#notes-search').oninput=()=>renderNotes($('#notes-container'),{search:$('#notes-search').value,category:$('#notes-category-filter').value,view:noteView});
  $('#notes-category-filter').onchange=$('#notes-search').oninput;
  $('#notes-view-toggle').onclick=()=>{noteView=noteView==='grid'?'list':'grid';localStorage.setItem('noteView',noteView);$('#notes-view-toggle').textContent=noteView==='grid'?'☷':'▦';$('#notes-search').oninput();};
  $$('[data-expense-filter]').forEach(b=>b.onclick=()=>{expenseFilter=b.dataset.expenseFilter;$$('[data-expense-filter]').forEach(x=>x.classList.toggle('active',x===b));renderExpenses($('#expenses-container'),expenseFilter);});
}

function registerPWA(){
  if(Capacitor.isNativePlatform()) return;
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
  let deferred;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#install-app').hidden=false;});
  $('#install-app').onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;$('#install-app').hidden=true;};
}

async function init(){
  applySettings();
  initNavigation(); initFilters(); initNotesUI(); initExpensesUI(); initRemindersUI(); initFilesUI(); initSettingsUI(); initDocumentStudio();
  const cb=refreshAll;
  setNotesRefreshCallback(cb); setExpensesRefreshCallback(cb); setRemindersRefreshCallback(cb); setFilesRefreshCallback(cb); setSettingsRefreshCallback(cb);
  startWebReminderWatcher(); registerPWA(); await refreshAll();
  document.body.classList.add('ready');
}

function showStartupError(error) {
  console.error('Startup failed', error);
  document.body.classList.add('ready');
  if (document.getElementById('app-startup-warning')) return;
  const warn = document.createElement('div');
  warn.id = 'app-startup-warning';
  warn.dir = 'rtl';
  warn.setAttribute('role', 'alert');
  warn.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;z-index:100000;background:#fff2db;border:1px solid #d9b879;border-radius:12px;padding:14px;font:15px Tahoma,Arial;color:#583d17';
  const message = document.createElement('span');
  message.textContent = 'تعذرت تهيئة بعض بيانات المفكرة. الواجهة ظاهرة ويمكن إعادة تشغيل التطبيق. لا تحذف بياناته.';
  warn.appendChild(message);
  document.body.appendChild(warn);
}
function startApp() {
  Promise.resolve().then(init).catch(showStartupError);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
  startApp();
}

