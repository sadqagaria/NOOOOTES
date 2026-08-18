import { getAll } from './storage.js';
import { stripHTML } from './utils.js';

function noteText(note){return (note.blocks||[]).map(b=>b.type==='rich'?stripHTML(b.html):(b.text||b.url||b.name||'')).join(' ');}
export async function globalSearch(query){
  const q=query.trim().toLowerCase(); if(!q)return[];
  const [notes,expenses,reminders,files]=await Promise.all(['notes','expenses','reminders','files'].map(getAll));
  const out=[];
  for(const n of notes){const text=`${n.title} ${noteText(n)} ${(n.tags||[]).join(' ')} ${n.category||''}`;if(text.toLowerCase().includes(q))out.push({type:'note',id:n.id,title:n.title||'بدون عنوان',subtitle:noteText(n).slice(0,110),icon:'📝'});}
  for(const x of expenses){const text=`${x.description} ${x.category} ${x.amount}`;if(text.toLowerCase().includes(q))out.push({type:'expense',id:x.id,title:x.description,subtitle:`${x.amount} EGP • ${x.category}`,icon:'💰'});}
  for(const r of reminders){const text=`${r.title} ${r.note||''}`;if(text.toLowerCase().includes(q))out.push({type:'reminder',id:r.id,title:r.title,subtitle:new Date(r.dateTime).toLocaleString('ar-EG'),icon:'⏰'});}
  for(const f of files){if((f.name||'').toLowerCase().includes(q))out.push({type:'file',id:f.id,title:f.name,subtitle:f.mime||'ملف',icon:'📁'});}
  return out;
}
