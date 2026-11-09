import { exportDatabase, importDatabase, clearStore } from './storage.js';
import { $, downloadBlob, toast, confirmDialog } from './utils.js';

const ACCENTS=['#7655e9','#0ea5e9','#0f766e','#059669','#166534','#65a30d','#ca8a04','#ea580c','#f97316','#dc2626','#e11d48','#ec4899','#9333ea','#7c3aed','#4f46e5','#475569'];
let refreshCallback=()=>{};
export function setSettingsRefreshCallback(cb){refreshCallback=cb;}
export function applySettings(){
  const mode=localStorage.getItem('appearance')||'light';
  document.documentElement.dataset.theme=mode;
  document.documentElement.style.setProperty('--accent',localStorage.getItem('accent')||ACCENTS[0]);
  $('#appearance-select').value=mode; $('#accent-select').value=localStorage.getItem('accent')||ACCENTS[0];
}
function blobToJSONReplacer(key,value){ if(value instanceof Blob) return {__blobOmitted:true,type:value.type,size:value.size}; return value; }
export function initSettingsUI(){
  ACCENTS.forEach((c,i)=>$('#accent-select').insertAdjacentHTML('beforeend',`<option value="${c}">لون ${i+1}</option>`));
  $('#appearance-select').onchange=e=>{localStorage.setItem('appearance',e.target.value);applySettings();};
  $('#accent-select').onchange=e=>{localStorage.setItem('accent',e.target.value);applySettings();};
  $('#export-data').onclick=async()=>{const data=await exportDatabase();const json=JSON.stringify(data,blobToJSONReplacer,2);downloadBlob(new Blob([json],{type:'application/json'}),`my-life-backup-${new Date().toISOString().slice(0,10)}.json`);toast('تم تصدير البيانات. الوسائط الكبيرة لا تدخل داخل JSON في V1.');};
  $('#import-data').onclick=()=>{const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=async()=>{try{const data=JSON.parse(await input.files[0].text());await importDatabase(data);toast('تم استيراد النسخة الاحتياطية');await refreshCallback();}catch(err){console.error(err);toast('ملف النسخة الاحتياطية غير صالح');}};input.click();};
  $('#clear-data').onclick=async()=>{const yes=await confirmDialog({title:'مسح كل البيانات',message:'سيتم حذف الملاحظات والمصاريف والتنبيهات والملفات نهائيًا من هذا الجهاز.',confirmText:'مسح الكل',danger:true});if(!yes)return;for(const s of ['notes','expenses','reminders','files'])await clearStore(s);toast('تم مسح البيانات');await refreshCallback();};
  applySettings();
}
