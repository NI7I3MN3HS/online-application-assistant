import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const content = await readFile(new URL('../src/content.js', import.meta.url), 'utf8');
const options = await readFile(new URL('../src/options.js', import.meta.url), 'utf8');
function extractFunction(source, name, indent = '') {
  const start = source.indexOf(`${indent}function ${name}(`);
  assert.ok(start >= 0, name);
  const next = source.slice(start + indent.length + 1).search(new RegExp(`\\n${indent}(?:async )?function `));
  return next < 0 ? source.slice(start) : source.slice(start, start + indent.length + 1 + next);
}
const functions = ['normalizeText', 'compactText', 'normalizeMatchKey', 'getSemanticBucket', 'getFirstSemanticBucket', 'getEntryOccurrenceIndex'];
const api = vm.runInNewContext(functions.map(name => extractFunction(content, name, '  ')).join('\n') + `\n({${functions.join(',')}})`);

test('native field labels keep distinct semantic types instead of taking adjacent values', () => {
  for (const [label, category, bucket] of [
    ['姓名', '基本信息', 'fullName'], ['电话', '基本信息', 'phone'], ['学校', '教育经历', 'school'],
    ['专业课程', '教育经历', 'coursework'], ['所学专业', '教育经历', 'major'], ['职位', '工作经历', 'role']
  ]) assert.equal(api.getFirstSemanticBucket([label, '邮箱 | 证明人 | 其他字段'], category), bucket);
});

test('family and referee names retain their contextual semantic distinction', () => {
  assert.equal(api.getFirstSemanticBucket(['姓名'], '家庭信息'), 'familyName');
  assert.equal(api.getFirstSemanticBucket(['证明人姓名'], '工作经历'), 'referenceName');
});

test('repeat occurrence comes from the stored path, including titles without numbers', () => {
  assert.equal(api.getEntryOccurrenceIndex({ itemId: 'profileV2.sections.education.items[1].values[3]', subsection: '上海交通大学', category: '教育经历' }), 2);
  assert.equal(api.getEntryOccurrenceIndex({ itemId: 'profileV2.sections.project.items[0].values[1]', subsection: '2024 创新项目' }), 1);
  assert.equal(api.getEntryOccurrenceIndex({ subsection: '教育经历 3' }), 3);
});

const editorFunctions = ['renderStructuredField', 'collectStructuredFieldsFromScope', 'escapeHtml'];
const editor = vm.runInNewContext(editorFunctions.map(name => extractFunction(options, name)).join('\n') + '\n({renderStructuredField, collectStructuredFieldsFromScope})', {
  normalizePlainText: value => value.trim()
});

test('date controls retain present, year precision, and custom choices', () => {
  assert.match(editor.renderStructuredField({ label: '结束时间', key: 'end', type: 'month' }, '至今'), /type="text"[^>]*value="至今"/);
  assert.match(editor.renderStructuredField({ label: '开始时间', key: 'start', type: 'month' }, '2020'), /type="text"[^>]*value="2020"/);
  assert.match(editor.renderStructuredField({ label: '开始时间', key: 'start', type: 'month' }, '2020-09'), /type="month"/);
  assert.match(editor.renderStructuredField({ label: '学位', key: 'degree', type: 'select', options: ['', '学士'] }, '工学硕士'), /value="工学硕士" selected/);
});

const background = await readFile(new URL('../src/background.js', import.meta.url), 'utf8');
const migrate = vm.runInNewContext(extractFunction(background, 'migrateFieldMemoryPaths') + '\nmigrateFieldMemoryPaths');
test('legacy memory migrates to named paths independently of object key order', () => {
  const store = { entries: {
    email: { sourcePath: 'profileV2.sections.basic.values[2]', sourceLabel: '邮箱' },
    school: { sourcePath: 'profileV2.sections.education.items[1].values[0]', sourceLabel: '学校' },
    custom: { sourcePath: 'profileV2.sections.basic.custom[0].value', sourceLabel: '自定义' },
    unusual: { sourcePath: 'profileV2.sections.basic.values[4]', sourceLabel: '费用$&' }
  } };
  assert.equal(migrate(store), true);
  assert.equal(store.entries.email.sourcePath, 'profileV2.sections.basic.values["邮箱"]');
  assert.equal(store.entries.school.sourcePath, 'profileV2.sections.education.items[1].values["学校"]');
  assert.equal(store.entries.custom.sourcePath, 'profileV2.sections.basic.custom[0].value');
  assert.equal(store.entries.unusual.sourcePath, 'profileV2.sections.basic.values["费用$&"]');
  assert.equal(migrate(store), false);
});

test('new catalog paths are stable when Chrome storage sorts or new fields are inserted', () => {
  const append = vm.runInNewContext(extractFunction(content, 'appendProfileV2Values', '  ') + '\nappendProfileV2Values', { appendProfileV2Entry: (section, entry) => section.push(entry) });
  const first = [], second = [];
  const context = { prefix: 'profileV2.sections.basic.values' };
  append(first, { 邮箱: 'a@example.com', 电话: '13800000000' }, context);
  append(second, { 姓名: '张三', 电话: '13800000000', 邮箱: 'a@example.com' }, context);
  assert.equal(first.find(x => x.label === '邮箱').itemId, second.find(x => x.label === '邮箱').itemId);
  assert.equal(first[0].itemId, 'profileV2.sections.basic.values["邮箱"]');
});
