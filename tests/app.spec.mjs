import {test,expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';

async function startup(page) {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/ready/);
  await expect(page.locator('#metric-notes')).toHaveText(/\d+/);
  await expect(page.locator('#quick-capture')).toBeVisible();
  expect(errors.filter(x=>!x.includes('serviceWorker'))).toEqual([]);
}

async function go(page, screen){
  const nav=page.locator('[data-nav="'+screen+'"]:visible').first();
  if(await nav.count())return nav.click();
  await page.locator('[data-nav="home"]:visible').first().click();
  await page.locator('[data-go="'+screen+'"]:visible').first().click();
}

test('All base navigation, panel buttons and glass styling load',async({page})=>{
  await startup(page);
  await expect(page.locator('.hero-panel')).toBeVisible();
  const font=await page.locator('.hero-panel h2').evaluate(e=>getComputedStyle(e).fontFamily);
  expect(font).toContain('Aref');
  await page.locator('[data-go=notes]').first().click();
  await expect(page.locator('[data-section=notes]')).toBeVisible();
  await page.locator('#new-note-btn').click();
  await expect(page.locator('#note-editor')).toHaveClass(/open/);
  for(const id of ['add-text','add-rich','add-link'])await page.locator('#'+id).click();
  await expect(page.locator('#note-blocks .editor-block')).toHaveCount(4);
  await page.locator('#note-close').click();
  for(const screen of ['home','notes','expenses','reminders','files','settings','studio']){
    await go(page,screen);
    await expect(page.locator('[data-section="'+screen+'"]')).toBeVisible();
  }
  await go(page,'home');
});
test('Save, reopen, reorder, favorite, pin and search rich notes',async({page})=>{
  await startup(page);
  await page.locator('#quick-capture-text').fill('ملاحظة سريعة تم حفظها للتجربة');
  await page.locator('#quick-capture-save').click();
  await expect(page.locator('#metric-notes')).toHaveText('1');
  await page.locator('#new-note-btn').count().then(async()=>{await page.locator('[data-go=notes]').first().click();});
  await page.locator('#new-note-btn').click();
  await page.locator('#note-title').fill('مذكرة تجريبية');
  await page.locator('#note-blocks textarea').first().fill('تفاصيل اختبار الملاحظة');
  await page.locator('#add-rich').click();
  await page.locator('#note-blocks .rich-block').fill('نص منسق للاختبار');
  await page.locator('#add-link').click();
  await page.locator('.link-title').fill('موقع تجريبي');
  await page.locator('.link-url').fill('https://example.com/');
  await page.locator('.link-url').dispatchEvent('change');
  await expect(page.locator('.note-link-preview')).toHaveCount(1);
  await page.locator('#note-pin').click();await page.locator('#note-favorite').click();
  await page.locator('#note-blocks .editor-block').last().locator('.block-reorder button').first().click();
  await page.locator('#note-save').click();
  await expect(page.locator('#notes-container .note-card')).toHaveCount(2);
  await page.locator('#notes-search').fill('مذكرة تجريبية');
  await expect(page.locator('#notes-container .note-card')).toHaveCount(1);
  await page.locator('#notes-container .note-card').click();
  await expect(page.locator('#note-title')).toHaveValue('مذكرة تجريبية');
  await expect(page.locator('#note-blocks .editor-block')).toHaveCount(3);
  await page.locator('#note-close').click();
  await page.locator('#notes-view-toggle').click();
  await expect(page.locator('#notes-container')).toHaveClass(/list/);
});
test('Expense buttons, calculator, filters, reset confirmation',async({page})=>{
  await startup(page);
  await page.locator('[data-go=expenses]').click();
  await page.locator('#add-expense-btn').click();
  await expect(page.locator('#expense-dialog')).toBeVisible();
  await page.locator('#expense-description').fill('قهوة');
  await page.locator('#calculator [data-key="2"]').click();
  await page.locator('#calculator [data-key="5"]').click();
  await page.locator('#calculator [data-key="+"]').click();
  await page.locator('#calculator [data-key="5"]').click();
  await page.locator('#calculator [data-key="="]').click();
  await expect(page.locator('#expense-amount')).toHaveValue('30');
  await page.locator('#expense-save').click();
  await expect(page.locator('#expense-count')).toHaveText('1');
  await page.locator('[data-expense-filter="today"]').click();
  await expect(page.locator('.expense-row')).toHaveCount(1);
  await page.locator('#expense-reset').click();
  await expect(page.locator('#confirm-dialog')).toBeVisible();
  await page.locator('#confirm-dialog [data-cancel]').click();
  await expect(page.locator('.expense-row')).toHaveCount(1);
  await page.locator('#expense-reset').click();
  await page.locator('#confirm-dialog [data-confirm]').click();
  await expect(page.locator('#expense-count')).toHaveText('0');
});
test('Reminders, settings, file manager and functional export',async({page})=>{
  await startup(page);
  await page.locator('[data-go=reminders]').click();
  await page.locator('#add-reminder-btn').click();
  await page.locator('#reminder-title').fill('مكالمة تجريبية');
  await page.locator('#reminder-save').click();
  await expect(page.locator('.reminder-row')).toHaveCount(1);
  await page.locator('.reminder-row').click();
  await expect(page.locator('#reminder-dialog')).toBeVisible();
  await page.locator('#reminder-cancel').click();
  await go(page,'settings');
  await page.locator('#appearance-select').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.locator('#accent-select').selectOption('#0ea5e9');
  const dl=page.waitForEvent('download');
  await page.locator('#export-data').click();
  const result=await dl;expect(result.suggestedFilename()).toContain('.json');
  await go(page,'files');
  const picker=page.waitForEvent('filechooser');
  await page.locator('#add-file-btn').click();
  const chooser=await picker;
  await chooser.setFiles({name:'hello.txt',mimeType:'text/plain',buffer:Buffer.from('Hello note file')});
  await expect(page.locator('.file-card')).toHaveCount(1);
  await page.locator('.file-card [data-open]').click();
  await expect(page.locator('#file-preview')).toHaveClass(/open/);
  await page.locator('#file-preview-close').click();
  page.once('dialog',dialog=>dialog.accept('renamed.txt'));
  await page.locator('.file-card [data-rename]').click();
  await expect(page.locator('.file-card')).toContainText('renamed.txt');
  const dl2=page.waitForEvent('download');await page.locator('.file-card [data-download]').click();await dl2;
  await page.locator('.file-card [data-delete]').click();
  await expect(page.locator('#confirm-dialog')).toBeVisible();
  await page.locator('#confirm-dialog [data-confirm]').click();
  await expect(page.locator('.file-card')).toHaveCount(0);
});
test('PDF buttons: merge, extract, delete pages, rotate, reorder',async({page})=>{
  await startup(page);
  await go(page,'studio');
  await expect(page.locator('#studio-panel')).toBeVisible();
  const create=async()=>{
    const doc=await PDFDocument.create();doc.addPage([300,500]);doc.addPage([300,500]);
    return Buffer.from(await doc.save());
  };
  const picker=page.waitForEvent('filechooser');await page.locator('#studio-pick').click();
  await (await picker).setFiles([{name:'a.pdf',mimeType:'application/pdf',buffer:await create()},{name:'b.pdf',mimeType:'application/pdf',buffer:await create()}]);
  await expect(page.locator('.studio-item')).toHaveCount(2);
  for(const key of ['merge','split','delete-pages','rotate','reverse']){
    if(key==='delete-pages')await page.locator('#studio-pages').fill('1');
    const dl=page.waitForEvent('download');
    await page.locator('#studio-'+key).click();
    const file=await dl;
    expect(file.suggestedFilename()).toContain('.pdf');
  }
  await page.locator('#studio-clear').click();
  await expect(page.locator('.studio-item')).toHaveCount(0);
});
test('Audio recorder works, stops and adds playable voice note',async({page})=>{
  await startup(page);
  await page.locator('#quick-note').click();
  await expect(page.locator('#note-editor')).toHaveClass(/open/);
  await page.locator('#note-title').fill('تجربة مسجل الصوت');
  await page.locator('#add-record').click();
  await expect(page.locator('#recording-indicator')).toBeVisible({timeout:15000});
  await page.waitForTimeout(1400);
  await page.locator('#recording-pause').click();
  await expect(page.locator('#recording-indicator')).toHaveAttribute('data-state','paused');
  await page.locator('#recording-pause').click();
  await page.waitForTimeout(1300);
  await page.locator('#recording-stop').click();
  await expect(page.locator('#recording-indicator')).toBeHidden({timeout:18000});
  await expect(page.locator('#note-blocks audio')).toHaveCount(1);
  await page.locator('#note-save').click();
  await go(page,'notes');
  await expect(page.locator('#notes-container .note-card')).toHaveCount(1);
  await page.locator('#notes-container .note-card').click();
  await expect(page.locator('#note-blocks audio')).toHaveCount(1);
});
