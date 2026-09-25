import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, readStore, recordFill, saveRecord, deleteRecord, saveStatuses, createApplicationRepository, APPLICATIONS_KEY } from '../src/applications/model.mjs';
const ctx = globalThis.OJAFApplicationContext;
const context = (overrides = {}) => ({ company: '示例科技有限公司', position: '前端工程师', sourceUrl: 'https://jobs.example.com/company/acme/jobs/123/apply', pageTitle: '前端工程师 - 示例科技有限公司', jobId: '123', ...overrides });
const event = (overrides = {}) => ({ context: context(), filled: 2, instanceKey: 'tab:page1', eventKey: 'tab:page1:run1', ...overrides });
const first = () => recordFill(createStore(), event(), { id: 'record-1', now: '2026-09-19T00:00:00.000Z' });

test('auto capture creates filled status without marking an application as submitted', () => {
  const before = createStore(); const result = recordFill(before, event());
  assert.equal(result.record.statusId, 'filled'); assert.equal(result.record.fillCount, 1);
  assert.equal(before.records.length, 0); assert.ok(result.record.lastFilledAt);
});
test('zero-success and failed runs create no records; partial success can record', () => {
  assert.equal(recordFill(createStore(), event({ filled: 0 })).store.records.length, 0);
  assert.equal(recordFill(createStore(), event({ filled: 1, failed: 9 })).store.records.length, 1);
});
test('same event retry does not double-count; next fill updates the same record', () => {
  const initial = first(); const retry = recordFill(initial.store, event());
  assert.equal(retry.changed, false); assert.equal(retry.record.fillCount, 1);
  const again = recordFill(initial.store, event({ eventKey: 'run2', instanceKey: 'new-tab' }));
  assert.equal(again.store.records.length, 1); assert.equal(again.record.fillCount, 2);
});
test('manual company, position, empty values, notes and status survive later fills', () => {
  const initial = first(); const edited = saveRecord(initial.store, { id: 'record-1', expectedRevision: 1, changes: { company: '修正后的公司', position: '', notes: '下周联系', statusId: 'interview' } });
  const again = recordFill(edited.store, event({ eventKey: 'run2' }));
  assert.equal(again.record.company, '修正后的公司'); assert.equal(again.record.position, ''); assert.equal(again.record.statusId, 'interview'); assert.equal(again.record.notes, '下周联系');
});
test('only fields edited manually are locked; later metadata can fill missing fields', () => {
  const result = recordFill(createStore(), event({ context: context({ company: '', position: '' }) }));
  const edited = saveRecord(result.store, { id: result.record.id, expectedRevision: 1, changes: { statusId: 'submitted' } });
  const again = recordFill(edited.store, event({ eventKey: 'run2' }));
  assert.equal(again.record.company, '示例科技有限公司'); assert.equal(again.record.statusId, 'submitted');
});
test('same company different jobs and shared ATS tenants remain separate', () => {
  const a = first();
  const b = recordFill(a.store, event({ instanceKey: 'p2', eventKey: 'e2', context: context({ jobId: '456', sourceUrl: 'https://jobs.example.com/company/acme/jobs/456/apply' }) }));
  assert.equal(b.store.records.length, 2);
  const c = recordFill(b.store, event({ instanceKey: 'p3', eventKey: 'e3', context: context({ sourceUrl: 'https://jobs.example.com/company/another/jobs/123/apply' }) }));
  assert.equal(c.store.records.length, 3);
  const d = recordFill(c.store, event({ instanceKey: 'p4', eventKey: 'e4', context: context({ company: '另一家公司' }) }));
  assert.equal(d.store.records.length, 4);
});
test('job ID matches across application steps; hash job routes keep separate IDs', () => {
  const result = first();
  const next = recordFill(result.store, event({ eventKey: 'step2', instanceKey: 'step-page', context: context({ sourceUrl: 'https://jobs.example.com/company/acme/jobs/123/resume' }) }));
  assert.equal(next.store.records.length, 1);
  assert.equal(ctx.routeInfo('https://ats.example/#/jobs/123').jobId, '123');
  assert.notEqual(ctx.routeInfo('https://ats.example/#/jobs/123').jobId, ctx.routeInfo('https://ats.example/#/jobs/456').jobId);
});
test('ambiguous generic pages only deduplicate in the same page instance', () => {
  const generic = event({ context: context({ company: '', position: '', jobId: '', sourceUrl: 'https://ats.example/apply' }) });
  const a = recordFill(createStore(), generic);
  const b = recordFill(a.store, { ...generic, eventKey: 'run2' }); assert.equal(b.store.records.length, 1);
  const c = recordFill(b.store, { ...generic, eventKey: 'run3', instanceKey: 'another-page' }); assert.equal(c.store.records.length, 2);
});
test('manual additions may represent an independent reapplication', () => {
  const original = first();
  const a = saveRecord(original.store, { changes: { company: '示例科技有限公司', position: '前端工程师', statusId: 'submitted' } });
  assert.equal(a.store.records.length, 2); assert.equal(a.record.fillCount, 0); assert.equal(a.record.lastFilledAt, null);
});
test('a later fill updates the newest manually added matching job without changing its status', () => {
  const original = first();
  const manual = saveRecord(original.store, { changes: { company: context().company, position: context().position, sourceUrl: context().sourceUrl, statusId: 'interview' } }, { id: 'manual-reapply', now: original.record.createdAt });
  const filled = recordFill(manual.store, event({ instanceKey: 'new-document', eventKey: 'new-fill' }));
  assert.equal(filled.store.records.length, 2); assert.equal(filled.record.id, 'manual-reapply');
  assert.equal(filled.record.statusId, 'interview'); assert.equal(filled.record.fillCount, 1);
});
test('stale edits and deletes conflict; deleted records are not silently recreated', () => {
  const initial = first(); const edited = saveRecord(initial.store, { id: 'record-1', expectedRevision: 1, changes: { notes: 'new' } });
  assert.throws(() => saveRecord(edited.store, { id: 'record-1', expectedRevision: 1, changes: { notes: 'old' } }), error => error.code === 'APPLICATION_CONFLICT');
  assert.throws(() => deleteRecord(edited.store, { id: 'record-1', expectedRevision: 1 }), /其他页面/);
  const removed = deleteRecord(edited.store, { id: 'record-1', expectedRevision: 2 });
  assert.throws(() => saveRecord(removed.store, { id: 'record-1', expectedRevision: 2, changes: {} }), /已被删除/);
  assert.throws(() => recordFill(removed.store, event()), /已被删除/);
});
test('custom statuses support add, rename, reorder and record migration on deletion', () => {
  const initial = first();
  let updated = saveStatuses(initial.store, { expectedRevision: 0, statuses: [...initial.store.statuses, { id: 'round2', label: '二面' }] });
  updated = saveRecord(updated.store, { id: 'record-1', expectedRevision: 1, changes: { statusId: 'round2' } });
  const statuses = updated.store.statuses.map(status => status.id === 'round2' ? { ...status, label: '技术二面' } : status).reverse();
  updated = saveStatuses(updated.store, { expectedRevision: 1, statuses });
  assert.equal(updated.store.statuses[0].label, '技术二面');
  const remaining = statuses.filter(status => status.id !== 'round2');
  assert.throws(() => saveStatuses(updated.store, { expectedRevision: 2, statuses: remaining }), /迁移/);
  const migrated = saveStatuses(updated.store, { expectedRevision: 2, statuses: remaining, migrations: { round2: 'interview' } });
  assert.equal(migrated.store.records[0].statusId, 'interview'); assert.equal(migrated.store.records[0].revision, 3);
});
test('filled status is reserved and duplicate or stale status definitions are rejected', () => {
  const store = createStore();
  assert.throws(() => saveStatuses(store, { expectedRevision: 0, statuses: store.statuses.filter(s => s.id !== 'filled') }), /不能删除/);
  assert.throws(() => saveStatuses(store, { expectedRevision: 0, statuses: [...store.statuses, { id: 'extra', label: '填写' }] }), /重复/);
  assert.throws(() => saveStatuses(store, { expectedRevision: 1, statuses: store.statuses }), /其他页面/);
});
test('unsafe URLs are rejected and invalid existing storage is not reset', () => {
  assert.throws(() => saveRecord(createStore(), { changes: { company: 'A', sourceUrl: 'javascript:alert(1)' } }), /http/);
  assert.throws(() => readStore({ schemaVersion: 2, records: [] }), /未覆盖/);
});
test('write queue preserves concurrent changes and recovers after storage errors', async () => {
  const memory = {}; let fail = false;
  const repository = createApplicationRepository({ get: async () => structuredClone(memory), set: async value => { await new Promise(resolve => setTimeout(resolve, 5)); if (fail) throw new Error('quota'); Object.assign(memory, structuredClone(value)); } });
  await Promise.all([repository.mutate(saveRecord, { changes: { company: 'A' } }), repository.mutate(saveRecord, { changes: { company: 'B' } })]);
  assert.equal((await repository.list()).records.length, 2);
  fail = true; await assert.rejects(repository.mutate(saveRecord, { changes: { company: 'C' } }), /quota/);
  assert.equal(memory[APPLICATIONS_KEY].records.length, 2);
  fail = false; await repository.mutate(saveRecord, { changes: { company: 'C' } }); assert.equal((await repository.list()).records.length, 3);
});
test('title extraction handles reversed ordering, Chinese dashes and platform suffixes', () => {
  for (const title of ['前端工程师 - 示例科技有限公司 - Moka', '示例科技有限公司 | 前端工程师 | 招聘官网', '前端工程师-示例科技有限公司']) assert.deepEqual(ctx.parseTitle(title), { company: '示例科技有限公司', position: '前端工程师' });
  assert.deepEqual(ctx.parseTitle('腾讯校园招聘 - 前端工程师'), { company: '腾讯', position: '前端工程师' });
  assert.deepEqual(ctx.parseTitle('填写简历 - Moka'), { company: '', position: '' });
});
test('JSON-LD wins over titles, handles @graph and does not pick the first ambiguous job', () => {
  const jobs = ctx.collectJobs({ '@graph': [{ '@type': 'JobPosting', identifier: { value: '1' }, title: '数据工程师', hiringOrganization: { name: '甲公司' } }, { '@type': 'JobPosting', identifier: '2', title: '产品经理', hiringOrganization: { name: '乙公司' } }] });
  const selected = ctx.resolveContext({ url: 'https://example.com/jobs/2', title: '申请职位', jobs });
  assert.equal(selected.company, '乙公司'); assert.equal(selected.position, '产品经理');
  const ambiguous = ctx.resolveContext({ url: 'https://example.com/apply', title: '填写简历', jobs });
  assert.equal(ambiguous.company, ''); assert.equal(ambiguous.position, '');
});
test('a stale structured job does not override the current route job', () => {
  const value = ctx.resolveContext({ url: 'https://example.com/jobs/2', title: '填写简历', jobs: [{ '@type': 'JobPosting', identifier: '1', title: '不应选中', hiringOrganization: { name: '错误公司' } }] });
  assert.equal(value.company, ''); assert.equal(value.jobId, '2');
});
test('URL cleanup removes tracking and credentials but preserves job identity and SPA routing', () => {
  assert.equal(ctx.safeUrl('https://name:pass@example.com/apply?jobId=2&utm_source=a&access_token=secret&tenantId=1#/jobs/2?token=secret&step=3'), 'https://example.com/apply?jobId=2&tenantId=1#/jobs/2?step=3');
  assert.equal(ctx.safeUrl('javascript:alert(1)'), '');
  assert.notEqual(ctx.routeInfo('https://ats.example/apply?jobId=2&tenantId=1').scope, ctx.routeInfo('https://ats.example/apply?jobId=2&tenantId=2').scope);
});
