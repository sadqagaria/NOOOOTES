import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getAll, getById, put, remove } from './storage.js';
import { $, $$, uid, escapeHTML, formatDate, toast, confirmDialog } from './utils.js';

let editingId = null;
let refreshCallback = () => {};
let webTimer = null;

export function setRemindersRefreshCallback(cb) { refreshCallback = cb; }

function numericId(str) {
  let hash = 0;
  for (let i=0;i<str.length;i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash || 1);
}

export async function getReminders() {
  const items = await getAll('reminders');
  return items.sort((a,b) => new Date(a.dateTime) - new Date(b.dateTime));
}

export async function requestReminderPermission() {
  try {
    if (Capacitor.isNativePlatform()) {
      const current = await LocalNotifications.checkPermissions();
      if (current.display !== 'granted') {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      }
      return true;
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    return (await Notification.requestPermission()) === 'granted';
  } catch (err) {
    console.warn('Notification permission error', err);
    return false;
  }
}

function repeatSchedule(reminder) {
  const at = new Date(reminder.dateTime);
  if (reminder.repeat === 'once') return { at, allowWhileIdle: true };
  const hour = at.getHours();
  const minute = at.getMinutes();
  if (reminder.repeat === 'daily') return { on: { hour, minute }, allowWhileIdle: true };
  if (reminder.repeat === 'weekly') return { on: { weekday: at.getDay() + 1, hour, minute }, allowWhileIdle: true };
  if (reminder.repeat === 'monthly') return { on: { day: at.getDate(), hour, minute }, allowWhileIdle: true };
  if (reminder.repeat === 'yearly') return { on: { month: at.getMonth() + 1, day: at.getDate(), hour, minute }, allowWhileIdle: true };
  return { at, allowWhileIdle: true };
}

async function scheduleNative(reminder) {
  if (!Capacitor.isNativePlatform()) return;
  const ok = await requestReminderPermission();
  if (!ok) throw new Error('Notification permission denied');
  const id = numericId(reminder.id);
  try { await LocalNotifications.cancel({ notifications:[{id}] }); } catch {}
  await LocalNotifications.schedule({ notifications:[{
    id,
    title: reminder.title,
    body: reminder.note || 'لديك تنبيه الآن',
    schedule: repeatSchedule(reminder),
    foreground: true,
    extra: { reminderId: reminder.id }
  }] });
}

async function cancelNative(reminder) {
  if (!Capacitor.isNativePlatform()) return;
  try { await LocalNotifications.cancel({ notifications:[{id:numericId(reminder.id)}] }); } catch {}
}

function nextOccurrence(reminder) {
  const d = new Date(reminder.dateTime);
  if (reminder.repeat === 'once') return d;
  const now = new Date();
  while (d <= now) {
    if (reminder.repeat === 'daily') d.setDate(d.getDate()+1);
    else if (reminder.repeat === 'weekly') d.setDate(d.getDate()+7);
    else if (reminder.repeat === 'monthly') d.setMonth(d.getMonth()+1);
    else if (reminder.repeat === 'yearly') d.setFullYear(d.getFullYear()+1);
    else break;
  }
  return d;
}

export async function renderReminders(container) {
  const items = await getReminders();
  const upcoming = items.filter(x => nextOccurrence(x) >= new Date());
  if (!upcoming.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏰</div><h3>لا توجد تنبيهات قادمة</h3><p>أضف موعدًا وسيتم جدولة التنبيه على الهاتف عند تشغيل نسخة Android.</p><button class="primary" data-add-reminder>+ إضافة تنبيه</button></div>`;
    container.querySelector('[data-add-reminder]')?.addEventListener('click', () => openReminderDialog());
    return;
  }
  container.innerHTML = upcoming.map(x => `<article class="reminder-row" data-reminder-id="${x.id}">
    <div class="reminder-time">${new Date(nextOccurrence(x)).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div>
    <div class="reminder-main"><strong>${escapeHTML(x.title)}</strong><span>${formatDate(nextOccurrence(x), true)} • ${repeatLabel(x.repeat)}</span></div>
    <button class="icon-btn" data-delete-reminder aria-label="حذف">🗑️</button>
  </article>`).join('');
  $$('[data-reminder-id]', container).forEach(row => row.onclick = e => { if (!e.target.closest('[data-delete-reminder]')) openReminderDialog(row.dataset.reminderId); });
  $$('[data-delete-reminder]', container).forEach(btn => btn.onclick = async e => {
    e.stopPropagation(); const id=btn.closest('[data-reminder-id]').dataset.reminderId; const item=await getById('reminders',id);
    const yes=await confirmDialog({title:'حذف التنبيه',message:'هل تريد حذف هذا التنبيه؟',confirmText:'حذف',danger:true}); if(!yes)return;
    await cancelNative(item); await remove('reminders',id); toast('تم حذف التنبيه'); await refreshCallback();
  });
}

function repeatLabel(v) { return ({once:'مرة واحدة',daily:'يومي',weekly:'أسبوعي',monthly:'شهري',yearly:'سنوي'})[v] || 'مرة واحدة'; }

export async function openReminderDialog(id=null) {
  editingId=id;
  const item=id?await getById('reminders',id):null;
  $('#reminder-title').value=item?.title||'';
  $('#reminder-note').value=item?.note||'';
  const when=item?new Date(item.dateTime):new Date(Date.now()+60*60*1000);
  const local=new Date(when.getTime()-when.getTimezoneOffset()*60000).toISOString().slice(0,16);
  $('#reminder-datetime').value=local;
  $('#reminder-repeat').value=item?.repeat||'once';
  $('#reminder-dialog').showModal();
}

async function saveReminder() {
  const title=$('#reminder-title').value.trim(); const dt=$('#reminder-datetime').value;
  if(!title||!dt)return toast('اكتب عنوانًا وحدد التاريخ والوقت');
  const old=editingId?await getById('reminders',editingId):null;
  const reminder={ id:editingId||uid(), title, note:$('#reminder-note').value.trim(), dateTime:new Date(dt).toISOString(), repeat:$('#reminder-repeat').value, createdAt:old?.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString() };
  await put('reminders',reminder);
  try { await scheduleNative(reminder); } catch(err) { console.warn(err); toast('تم الحفظ، لكن يلزم السماح بالإشعارات لتفعيل التنبيه'); }
  $('#reminder-dialog').close(); toast('تم حفظ التنبيه'); await refreshCallback();
}

export function startWebReminderWatcher() {
  if (Capacitor.isNativePlatform()) return;
  clearInterval(webTimer);
  webTimer=setInterval(async()=>{
    if (!('Notification' in window) || Notification.permission!=='granted') return;
    const items=await getReminders(); const now=Date.now();
    for(const r of items){
      if(r.repeat!=='once') continue;
      const t=new Date(r.dateTime).getTime();
      if(Math.abs(t-now)<30000 && !sessionStorage.getItem(`fired-${r.id}`)){
        new Notification(r.title,{body:r.note||'لديك تنبيه الآن',icon:'./assets/icons/icon-192.png'});
        sessionStorage.setItem(`fired-${r.id}`,'1');
      }
    }
  },15000);
}

export function initRemindersUI() {
  $('#add-reminder-btn').onclick=()=>openReminderDialog();
  $('#reminder-cancel').onclick=()=>$('#reminder-dialog').close();
  $('#reminder-save').onclick=saveReminder;
  $$('[data-notification-permission]').forEach(btn=>btn.onclick=async()=>toast(await requestReminderPermission()?'تم السماح بالإشعارات':'لم يتم السماح بالإشعارات'));
}
