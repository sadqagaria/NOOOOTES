import {put,getAll} from './storage.js';
import {uid,toast,escapeHTML} from './utils.js';

const CATEGORIES=['Ideas','Personal','Work','Documents'];
const NAV_COPY={Ideas:'أفكار سريعة',Personal:'شخصي',Work:'عمل',Documents:'مستندات'};
export function initQuickCapture(refresh){
 if(document.getElementById('quick-capture'))return;
 const home=document.querySelector('[data-section="home"]');
 if(!home)return;
 const panel=document.createElement('section');
 panel.id='quick-capture';
 panel.className='panel quick-capture-glass';
 panel.innerHTML='<div class="quick-capture-head"><div><span class="section-kicker">CAPTURE EVERYTHING</span><h2>⚡ صندوق الأفكار السريع</h2><p>اكتب الفكرة لحظة ما تيجي في بالك، واحفظها فورًا كملاحظة.</p></div><span class="quick-spark">✦</span></div><textarea id="quick-capture-text" rows="3" maxlength="40000" placeholder="إيه الفكرة اللي جات في بالك دلوقتي؟"></textarea><div class="quick-capture-actions"><select id="quick-capture-category"><option value="Ideas">💡 أفكار</option><option value="Personal">🧡 شخصي</option><option value="Work">💼 عمل</option><option value="Documents">📄 مستندات</option></select><button id="quick-capture-save" class="primary" type="button">＋ حفظ الفكرة</button></div><div id="quick-capture-recent" class="quick-recent"></div>';
 const anchor=home.querySelector('.home-grid');if(anchor)anchor.before(panel);else home.append(panel);
 const input=panel.querySelector('#quick-capture-text');
 const save=panel.querySelector('#quick-capture-save');
 save.onclick=async()=>{
   const text=input.value.trim();
   if(!text){input.focus();toast('اكتب فكرة أولًا');return;}
   save.disabled=true;
   try{
     const now=new Date().toISOString(),id=uid();
     await put('notes',{
      id,title:text.split('\n').find(Boolean).slice(0,65)||'فكرة سريعة',blocks:[{id:uid(),type:'text',text}],
      category:panel.querySelector('#quick-capture-category').value,
      tags:['سريع'],favorite:false,pinned:false,color:'#7c3aed',background:'none',
      createdAt:now,updatedAt:now
     });
     input.value='';
     toast('تم حفظ الفكرة في ملاحظاتك');
     await refresh();
     await recent();
   }catch(error){console.error('Quick capture error',error);toast('تعذر حفظ الفكرة. تحقق من مساحة التخزين.');}
   finally{save.disabled=false;}
 };
 async function recent(){
   const host=panel.querySelector('#quick-capture-recent');
   const items=(await getAll('notes')).filter(n=>n.tags?.includes('سريع')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3);
   host.innerHTML=items.length?'<strong>آخر الأفكار المحفوظة</strong><div class="quick-recent-list">'+items.map(n=>'<span>✦ '+escapeHTML(n.title)+'</span>').join('')+'</div>':'';
 }
 recent().catch(console.warn);
}
