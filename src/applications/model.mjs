import './context.js';
const { clean, normalize, safeUrl, routeInfo, identityKeys } = globalThis.OJAFApplicationContext;
export { safeUrl };
export const APPLICATIONS_KEY = 'applicationsV1';
const EDITABLE = ['company', 'position', 'sourceUrl', 'pageTitle', 'notes', 'statusId'];
export function applicationError(message, code = 'APPLICATION_INVALID') { return Object.assign(new Error(message), { code }); }
export function createStore() {
  return { schemaVersion: 1, revision: 0, statusesRevision: 0, records: [], events: [], statuses: [
    ['filled', '填写'], ['submitted', '已投递'], ['test', '笔试'], ['interview', '面试'], ['offer', 'Offer'], ['rejected', '未通过'], ['withdrawn', '已撤回']
  ].map(([id, label]) => ({ id, label })) };
}
export function readStore(value) {
  if (value === undefined) return createStore();
  if (value?.schemaVersion !== 1 || !Array.isArray(value.records) || !Array.isArray(value.statuses) || !value.statuses.some(status => status.id === 'filled')) throw applicationError('投递记录格式异常，请先备份本机数据后检查，未覆盖原有记录。');
  return structuredClone({ ...value, events: value.events || [] });
}
function checkRevision(record, revision) {
  if (record.revision !== revision) throw applicationError('这条记录已在其他页面更新。请重新加载后再编辑，当前修改尚未保存。', 'APPLICATION_CONFLICT');
}
function next(store) { const result = readStore(store); result.revision++; return result; }
function validStatus(store, id) {
  if (!store.statuses.some(status => status.id === id)) throw applicationError('所选状态已删除，请重新加载状态列表。', 'APPLICATION_CONFLICT');
}
function text(value, max, label) {
  if (typeof value !== 'string' || value.length > max) throw applicationError(`${label}格式不正确或超过 ${max} 字。`);
  return value.trim();
}
function canonicalContext(raw) {
  const sourceUrl = safeUrl(raw.sourceUrl);
  if (!sourceUrl) throw applicationError('无法记录这个网页地址。');
  const route = routeInfo(sourceUrl);
  const jobUrl = safeUrl(raw.jobUrl || '');
  return { company: clean(raw.company), position: clean(raw.position), pageTitle: clean(raw.pageTitle, 500), sourceUrl, siteHost: route.host, jobId: clean(raw.jobId || route.jobId, 160), jobUrl: jobUrl && new URL(jobUrl).origin === new URL(sourceUrl).origin ? jobUrl : '', scope: route.scope };
}
function freshRecord(fields, now, id) {
  return { id, company: '', position: '', sourceUrl: '', pageTitle: '', siteHost: '', statusId: 'filled', notes: '', createdAt: now, updatedAt: now, lastFilledAt: null, fillCount: 0, revision: 1, manualFields: [], identityKeys: [], pageInstances: [], ...fields };
}
export function recordFill(store, payload, { now = new Date().toISOString(), id = crypto.randomUUID() } = {}) {
  if (!(Number(payload.filled) > 0)) return { store, record: null, changed: false };
  const context = canonicalContext(payload.context || {});
  const instance = clean(payload.instanceKey, 200), event = clean(payload.eventKey, 240);
  if (!instance || !event) throw applicationError('缺少填写事件标识。');
  const previousEvent = store.events?.find(item => item.key === event);
  if (previousEvent) {
    const record = store.records.find(record => record.id === previousEvent.recordId);
    if (!record) throw applicationError('这次填写的记录已被删除。可在管理页手动新增。');
    return { store, record, changed: false };
  }
  const keys = identityKeys(context);
  const matches = [...store.records].reverse().filter(record => record.identityKeys.some(key => keys.includes(key)) || record.pageInstances.includes(instance));
  const original = matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const result = next(store);
  let record;
  if (original) {
    record = result.records.find(record => record.id === original.id);
    for (const key of ['company', 'position', 'sourceUrl', 'pageTitle']) {
      if (!record.manualFields.includes(key) && context[key] && (!record[key] || key === 'sourceUrl')) record[key] = context[key];
    }
    record.revision++;
  } else {
    record = freshRecord({ company: context.company, position: context.position, sourceUrl: context.sourceUrl, pageTitle: context.pageTitle, siteHost: context.siteHost, source: 'autofill' }, now, id);
    result.records.push(record);
  }
  record.identityKeys = [...new Set([...record.identityKeys, ...keys])];
  record.pageInstances = [...new Set([...record.pageInstances, instance])].slice(-30);
  record.siteHost = routeInfo(record.sourceUrl).host;
  record.fillCount++; record.lastFilledAt = now; record.updatedAt = now;
  result.events.push({ key: event, recordId: record.id }); result.events = result.events.slice(-1000);
  return { store: result, record, changed: true };
}
export function saveRecord(store, payload, { now = new Date().toISOString(), id = crypto.randomUUID() } = {}) {
  const changes = payload.changes || {};
  const original = payload.id ? store.records.find(record => record.id === payload.id) : null;
  if (payload.id && !original) throw applicationError('记录已被删除，未重新创建。', 'APPLICATION_CONFLICT');
  if (original) checkRevision(original, payload.expectedRevision);
  const result = next(store);
  const record = original ? result.records.find(record => record.id === original.id) : freshRecord({ source: 'manual' }, now, id);
  for (const key of EDITABLE) {
    if (!Object.hasOwn(changes, key)) continue;
    const value = text(changes[key], key === 'notes' ? 5000 : key === 'sourceUrl' ? 2048 : key === 'pageTitle' ? 500 : 240, key === 'notes' ? '备注' : '字段');
    if (key === 'statusId') validStatus(store, value);
    if (key === 'sourceUrl' && value && !safeUrl(value)) throw applicationError('来源链接仅支持完整的 http:// 或 https:// 地址。');
    record[key] = key === 'sourceUrl' && value ? safeUrl(value) : value;
    if (!record.manualFields.includes(key)) record.manualFields.push(key);
  }
  if (!record.company && !record.position && !record.sourceUrl && !record.pageTitle) throw applicationError('请至少填写公司、岗位、来源链接或网页标题之一。');
  record.siteHost = routeInfo(record.sourceUrl).host;
  record.updatedAt = now;
  if (!original && record.sourceUrl) {
    // Manual additions remain distinct; a later fill can attach to the newest
    // explicitly recorded reapplication when its source identifies the job.
    record.identityKeys = identityKeys(canonicalContext(record));
  }
  if (original) record.revision++; else result.records.push(record);
  return { store: result, record, changed: true };
}
export function deleteRecord(store, payload) {
  const record = store.records.find(record => record.id === payload.id);
  if (!record) throw applicationError('记录已被删除，请刷新列表。', 'APPLICATION_CONFLICT');
  checkRevision(record, payload.expectedRevision);
  const result = next(store);
  result.records = result.records.filter(record => record.id !== payload.id);
  return { store: result, changed: true };
}
export function saveStatuses(store, payload, { now = new Date().toISOString() } = {}) {
  if (payload.expectedRevision !== store.statusesRevision) throw applicationError('状态列表已在其他页面更新，请重新加载。', 'APPLICATION_CONFLICT');
  if (!Array.isArray(payload.statuses) || !payload.statuses.length || payload.statuses.length > 100) throw applicationError('请保留 1–100 个状态。');
  const statuses = payload.statuses.map(status => ({ id: text(status.id, 80, '状态 ID'), label: text(status.label, 40, '状态名称') }));
  if (statuses.some(status => !/^[\w-]+$/.test(status.id) || !status.label) || new Set(statuses.map(status => status.id)).size !== statuses.length || new Set(statuses.map(status => normalize(status.label))).size !== statuses.length) throw applicationError('状态名称不能为空或重复，状态 ID 必须唯一。');
  if (!statuses.some(status => status.id === 'filled' && status.label === '填写')) throw applicationError('初始状态“填写”不能删除或改名。');
  const result = next(store);
  for (const record of result.records) {
    if (statuses.some(status => status.id === record.statusId)) continue;
    const target = payload.migrations?.[record.statusId];
    if (!statuses.some(status => status.id === target)) throw applicationError('删除正在使用的状态前，请指定记录迁移到哪个状态。');
    record.statusId = target; record.revision++; record.updatedAt = now;
  }
  result.statuses = statuses; result.statusesRevision++;
  return { store: result, changed: true };
}
// One owner and one write queue prevent tabs from overwriting each other's data.
export function createApplicationRepository(storage) {
  let queue = Promise.resolve();
  const read = async () => readStore((await storage.get(APPLICATIONS_KEY))[APPLICATIONS_KEY]);
  return {
    async list() { await queue; return read(); },
    mutate(operation, payload) {
      const task = queue.then(async () => {
        const result = operation(await read(), payload);
        if (result.changed) await storage.set({ [APPLICATIONS_KEY]: result.store });
        return { record: result.record || null, records: result.store.records, statuses: result.store.statuses, statusesRevision: result.store.statusesRevision };
      });
      queue = task.catch(() => undefined);
      return task;
    }
  };
}
