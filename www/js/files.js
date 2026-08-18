import { getAll, put, getById, remove } from './storage.js';
import { $, $$, uid, escapeHTML, formatDate, fileIcon, downloadBlob, toast, confirmDialog } from './utils.js';

let refreshCallback = () => {};
let previewUrls = [];
export function setFilesRefreshCallback(cb){ refreshCallback = cb; }
export async function getFiles(){ const items=await getAll('files'); return items.sort((a,b)=>new Date(b.date)-new Date(a.date)); }

export async function renderFiles(container){
  cleanupUrls(); const items=await getFiles();
  if(!items.length){ container.innerHTML=`<div class="empty-state"><div class="empty-icon">📁</div><h3>لا توجد ملفات</h3><p>أضف PDF أو Word أو صورة أو فيديو أو صوت واحفظه محليًا.</p><button class="primary" data-add-file>+ إضافة ملف</button></div>`; container.querySelector('[data-add-file]')?.addEventListener('click',chooseFiles); return; }
  container.innerHTML=items.map(f=>`<article class="file-card" data-file-id="${f.id}"><div class="file-type">${fileIcon(f.mime)}</div><div class="file-info"><strong>${escapeHTML(f.name)}</strong><span>${escapeHTML(f.mime||'ملف')} • ${Math.max(1,Math.round((f.size||0)/1024))} KB • ${formatDate(f.date)}</span></div><div class="file-actions"><button data-open>فتح</button><button data-download>تنزيل</button><button data-rename>إعادة تسمية</button><button data-delete class="danger-text">حذف</button></div></article>`).join('');
  $$('[data-file-id]',container).forEach(card=>{
    const id=card.dataset.fileId;
    $('[data-open]',card).onclick=()=>openFile(id);
    $('[data-download]',card).onclick=async()=>{const f=await getById('files',id); downloadBlob(f.blob,f.name);};
    $('[data-rename]',card).onclick=async()=>{const f=await getById('files',id); const name=prompt('الاسم الجديد',f.name); if(name?.trim()){f.name=name.trim(); await put('files',f); await refreshCallback();}};
    $('[data-delete]',card).onclick=async()=>{const f=await getById('files',id); const yes=await confirmDialog({title:'حذف الملف',message:`حذف ${f.name}؟`,confirmText:'حذف',danger:true}); if(!yes)return; await remove('files',id); toast('تم حذف الملف','تراجع',async()=>{await put('files',f);await refreshCallback();}); await refreshCallback();};
  });
}
function cleanupUrls(){previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];}
function chooseFiles(){const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';input.onchange=async()=>{for(const file of input.files){await put('files',{id:uid(),name:file.name,mime:file.type,size:file.size,blob:file,date:new Date().toISOString()});}toast('تمت إضافة الملفات');await refreshCallback();};input.click();}
async function openFile(id){const f=await getById('files',id);if(!f?.blob)return;cleanupUrls();const url=URL.createObjectURL(f.blob);previewUrls.push(url);const host=$('#file-preview-content');host.innerHTML='';if(f.mime.startsWith('image/'))host.innerHTML=`<img src="${url}" class="viewer-media" alt="${escapeHTML(f.name)}">`;else if(f.mime.startsWith('video/'))host.innerHTML=`<video src="${url}" class="viewer-media" controls autoplay></video>`;else if(f.mime.startsWith('audio/'))host.innerHTML=`<audio src="${url}" controls autoplay></audio>`;else if(f.mime.includes('pdf'))host.innerHTML=`<iframe src="${url}" class="viewer-pdf" title="PDF"></iframe>`;else host.innerHTML=`<div class="empty-state"><div class="empty-icon">${fileIcon(f.mime)}</div><h3>${escapeHTML(f.name)}</h3><p>المعاينة غير متاحة لهذا النوع، يمكنك تنزيل الملف.</p><button class="primary" id="preview-download">تنزيل</button></div>`;$('#file-preview-title').textContent=f.name;$('#file-preview').classList.add('open');$('#preview-download')?.addEventListener('click',()=>downloadBlob(f.blob,f.name));}
export function closeFilePreview(){cleanupUrls();$('#file-preview').classList.remove('open');}
export function initFilesUI(){ $('#add-file-btn').onclick=chooseFiles; $('#file-preview-close').onclick=closeFilePreview; }
