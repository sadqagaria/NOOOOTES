import { getAll, put, remove, clearStore } from './storage.js';
import { $, $$, uid, escapeHTML, formatMoney, formatDate, toast, confirmDialog } from './utils.js';

const DEFAULT_CATEGORIES = ['Food','Transportation','Bills','Shopping','Health','Entertainment','Work','Other'];
let refreshCallback = () => {};

export function setExpensesRefreshCallback(cb) { refreshCallback = cb; }

export async function getExpenses() {
  const items = await getAll('expenses');
  return items.sort((a,b) => new Date(b.date) - new Date(a.date));
}

export async function getExpenseStats() {
  const items = await getExpenses();
  const total = items.reduce((s,x) => s + Number(x.amount || 0), 0);
  const largest = items.length ? Math.max(...items.map(x => Number(x.amount || 0))) : 0;
  return { total, count: items.length, largest, average: items.length ? total/items.length : 0 };
}

function inRange(expense, filter) {
  if (filter === 'all') return true;
  const d = new Date(expense.date); const now = new Date();
  if (filter === 'today') return d.toDateString() === now.toDateString();
  if (filter === 'week') { const ago = new Date(now); ago.setDate(now.getDate()-7); return d >= ago; }
  if (filter === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
}

export async function renderExpenses(container, filter='all') {
  const all = await getExpenses();
  const items = all.filter(x => inRange(x, filter));
  const total = items.reduce((s,x) => s + Number(x.amount || 0), 0);
  const largest = items.length ? Math.max(...items.map(x => Number(x.amount || 0))) : 0;
  const avg = items.length ? total/items.length : 0;
  $('#expense-total-large').textContent = formatMoney(total);
  $('#expense-count').textContent = items.length;
  $('#expense-largest').textContent = formatMoney(largest);
  $('#expense-average').textContent = formatMoney(avg);
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><h3>لا توجد مصاريف بعد</h3><p>أضف أول مصروف وسيظهر الإجمالي تلقائيًا.</p><button class="primary" data-add-expense>+ إضافة مصروف</button></div>`;
    container.querySelector('[data-add-expense]')?.addEventListener('click', openExpenseDialog);
    return;
  }
  container.innerHTML = items.map(x => `<article class="expense-row" data-expense-id="${x.id}">
    <div class="expense-icon">${categoryIcon(x.category)}</div>
    <div class="expense-main"><strong>${escapeHTML(x.description)}</strong><span>${escapeHTML(x.category)} • ${formatDate(x.date)}</span></div>
    <b>${formatMoney(x.amount)}</b>
    <button class="icon-btn" data-delete-expense aria-label="حذف">🗑️</button>
  </article>`).join('');
  $$('[data-delete-expense]', container).forEach(btn => btn.onclick = async e => {
    e.stopPropagation(); const row = btn.closest('[data-expense-id]'); const item = all.find(x => x.id === row.dataset.expenseId);
    await remove('expenses', item.id); toast('تم حذف المصروف','تراجع', async()=>{ await put('expenses', item); await refreshCallback(); }); await refreshCallback();
  });
}

function categoryIcon(cat) {
  return ({Food:'🍔',Transportation:'🚕',Bills:'💡',Shopping:'🛍️',Health:'🩺',Entertainment:'🎬',Work:'💼',Other:'💳'})[cat] || '💳';
}

function safeCalc(expr) {
  const clean = String(expr).replace(/×/g,'*').replace(/÷/g,'/').replace(/%/g,'/100');
  if (!/^[0-9+\-*/().\s]+$/.test(clean)) throw new Error('bad expression');
  const result = Function(`"use strict"; return (${clean})`)();
  if (!Number.isFinite(result)) throw new Error('bad result');
  return Math.round(result * 100) / 100;
}

export function openExpenseDialog() {
  const dlg = $('#expense-dialog');
  $('#expense-description').value=''; $('#expense-amount').value=''; $('#calculator-display').value='';
  $('#expense-category').value='Food';
  dlg.showModal();
}

export function initExpensesUI() {
  DEFAULT_CATEGORIES.forEach(c => $('#expense-category').insertAdjacentHTML('beforeend', `<option>${c}</option>`));
  $('#add-expense-btn').onclick = openExpenseDialog;
  $('#expense-cancel').onclick = () => $('#expense-dialog').close();
  $('#expense-save').onclick = async () => {
    const description = $('#expense-description').value.trim();
    const amount = Number($('#expense-amount').value);
    if (!description || !(amount > 0)) return toast('اكتب وصفًا ومبلغًا صحيحًا');
    await put('expenses',{ id:uid(), description, amount, category:$('#expense-category').value, date:new Date().toISOString() });
    $('#expense-dialog').close(); toast('تمت إضافة المصروف'); await refreshCallback();
  };
  $$('#calculator [data-key]').forEach(btn => btn.onclick = () => {
    const display = $('#calculator-display'); const k = btn.dataset.key;
    if (k === 'C') display.value='';
    else if (k === '=') { try { const r=safeCalc(display.value); display.value=String(r); $('#expense-amount').value=String(r); } catch { toast('عملية حسابية غير صحيحة'); } }
    else display.value += k;
  });
  $('#expense-reset').onclick = async () => {
    const yes = await confirmDialog({title:'إعادة ضبط المصاريف',message:'هل أنت متأكد أنك تريد حذف كل المصاريف؟',confirmText:'حذف الكل',danger:true});
    if (!yes) return; const old = await getExpenses(); await clearStore('expenses'); toast('تم حذف كل المصاريف','تراجع',async()=>{for(const x of old) await put('expenses',x); await refreshCallback();}); await refreshCallback();
  };
}
