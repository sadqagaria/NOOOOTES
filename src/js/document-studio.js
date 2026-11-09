import {PDFDocument,degrees} from 'pdf-lib';
const $=s=>document.querySelector(s);
let entries=[];
function download(bytes,name,type='application/pdf'){
 const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);
}
function msg(text){$('#studio-status').textContent=text;}
function pdfFiles(){return entries.filter(x=>x.type==='application/pdf'||x.name.toLowerCase().endsWith('.pdf'));}
function imageFiles(){return entries.filter(x=>x.type.startsWith('image/'));}
function render(){
 const host=$('#studio-list');host.replaceChildren();
 for(let i=0;i<entries.length;i++){
  const f=entries[i],row=document.createElement('div');row.className='studio-item';
  const title=document.createElement('span');title.textContent=(f.type.startsWith('image/')?'🖼️ ':'📕 ')+f.name;row.append(title);
  for(const [icon,dir] of [['↑',-1],['↓',1],['×',null]]){
   const b=document.createElement('button');b.textContent=icon;b.disabled=dir!==null&&(i+dir<0||i+dir>=entries.length);
   b.onclick=()=>{if(dir===null)entries.splice(i,1);else [entries[i],entries[i+dir]]=[entries[i+dir],entries[i]];render();};row.append(b);
  }host.append(row);
 }
 if(!entries.length){const p=document.createElement('p');p.textContent='أضف ملفات PDF أو صور من هاتفك.';host.append(p);}
 const sel=$('#studio-image-select');sel.replaceChildren();
 imageFiles().forEach(f=>{const option=document.createElement('option');option.value=entries.indexOf(f);option.textContent=f.name;sel.append(option);});
 $('#studio-merge').disabled=pdfFiles().length<2;
 $('#studio-split').disabled=$('#studio-rotate').disabled=pdfFiles().length<1;
 $('#studio-to-pdf').disabled=$('#studio-image-save').disabled=imageFiles().length<1;
 showImage();
}
function add(files){for(const f of files)if(f.type.startsWith('image/')||f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf'))entries.push(f);render();}
async function merge(){
 const result=await PDFDocument.create();
 for(const file of pdfFiles()){const doc=await PDFDocument.load(await file.arrayBuffer());(await result.copyPages(doc,doc.getPageIndices())).forEach(p=>result.addPage(p));}
 download(await result.save(),'mofakkirati-merged.pdf');
}
function pageIDs(text,length){
 if(!text.trim())return Array.from({length},(_,i)=>i);
 const indices=new Set();
 for(const item of text.split(',')){const match=/^(\d+)(?:-(\d+))?$/.exec(item.trim());if(!match)throw Error('صيغة الصفحات: 1,3-5');const a=+match[1],b=+(match[2]||match[1]);if(a<1||b<a||b>length)throw Error('رقم صفحة غير صحيح');for(let i=a;i<=b;i++)indices.add(i-1);}
 return [...indices];
}
async function extract(){
 const src=await PDFDocument.load(await pdfFiles()[0].arrayBuffer()),out=await PDFDocument.create();
 (await out.copyPages(src,pageIDs($('#studio-pages').value,src.getPageCount()))).forEach(p=>out.addPage(p));
 download(await out.save(),'mofakkirati-extracted.pdf');
}
async function rotate(){
 const doc=await PDFDocument.load(await pdfFiles()[0].arrayBuffer());
 for(const i of pageIDs($('#studio-pages').value,doc.getPageCount())){const p=doc.getPage(i);p.setRotation(degrees((p.getRotation().angle+Number($('#studio-angle').value))%360));}
 download(await doc.save(),'mofakkirati-rotated.pdf');
}
async function imageCanvas(f){
 const image=await createImageBitmap(f),c=document.createElement('canvas');const k=Math.min(1,2300/Math.max(image.width,image.height));
 c.width=Math.max(1,Math.round(image.width*k));c.height=Math.max(1,Math.round(image.height*k));
 c.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0,c.width,c.height);image.close();return c;
}
async function toPDF(){
 const doc=await PDFDocument.create();
 for(const f of imageFiles()){
  const c=await imageCanvas(f),blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.94));
  const image=await doc.embedJpg(await blob.arrayBuffer()),w=595.28,h=841.89,k=Math.min((w-44)/image.width,(h-44)/image.height);
  doc.addPage([w,h]).drawImage(image,{x:(w-image.width*k)/2,y:(h-image.height*k)/2,width:image.width*k,height:image.height*k});
 }
 download(await doc.save(),'mofakkirati-images.pdf');
}
async function filteredCanvas(){
 const f=entries[Number($('#studio-image-select').value)];if(!f)throw Error('اختر صورة');
 const c=await imageCanvas(f),ctx=c.getContext('2d',{willReadFrequently:true}),data=ctx.getImageData(0,0,c.width,c.height),p=data.data;
 const filter=$('#studio-filter').value,s=Number($('#studio-strength').value)/100;
 for(let i=0;i<p.length;i+=4){
 const r=p[i],g=p[i+1],b=p[i+2],y=.299*r+.587*g+.114*b;let v=[r,g,b];
 if(filter==='clean')v=v.map(x=>Math.min(255,(x-115)*(1+.55*s)+115+27*s));
 else if(filter==='print'||filter==='bw'){const k=filter==='print'?(y>182-40*s?255:y<120+30*s?0:y):(y>150?255:0);v=[k,k,k];}
 else if(filter==='gray')v=[y,y,y];
 else if(filter==='light')v=v.map(x=>Math.min(255,x+80*s));
 else if(filter==='vivid')v=v.map(x=>Math.max(0,Math.min(255,(x-y)*(1+s)+y)));
 p[i]=v[0];p[i+1]=v[1];p[i+2]=v[2];
 }
 ctx.putImageData(data,0,0);return c;
}
let lastPreview=0;
async function showImage(){
 const canvas=$('#studio-canvas');if(!canvas)return;const request=++lastPreview;
 if(!imageFiles().length){canvas.width=600;canvas.height=120;canvas.getContext('2d').clearRect(0,0,600,120);return;}
 try{const c=await filteredCanvas();if(request!==lastPreview)return;canvas.width=c.width;canvas.height=c.height;canvas.getContext('2d').drawImage(c,0,0);}
 catch(e){console.warn(e);}
}
async function saveImage(){
 const c=await filteredCanvas();const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.94));download(blob,'mofakkirati-enhanced.jpg','image/jpeg');
}
function run(fn){msg('جاري المعالجة محليًا...');Promise.resolve().then(fn).then(()=>msg('اكتملت العملية، تم حفظ الملف الجديد.')).catch(e=>{console.error(e);msg('تعذرت المعالجة: '+e.message);});}
export function initDocumentStudio(){
 if($('#studio-panel'))return;
 const style=document.createElement('style');style.textContent='.studio-body{display:grid;gap:14px}.studio-card{background:var(--surface);border:1px solid var(--border);padding:16px;border-radius:18px}.studio-buttons{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.studio-buttons button,.studio-item button{border:1px solid var(--border);background:var(--surface-2);color:var(--text);padding:11px;border-radius:10px;min-height:43px}.studio-buttons button:disabled{opacity:.4}.studio-item{display:flex;gap:8px;align-items:center;padding:9px;border-bottom:1px solid var(--border)}.studio-item span{flex:1;overflow-wrap:anywhere}.studio-card select,.studio-card input{padding:8px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);max-width:100%}#studio-canvas{display:block;max-width:100%;max-height:55vh;margin:auto}#studio-status{font-weight:600;color:var(--accent)}';document.head.append(style);
 const section=document.createElement('section');section.id='studio-panel';section.className='app-section';section.dataset.section='studio';section.innerHTML='<div class="studio-body"><div class="studio-card"><h2>📄 استوديو المستندات</h2><p>دمج وتقسيم وتدوير PDF وتحسين صور الأوراق على جهازك دون رفعها للسحابة، مع الحفاظ على النسخ الأصلية.</p><div class="studio-buttons"><button id="studio-pick">＋ إضافة PDF أو صورة</button><button id="studio-camera">📷 تصوير ورقة</button><button id="studio-clear">مسح القائمة</button></div><input id="studio-input" type="file" accept="application/pdf,.pdf,image/*" multiple hidden><input id="studio-camera-input" type="file" accept="image/*" capture="environment" hidden><div id="studio-list"></div><p id="studio-status" role="status"></p></div><div class="studio-card"><h3>أدوات PDF</h3><label>الصفحات المطلوبة (مثل 1,3-5) <input id="studio-pages" placeholder="الكل"></label> <label>زاوية التدوير <select id="studio-angle"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><div class="studio-buttons"><button id="studio-merge">دمج PDF</button><button id="studio-split">استخراج صفحات</button><button id="studio-rotate">تدوير صفحات</button><button id="studio-to-pdf">صور إلى PDF</button></div></div><div class="studio-card"><h3>✨ تحسين الصور والمستندات</h3><label>اختر الصورة <select id="studio-image-select"></select></label><div class="studio-buttons"><label>الفلتر <select id="studio-filter"><option value="original">أصلي</option><option value="clean" selected>ورق نظيف</option><option value="print">طباعة</option><option value="bw">أبيض وأسود</option><option value="gray">رمادي</option><option value="light">تفتيح</option><option value="vivid">ألوان واضحة</option></select></label><label>قوة الفلتر <input id="studio-strength" type="range" min="0" max="100" value="75"></label><button id="studio-image-save">حفظ نسخة محسنة</button></div><canvas id="studio-canvas"></canvas></div></div>';
 $('.content').append(section);
 const nav=document.createElement('button');nav.dataset.nav='studio';nav.innerHTML='<span>📄</span>استوديو PDF';$('.side-nav').append(nav);
 for(const selector of ['.quick-grid','.add-toolbar']){
  const parent=$(selector);if(!parent)continue;const b=document.createElement('button');b.textContent='📄 استوديو PDF';parent.append(b);b.onclick=()=>open();
 }
 function open(){document.querySelectorAll('.app-section').forEach(s=>s.classList.toggle('active',s.id==='studio-panel'));document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav==='studio'));$('#page-title').textContent='استوديو PDF';$('#note-editor').classList.remove('open');document.body.classList.remove('modal-open');}
 nav.onclick=open;
 $('#studio-pick').onclick=()=>$('#studio-input').click();
 $('#studio-camera').onclick=()=>$('#studio-camera-input').click();
 $('#studio-input').onchange=e=>{add(e.target.files);e.target.value='';};
 $('#studio-camera-input').onchange=e=>{add(e.target.files);e.target.value='';};
 $('#studio-clear').onclick=()=>{entries=[];render();};
 $('#studio-merge').onclick=()=>run(merge);$('#studio-split').onclick=()=>run(extract);
 $('#studio-rotate').onclick=()=>run(rotate);$('#studio-to-pdf').onclick=()=>run(toPDF);
 $('#studio-image-save').onclick=()=>run(saveImage);
 $('#studio-image-select').onchange=showImage;$('#studio-filter').onchange=showImage;$('#studio-strength').oninput=showImage;
 render();
}
