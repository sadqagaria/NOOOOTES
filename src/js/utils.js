export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function formatMoney(value, currency = 'EGP') {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0))} ${currency}`;
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  return new Intl.DateTimeFormat('ar-EG', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
}

export function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

export function stripHTML(html = '') {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

export function toast(message, actionText, onAction) {
  const host = document.getElementById('toast-host');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${escapeHTML(message)}</span>`;
  if (actionText) {
    const btn = document.createElement('button');
    btn.textContent = actionText;
    btn.onclick = () => { onAction?.(); el.remove(); };
    el.appendChild(btn);
  }
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 4500);
}

export function confirmDialog({ title = 'تأكيد', message, confirmText = 'تأكيد', danger = false }) {
  return new Promise(resolve => {
    const dlg = document.getElementById('confirm-dialog');
    dlg.querySelector('[data-title]').textContent = title;
    dlg.querySelector('[data-message]').textContent = message;
    const confirm = dlg.querySelector('[data-confirm]');
    confirm.textContent = confirmText;
    confirm.classList.toggle('danger', danger);
    const close = result => { dlg.close(); resolve(result); };
    dlg.querySelector('[data-cancel]').onclick = () => close(false);
    confirm.onclick = () => close(true);
    dlg.oncancel = e => { e.preventDefault(); close(false); };
    dlg.showModal();
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileIcon(type = '') {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎧';
  if (type.includes('pdf')) return '📕';
  if (type.includes('word') || type.includes('officedocument')) return '📘';
  if (type.startsWith('text/')) return '📄';
  return '📎';
}
