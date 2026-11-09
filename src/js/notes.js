import { getAll, getById, put, remove } from './storage.js';
import { beginVoiceRecording, isVoiceRecording, prepareVoiceRecorderUI } from './voice-recorder.js';
import DOMPurify from 'dompurify';
import {renderAsync as renderDOCX} from 'docx-preview';
import { $, $$, uid, escapeHTML, stripHTML, formatDate, toast, confirmDialog, fileIcon } from './utils.js';

const COLORS = ['#2563eb','#0ea5e9','#0f766e','#059669','#166534','#65a30d','#ca8a04','#ea580c','#f97316','#dc2626','#e11d48','#ec4899','#9333ea','#7c3aed','#4f46e5','#475569'];
const BACKGROUNDS = ['none','cats','houses','sea','trees','fields','mountains','sunset','waves','nature','sky'];
let activeNoteId = null;
let objectUrls = [];
let refreshCallback = () => {};

function noteText(note) {
  return (note.blocks || []).map(b => b.type === 'rich' ? stripHTML(b.html) : (b.text || b.url || b.name || '')).join(' ').trim();
}

export async function getNotes() {
  const notes = await getAll('notes');
  return notes.sort((a,b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function setNotesRefreshCallback(cb) { refreshCallback = cb; }

export async function renderNotes(container, { search = '', category = 'all', view = 'grid' } = {}) {
  const notes = await getNotes();
  const q = search.trim().toLowerCase();
  const filtered = notes.filter(note => {
    const hay = `${note.title} ${noteText(note)} ${(note.tags || []).join(' ')} ${note.category || ''}`.toLowerCase();
    return (!q || hay.includes(q)) && (category === 'all' || note.category === category);
  });
  container.className = `notes-list ${view}`;
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h3>ذكرياتك تبدأ هنا</h3><p>أنشئ أول ملاحظة، وأضف نصوصًا وصورًا وملفات في نفس المكان.</p><button class="primary" data-new-note>+ إنشاء ملاحظة</button></div>`;
    container.querySelector('[data-new-note]')?.addEventListener('click', () => openNoteEditor());
    return;
  }
  container.innerHTML = filtered.map(note => {
    const counts = (note.blocks || []).reduce((acc,b) => { acc[b.type] = (acc[b.type] || 0) + 1; return acc; }, {});
    const preview = noteText(note).slice(0, 140) || 'ملاحظة بدون نص';
    const colorIndex = Math.max(0, COLORS.indexOf(note.color || COLORS[0])) + 1;
    return `<article class="note-card bg-${escapeHTML(note.background || 'none')} note-accent-${colorIndex}" data-note-id="${note.id}">
      <div class="note-card-top"><span class="note-color"></span><div class="note-flags">${note.pinned ? '📌' : ''}${note.favorite ? '⭐' : ''}</div></div>
      <h3>${escapeHTML(note.title || 'بدون عنوان')}</h3>
      <p>${escapeHTML(preview)}</p>
      <div class="attachment-counts">${counts.image ? `🖼️ ${counts.image}` : ''} ${counts.pdf ? `📕 ${counts.pdf}` : ''} ${counts.audio ? `🎧 ${counts.audio}` : ''} ${counts.video ? `🎬 ${counts.video}` : ''} ${counts.file ? `📎 ${counts.file}` : ''}</div>
      <footer><span>${escapeHTML(note.category || 'Personal')}</span><time>${formatDate(note.updatedAt)}</time></footer>
    </article>`;
  }).join('');
  $$('[data-note-id]', container).forEach(card => card.addEventListener('click', () => openNoteEditor(card.dataset.noteId)));
}

function cleanupUrls() {
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
}

function blockTemplate(block) {
  if (block.type === 'text') return `<div class="editor-block" data-block-id="${block.id}" data-type="text"><div class="block-head"><span>📝 نص</span><button data-remove-block aria-label="حذف العنصر">✕</button></div><textarea class="plain-block" placeholder="اكتب هنا...">${escapeHTML(block.text || '')}</textarea></div>`;
  if (block.type === 'rich') return `<div class="editor-block" data-block-id="${block.id}" data-type="rich"><div class="block-head"><span>✍️ نص منسق</span><button data-remove-block>✕</button></div><div class="rich-toolbar"><button data-cmd="bold"><b>B</b></button><button data-cmd="italic"><i>I</i></button><button data-cmd="underline"><u>U</u></button><button data-cmd="insertUnorderedList">• List</button><button data-cmd="insertOrderedList">1. List</button></div><div class="rich-block" contenteditable="true" data-placeholder="اكتب نصًا منسقًا...">${DOMPurify.sanitize(block.html || '', {USE_PROFILES:{html:true}})}</div></div>`;
  if (block.type === 'link') {
    let card='';
    try{
      const parsed=new URL(block.url||'');
      if(['http:','https:'].includes(parsed.protocol)){
        const displayTitle=escapeHTML(block.text||parsed.hostname);
        card=`<a class="note-link-preview" href="${escapeHTML(parsed.href)}" target="_blank" rel="noopener noreferrer"><span class="link-bubble">🔗</span><span class="link-info"><span>${displayTitle}</span><small>${escapeHTML(parsed.hostname)}</small></span><span>↗</span></a>`;
      }
    }catch{}
    return `<div class="editor-block" data-block-id="${block.id}" data-type="link"><div class="block-head"><span>🔗 رابط ذكي</span><button data-remove-block aria-label="حذف الرابط">✕</button></div><input class="link-title" value="${escapeHTML(block.text||'')}" placeholder="اسم الرابط"><input class="link-url" value="${escapeHTML(block.url||'')}" placeholder="https://example.com" inputmode="url">${card}</div>`;
  }
  const type = block.mime || '';
  let preview = '';
  if (block.blob instanceof Blob) {
    const url = URL.createObjectURL(block.blob); objectUrls.push(url);
    if (type.startsWith('image/')) preview = `<img class="media-preview" src="${url}" alt="${escapeHTML(block.name || 'صورة')}">`;
    else if (type.startsWith('video/')) preview = `<video class="media-preview" src="${url}" controls preload="metadata"></video>`;
    else if (type.startsWith('audio/')) preview = `<audio src="${url}" controls preload="metadata"></audio>`;
    else if (type.includes('pdf')) preview = `<iframe class="pdf-preview" src="${url}" title="PDF preview"></iframe>`;
    else if (/\.docx$/i.test(block.name || '') || type.includes('wordprocessingml')) preview = `<div class="note-docx-viewer" data-docx="${escapeHTML(block.id)}"><p>جارٍ تجهيز معاينة Word...</p></div><a class="note-docx-download" href="${url}" download="${escapeHTML(block.name || 'document.docx')}">تنزيل ملف Word الأصلي</a>`;
  }
  return `<div class="editor-block file-block" data-block-id="${block.id}" data-type="${escapeHTML(block.type)}"><div class="block-head"><span>${fileIcon(type)} ${escapeHTML(block.name || 'ملف')}</span><button data-remove-block>✕</button></div>${preview}<div class="file-meta">${escapeHTML(type || 'ملف')} • ${Math.max(1, Math.round((block.size || 0)/1024))} KB</div></div>`;
}

function renderBlocks(note) {
  const host = $('#note-blocks');
  cleanupUrls();
  host.innerHTML = (note.blocks || []).map(blockTemplate).join('');
  bindBlockInteractions();
  hydrateDocxBlocks(note.blocks || []);
}

async function hydrateDocxBlocks(blocks) {
  for (const block of blocks) {
    if (!(block.blob instanceof Blob)) continue;
    if (!(/\.docx$/i.test(block.name || '') || String(block.mime || '').includes('wordprocessingml'))) continue;
    const host = [...document.querySelectorAll('.note-docx-viewer')].find(x => x.dataset.docx === block.id);
    if (!host) continue;
    try { await renderDOCX(block.blob, host, null, {breakPages:true, ignoreLastRenderedPageBreak:false}); }
    catch (error) { console.warn('DOCX preview unavailable',error); host.textContent='تعذرت معاينة Word، لكن الملف الأصلي محفوظ ويمكن تنزيله.'; }
  }
}

function bindBlockInteractions() {
  $$('#note-blocks .editor-block').forEach(block => {
    const head = block.querySelector('.block-head');
    if (!head || head.querySelector('.block-reorder')) return;
    const wrapper=document.createElement('span');wrapper.className='block-reorder';
    for (const [symbol,direction] of [['↑',-1],['↓',1]]) {
      const button=document.createElement('button');button.type='button';button.textContent=symbol;button.title=direction<0?'تحريك لأعلى':'تحريك لأسفل';
      button.onclick=()=>{
        const parent=block.parentNode;
        if(direction<0 && block.previousElementSibling) parent.insertBefore(block,block.previousElementSibling);
        if(direction>0 && block.nextElementSibling) parent.insertBefore(block.nextElementSibling,block);
      };
      wrapper.appendChild(button);
    }
    head.insertBefore(wrapper,head.querySelector('[data-remove-block]'));
  });
  $$('#note-blocks [data-remove-block]').forEach(btn => btn.onclick = () => btn.closest('.editor-block').remove());
  $$('#note-blocks [data-cmd]').forEach(btn => btn.onclick = () => {
    const rich = btn.closest('.editor-block').querySelector('.rich-block');
    rich.focus();
    document.execCommand(btn.dataset.cmd, false, null);
  });
}

function collectBlocks() {
  return $$('.editor-block', $('#note-blocks')).map(el => {
    const type = el.dataset.type;
    const existing = el._blockData || {};
    if (type === 'text') return { id: el.dataset.blockId, type, text: $('.plain-block', el).value };
    if (type === 'rich') return { id: el.dataset.blockId, type, html: DOMPurify.sanitize($('.rich-block', el).innerHTML, {USE_PROFILES:{html:true}}) };
    if (type === 'link') return { id: el.dataset.blockId, type, text: $('.link-title', el).value, url: $('.link-url', el).value };
    return existing.id ? existing : { id: el.dataset.blockId, type };
  });
}

function attachBlockData(block) {
  const el = $(`[data-block-id="${CSS.escape(block.id)}"]`, $('#note-blocks'));
  if (el) el._blockData = block;
}

function appendBlock(block) {
  const host = $('#note-blocks');
  const wrap = document.createElement('div');
  wrap.innerHTML = blockTemplate(block);
  const el = wrap.firstElementChild;
  el._blockData = block;
  host.appendChild(el);
  bindBlockInteractions();
  hydrateDocxBlocks([block]);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function fileToBlock(file, forcedType) {
  const mime = file.type || 'application/octet-stream';
  let type = forcedType || 'file';
  if (!forcedType) {
    if (mime.startsWith('image/')) type = 'image';
    else if (mime.startsWith('video/')) type = 'video';
    else if (mime.startsWith('audio/')) type = 'audio';
    else if (mime.includes('pdf')) type = 'pdf';
  }
  return { id: uid(), type, name: file.name, mime, size: file.size, blob: file, createdAt: new Date().toISOString() };
}

async function addFiles(accept, forcedType, capture = false) {
  const input = document.createElement('input');
  input.type = 'file'; input.multiple = true; input.accept = accept || '*/*';
  if (capture) input.capture = 'environment';
  input.onchange = async () => {
    for (const file of input.files) appendBlock(await fileToBlock(file, forcedType));
  };
  input.click();
}

async function recordAudio() {
  const note=$('#recording-error');
  if(note){note.hidden=true;note.textContent='';}
  return beginVoiceRecording(async recording => {
    appendBlock({
      id:uid(),type:'audio',name:recording.name,mime:recording.mime,
      size:recording.size,blob:recording.blob,duration:recording.duration,
      createdAt:new Date().toISOString()
    });
    toast('تم تسجيل الصوت وإضافته. اضغط حفظ الملاحظة للاحتفاظ به.');
  });
}

function readMeta(note) {
  $('#note-title').value = note.title || '';
  $('#note-category').value = note.category || 'Personal';
  $('#note-tags').value = (note.tags || []).join(', ');
  $('#note-favorite').classList.toggle('active', !!note.favorite);
  $('#note-pin').classList.toggle('active', !!note.pinned);
  $('#note-bg').value = note.background || 'none';
  $('#note-color').value = note.color || COLORS[0];
}

export async function openNoteEditor(id = null) {
  activeNoteId = id;
  const note = id ? await getById('notes', id) : {
    id: uid(), title:'', blocks:[{id:uid(),type:'text',text:''}], category:'Personal', tags:[], favorite:false, pinned:false,
    color: COLORS[0], background:'none', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
  };
  readMeta(note);
  renderBlocks(note);
  (note.blocks || []).forEach(attachBlockData);
  $('#note-editor').classList.add('open');
  $('#note-editor').setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

export function closeNoteEditor() {
  if (isVoiceRecording()) {toast('أنهِ التسجيل أو ألغِه قبل الخروج من الملاحظة.');return;}
  cleanupUrls();
  $('#note-editor').classList.remove('open');
  $('#note-editor').setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
  activeNoteId = null;
}

async function saveCurrentNote() {
  if (isVoiceRecording()) {toast('أنهِ التسجيل أولًا ثم احفظ الملاحظة.');return;}
  const old = activeNoteId ? await getById('notes', activeNoteId) : null;
  const now = new Date().toISOString();
  const note = {
    id: activeNoteId || uid(),
    title: $('#note-title').value.trim() || 'بدون عنوان',
    category: $('#note-category').value,
    tags: $('#note-tags').value.split(',').map(x => x.trim()).filter(Boolean),
    favorite: $('#note-favorite').classList.contains('active'),
    pinned: $('#note-pin').classList.contains('active'),
    background: $('#note-bg').value,
    color: $('#note-color').value,
    blocks: collectBlocks(),
    createdAt: old?.createdAt || now,
    updatedAt: now
  };
  await put('notes', note);
  activeNoteId = note.id;
  toast('تم حفظ الملاحظة');
  await refreshCallback();
  closeNoteEditor();
}

export function initNotesUI() {
  $('#new-note-btn').onclick = () => openNoteEditor();
  $('#note-close').onclick = closeNoteEditor;
  $('#note-save').onclick = saveCurrentNote;
  $('#note-favorite').onclick = e => e.currentTarget.classList.toggle('active');
  $('#note-pin').onclick = e => e.currentTarget.classList.toggle('active');
  $('#add-text').onclick = () => appendBlock({id:uid(),type:'text',text:''});
  $('#add-rich').onclick = () => appendBlock({id:uid(),type:'rich',html:''});
  $('#add-link').onclick = () => appendBlock({id:uid(),type:'link',text:'',url:''});
  const updateLiveLinkPreview = event => {
    if (!event.target.matches('.link-title,.link-url')) return;
    const block=event.target.closest('.editor-block');
    if (!block) return;
    const title=block.querySelector('.link-title')?.value||'';
    const link=block.querySelector('.link-url')?.value?.trim()||'';
    let card=block.querySelector('.note-link-preview');
    let parsed;
    try { parsed=new URL(link);if (!['http:','https:'].includes(parsed.protocol)) throw Error('Unsupported protocol'); }
    catch {card?.remove();return;}
    if (!card) {
      card=document.createElement('a');
      card.className='note-link-preview';
      card.target='_blank';
      card.rel='noopener noreferrer';
      block.appendChild(card);
    }
    card.href=parsed.href;
    card.innerHTML='<span class="link-bubble">🔗</span><span class="link-info"><span></span><small></small></span><span>↗</span>';
    card.querySelector('.link-info span').textContent=title||parsed.hostname;
    card.querySelector('.link-info small').textContent=parsed.hostname;
  };
  $('#note-blocks').addEventListener('input',updateLiveLinkPreview);
  $('#note-blocks').addEventListener('change',updateLiveLinkPreview);
  $('#add-image').onclick = () => addFiles('image/*');
  $('#add-camera').onclick = () => addFiles('image/*', 'image', true);
  $('#add-video').onclick = () => addFiles('video/*');
  $('#add-audio').onclick = () => addFiles('audio/*');
  $('#add-pdf').onclick = () => addFiles('application/pdf','pdf');
  $('#add-doc').onclick = () => addFiles('.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document','file');
  $('#add-txt').onclick = () => addFiles('text/plain','file');
  $('#add-file').onclick = () => addFiles('*/*');
  prepareVoiceRecorderUI();
  $('#add-record').onclick = () => recordAudio().catch(error => {console.error(error);toast('تعذر بدء التسجيل، راجع صلاحيات الميكروفون.');});

  $('#note-delete').onclick = async () => {
    if (!activeNoteId) return closeNoteEditor();
    const note = await getById('notes', activeNoteId);
    const yes = await confirmDialog({ title:'حذف الملاحظة', message:'هل تريد حذف هذه الملاحظة؟', confirmText:'حذف', danger:true });
    if (!yes) return;
    await remove('notes', activeNoteId);
    closeNoteEditor();
    toast('تم الحذف', 'تراجع', async () => { await put('notes', note); await refreshCallback(); });
    await refreshCallback();
  };

  const bg = $('#note-bg'); BACKGROUNDS.forEach(v => bg.insertAdjacentHTML('beforeend', `<option value="${v}">${v === 'none' ? 'بدون خلفية' : v}</option>`));
  const color = $('#note-color'); COLORS.forEach((v,i) => color.insertAdjacentHTML('beforeend', `<option value="${v}">لون ${i+1}</option>`));
}

export { noteText };
