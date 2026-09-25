import { request, formatTime, node } from './api.mjs';
import { safeUrl } from './model.mjs';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let store = { records: [], statuses: [], statusesRevision: 0 }, selectedId = params.get('id'), editing = null;
let dirty = false, busy = false, statusDraft = [], statusBase = [], statusesRevision = 0, statusDirty = false, statusBusy = false;
const fields = { company: $('recordCompany'), position: $('recordPosition'), statusId: $('recordStatus'), sourceUrl: $('recordUrl'), pageTitle: $('recordPageTitle'), notes: $('recordNotes') };
function feedback(message, error = false) { $('applicationFeedback').textContent = message; $('applicationFeedback').classList.toggle('error', error); }
function statusFeedback(message, error = false) { $('statusesFeedback').textContent = message; $('statusesFeedback').classList.toggle('error', error); }
function leaveEditor() { return !dirty || confirm('当前记录有未保存的修改，确定放弃吗？'); }
function statusOptions(select, selected = '', includeAll = false) {
  select.replaceChildren(...(includeAll ? [node('option', { value: '', textContent: '全部状态' })] : []), ...store.statuses.map(status => node('option', { value: status.id, textContent: status.label })));
  if (selected && !store.statuses.some(status => status.id === selected) && !includeAll) select.append(node('option', { value: selected, textContent: '原状态已删除，请重新选择' }));
  select.value = selected;
}
function renderFilters() {
  statusOptions($('applicationStatusFilter'), $('applicationStatusFilter').value, true);
  const site = $('applicationSiteFilter').value || params.get('site') || '';
  const hosts = [...new Set(store.records.map(record => record.siteHost).filter(Boolean))].sort();
  if (site && !hosts.includes(site)) hosts.push(site);
  $('applicationSiteFilter').replaceChildren(node('option', { value: '', textContent: '全部网站' }), ...hosts.map(host => node('option', { value: host, textContent: host })));
  $('applicationSiteFilter').value = site;
  params.delete('site');
}
function renderTabs() {
  const focusedTab = document.activeElement?.dataset.statusFilterId;
  const current = $('applicationStatusFilter').value;
  const statuses = [{ id: '', label: '全部' }, ...store.statuses];
  $('applicationTabs').replaceChildren(...statuses.map(status => {
    const button = node('button', { type: 'button', textContent: status.label });
    button.dataset.statusFilterId = status.id;
    button.setAttribute('aria-pressed', String(current === status.id));
    if (current === status.id) button.setAttribute('aria-current', 'page');
    button.append(node('span', { className: 'tab-count', textContent: String(store.records.filter(record => !status.id || record.statusId === status.id).length) }));
    button.addEventListener('click', () => { $('applicationStatusFilter').value = status.id; renderList(); });
    return button;
  }));
  if (focusedTab !== undefined) [...$('applicationTabs').children].find(button => button.dataset.statusFilterId === focusedTab)?.focus({ preventScroll: true });
}
function renderList() {
  const focusedRecordId = document.activeElement?.dataset.recordId;
  const query = $('applicationSearch').value.trim().toLowerCase();
  const status = $('applicationStatusFilter').value, site = $('applicationSiteFilter').value;
  const records = store.records.filter(record => (!status || record.statusId === status) && (!site || record.siteHost === site)
    && (!$('incompleteOnly').checked || !record.company || !record.position)
    && (!query || [record.company, record.position, record.siteHost, record.pageTitle, record.notes].join(' ').toLowerCase().includes(query)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  $('applicationRows').replaceChildren();
  for (const record of records) {
    const row = node('tr'); row.classList.toggle('is-selected', record.id === selectedId);
    const first = node('td');
    const open = node('button', { type: 'button', className: 'record-open' });
    open.dataset.recordId = record.id;
    const stamp = node('span', { className: 'record-stamp', textContent: (record.company || '？').slice(0, 1) }); stamp.setAttribute('aria-hidden', 'true');
    const names = node('span', { className: 'record-names' });
    names.append(node('span', { className: 'record-position', textContent: record.position || '岗位待补全' }), node('span', { className: 'record-company', textContent: record.company || '公司待补全' }));
    open.append(stamp, names); open.addEventListener('click', () => chooseRecord(record.id));
    if (record.id === selectedId) open.setAttribute('aria-current', 'true');
    first.append(open);
    if (!record.company || !record.position) first.append(node('span', { className: 'source needs-info', textContent: '资料待补全' }));
    const statusCell = node('td'), badge = node('span', { className: 'badge', textContent: store.statuses.find(status => status.id === record.statusId)?.label || '未知状态' });
    const colors = { filled: '#807C75', submitted: '#38485C', test: '#B38B4D', interview: '#556B4F', offer: '#A8523A', rejected: '#BBB5A9', withdrawn: '#BBB5A9' };
    badge.style.setProperty('--status-color', colors[record.statusId] || '#807C75'); statusCell.append(badge);
    const source = node('td', { className: 'source-cell' }); source.append(node('span', { className: 'source', textContent: record.siteHost || '手动记录' }));
    row.append(first, statusCell, source, node('td', { className: 'date', textContent: formatTime(record.updatedAt) })); $('applicationRows').append(row);
  }
  renderTabs();
  $('applicationCount').textContent = `${records.length} / ${store.records.length} 条`;
  $('applicationEmpty').hidden = records.length > 0;
  $('applicationEmpty').querySelector('h3').textContent = store.records.length ? '没有符合条件的记录' : '还没有投递记录';
  $('applicationEmpty').querySelector('p').textContent = store.records.length ? '试试其他关键词，或调整状态和网站筛选。' : '用插件完成一次填写后，记录会自动出现在这里。也可以手动新增。';
  if (focusedRecordId) [...$('applicationRows').querySelectorAll('button')].find(button => button.dataset.recordId === focusedRecordId)?.focus({ preventScroll: true });
}
function renderEditor(record) {
  editing = record ? structuredClone(record) : { id: null, statusId: 'filled', company: '', position: '', sourceUrl: '', pageTitle: '', notes: '' };
  document.querySelector('.records-page').classList.remove('editor-collapsed');
  $('recordIdentity').hidden = !record;
  $('recordIdentityCompany').textContent = record?.company || '公司待补全';
  $('recordIdentityPosition').textContent = record?.position || '岗位待补全';
  dirty = false; $('applicationEditor').hidden = false; $('editorPlaceholder').hidden = true;
  $('applicationEditorTitle').textContent = record ? '记录详情' : '新增记录';
  statusOptions(fields.statusId, editing.statusId);
  for (const [key, control] of Object.entries(fields)) control.value = editing[key] || '';
  $('saveApplication').textContent = record ? '保存修改' : '新增记录';
  $('deleteApplication').hidden = !record; $('reloadApplication').hidden = !record;
  const href = safeUrl(editing.sourceUrl); $('openApplicationSource').hidden = !href;
  if (href) $('openApplicationSource').href = href; else $('openApplicationSource').removeAttribute('href');
  $('recordTimes').textContent = record ? `创建记录：${formatTime(record.createdAt)}\n最近更新：${formatTime(record.updatedAt)}\n最近填写：${formatTime(record.lastFilledAt)}\n填写次数：${record.fillCount} 次` : '手动记录不增加自动填写次数。';
}
function chooseRecord(id) {
  if (busy || !leaveEditor()) return;
  const record = store.records.find(record => record.id === id);
  if (!record) return;
  selectedId = id; renderEditor(record); renderList(); feedback('修改公司、岗位或状态后，点击“保存修改”。');
  fields.company.focus({ preventScroll: true });
  if (matchMedia('(max-width:720px)').matches) $('applicationEditorTitle').scrollIntoView({ block: 'start' });
}
async function load({ forceEditor = false, initial = false } = {}) {
  try {
    store = await request('OJAF_LIST_APPLICATIONS');
    if (initial && !selectedId) selectedId = [...store.records].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.id || null;
    renderFilters(); renderList();
    if (selectedId && (!dirty || forceEditor) && !busy) {
      const selected = store.records.find(record => record.id === selectedId);
      if (selected) renderEditor(selected);
      else { selectedId = null; editing = null; dirty = false; $('applicationEditor').hidden = true; $('editorPlaceholder').hidden = false; $('applicationEditorTitle').textContent = '记录已删除'; }
    }
  } catch (error) { feedback(`读取失败：${error.message}`, true); }
}
function setBusy(value) { busy = value; $('applicationEditorFields').disabled = value; $('addApplication').disabled = value; }
$('closeApplicationEditor').addEventListener('click', () => {
  if (busy || !leaveEditor()) return;
  dirty = false; selectedId = null; editing = null;
  document.querySelector('.records-page').classList.add('editor-collapsed');
  renderList(); $('addApplication').focus();
});
$('addApplication').addEventListener('click', () => {
  if (!leaveEditor()) return;
  selectedId = null; renderEditor(null); renderList(); feedback('填写公司或岗位，已有投递也可以手动补记。'); fields.company.focus();
});
$('applicationEditor').addEventListener('input', () => { dirty = true; });
$('applicationEditor').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !editing) return;
  const changes = Object.fromEntries(Object.entries(fields).filter(([key, field]) => !editing.id || field.value !== editing[key]).map(([key, field]) => [key, field.value]));
  setBusy(true);
  try {
    const data = await request('OJAF_SAVE_APPLICATION', { id: editing.id, expectedRevision: editing.revision, changes });
    dirty = false; selectedId = data.record.id; store.statuses = data.statuses; renderEditor(data.record);
    feedback('记录已保存到本机。');
  } catch (error) { feedback(error.message, true); }
  finally { setBusy(false); await load(); }
});
$('reloadApplication').addEventListener('click', () => { if (leaveEditor()) { dirty = false; void load({ forceEditor: true }); } });
$('deleteApplication').addEventListener('click', async () => {
  if (busy || !editing?.id || !confirm('确定删除这条投递记录吗？此操作无法撤销。')) return;
  setBusy(true);
  try { await request('OJAF_DELETE_APPLICATION', { id: editing.id, expectedRevision: editing.revision }); dirty = false; feedback('记录已删除。'); }
  catch (error) { feedback(error.message, true); }
  finally { setBusy(false); await load(); }
});
for (const id of ['applicationSearch', 'applicationStatusFilter', 'applicationSiteFilter', 'incompleteOnly']) $(id).addEventListener('input', renderList);
function renderStatusDraft(focusTarget = null) {
  $('statusRows').replaceChildren();
  statusDraft.forEach((status, index) => {
    const row = node('div', { className: 'status-row' }); row.dataset.statusId = status.id;
    const input = node('input', { value: status.label, maxLength: 40, disabled: status.id === 'filled' }); input.setAttribute('aria-label', `状态名称 ${index + 1}`);
    input.addEventListener('input', () => {
      status.label = input.value; statusDirty = true;
      row.querySelectorAll('button').forEach(button => button.setAttribute('aria-label', `${button.textContent}状态 ${status.label}`));
    }); row.append(input);
    for (const [label, action, disabled] of [['上移', -1, index === 0], ['下移', 1, index === statusDraft.length - 1], ['删除', 0, status.id === 'filled']]) {
      const button = node('button', { type: 'button', className: 'secondary', textContent: label, disabled }); button.setAttribute('aria-label', `${label}状态 ${status.label}`);
      button.dataset.statusAction = action;
      button.addEventListener('click', () => {
        if (action === 0) statusDraft.splice(index, 1); else [statusDraft[index], statusDraft[index + action]] = [statusDraft[index + action], statusDraft[index]];
        const targetId = action === 0 ? statusDraft[Math.min(index, statusDraft.length - 1)]?.id : status.id;
        statusDirty = true; renderStatusDraft({ id: targetId, action });
      }); row.append(button);
    }
    $('statusRows').append(row);
  });
  const prior = Object.fromEntries([...$('statusMigrations').querySelectorAll('select')].map(select => [select.dataset.removedId, select.value]));
  $('statusMigrations').replaceChildren();
  for (const removed of statusBase.filter(status => !statusDraft.some(item => item.id === status.id))) {
    const count = store.records.filter(record => record.statusId === removed.id).length;
    // Keep a migration choice even at count=0: another tab may assign it before saving.
    const label = node('label', { textContent: `删除“${removed.label}”：${count} 条记录迁移至` }); const select = node('select'); select.dataset.removedId = removed.id;
    select.append(node('option', { value: '', textContent: '请选择迁移目标' }), ...statusDraft.map(status => node('option', { value: status.id, textContent: status.label })));
    select.value = prior[removed.id] || ''; label.append(select); $('statusMigrations').append(label);
  }
  if (focusTarget) {
    const row = [...$('statusRows').children].find(row => row.dataset.statusId === focusTarget.id);
    const action = row?.querySelector(`[data-status-action="${focusTarget.action}"]:not(:disabled)`);
    (action || row?.querySelector('input:not(:disabled),button:not(:disabled)') || $('closeStatuses')).focus();
  }
}
async function startStatuses() {
  await load(); statusDraft = structuredClone(store.statuses); statusBase = structuredClone(store.statuses); statusesRevision = store.statusesRevision; statusDirty = false;
  renderStatusDraft(); statusFeedback('调整完成后保存，已有记录会保留对应状态。'); if (!$('statusesDialog').open) $('statusesDialog').showModal();
}
function closeStatuses(event) {
  if (statusBusy || (statusDirty && !confirm('状态设置有未保存修改，确定放弃吗？'))) { event?.preventDefault(); return; }
  $('statusesDialog').close(); statusDirty = false;
}
$('manageStatuses').addEventListener('click', () => void startStatuses());
$('closeStatuses').addEventListener('click', closeStatuses); $('statusesDialog').addEventListener('cancel', closeStatuses);
$('reloadStatuses').addEventListener('click', () => { if (!statusDirty || confirm('放弃未保存的状态修改并重新加载吗？')) void startStatuses(); });
$('addStatus').addEventListener('click', () => {
  const label = $('newStatusLabel').value.trim(); if (!label) { statusFeedback('请先填写新状态名称。', true); return; }
  if (statusDraft.some(status => status.label.trim().toLowerCase() === label.toLowerCase())) { statusFeedback('这个状态名称已经存在。', true); return; }
  statusDraft.push({ id: `custom-${crypto.randomUUID()}`, label }); statusDirty = true; $('newStatusLabel').value = ''; renderStatusDraft(); statusFeedback('已加入编辑列表，保存后生效。');
});
$('statusesForm').addEventListener('submit', async event => {
  event.preventDefault(); if (statusBusy) return;
  statusBusy = true; $('statusesFields').disabled = true;
  try {
    const migrations = Object.fromEntries([...$('statusMigrations').querySelectorAll('select')].map(select => [select.dataset.removedId, select.value]));
    await request('OJAF_SAVE_APPLICATION_STATUSES', { expectedRevision: statusesRevision, statuses: statusDraft, migrations });
    statusDirty = false; $('statusesDialog').close(); await load(); feedback('状态设置已保存，相关记录已更新。');
  } catch (error) { statusFeedback(error.message, true); }
  finally { statusBusy = false; $('statusesFields').disabled = false; }
});
window.addEventListener('beforeunload', event => { if (dirty || statusDirty || busy || statusBusy) { event.preventDefault(); event.returnValue = ''; } });
let refreshTimer;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.applicationsV1) return;
  clearTimeout(refreshTimer); refreshTimer = setTimeout(() => void load(), 100);
});
await load({ initial: true });
if (!$('applicationFeedback').classList.contains('error')) feedback('填写后自动记录；投递状态由你手动维护。');
