import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseResumeText, mergeResumeGroups, normalizeDate, MAX_TEXT_LENGTH, profileFingerprint } from '../src/resume/parser.mjs';
import { detectFileType, pdfItemsToText, checkDocxArchive, extractResumeFile } from '../src/resume/extract.mjs';

// Read the real editor schema so renaming a profile field breaks this contract test.
const options = await readFile(new URL('../src/options.js', import.meta.url), 'utf8');
const declaration = options.slice(options.indexOf('const STRUCTURED_RESUME_SECTIONS'), options.indexOf('let activeProfileSectionKey'));
const schema = JSON.parse(JSON.stringify(vm.runInNewContext(`${declaration}; STRUCTURED_RESUME_SECTIONS`, { profileFields: labels => labels.map(label => ({ label })) })));
const parse = text => parseResumeText(text, schema);
const section = (result, key) => result.groups.filter(group => group.sectionKey === key);
const empty = () => ({ schemaVersion: 2, updatedAt: '', customSections: [], sections: {} });
const resume = `张三
手机：138 0000 0000 | 邮箱：zhang@example.com
现居地：上海
教育背景
2020.09 - 2024.06  上海交通大学 | 计算机科学与技术 | 本科
主修课程：数据结构、操作系统
2017.09 - 2020.06  示例学院 | 软件工程 | 专科
工作经历
2024.07 - 至今  示例科技有限公司 | 前端工程师
负责招聘系统开发，改善表单体验。
实习经历
2023.07 - 2023.09  另一科技有限公司 | 开发实习生
维护网页表单。
项目经历
2023.10 - 2024.05  网申助手 | 项目负责人
项目描述：浏览器自动填表工具
本人职责：开发字段映射
专业技能
JavaScript、TypeScript、React
外语能力
CET-6 520
自我评价
重视协作与质量。`;

test('undo comparison ignores object key order, but catches edits and record reordering', () => {
  assert.equal(profileFingerprint({ updatedAt: 'a', sections: { basic: { values: { 姓名: '张三', 电话: '1' } } } }), profileFingerprint({ sections: { basic: { values: { 电话: '1', 姓名: '张三' } } }, updatedAt: 'b' }));
  assert.notEqual(profileFingerprint({ items: [1, 2] }), profileFingerprint({ items: [2, 1] }));
  assert.notEqual(profileFingerprint({ name: '张三' }), profileFingerprint({ name: '李四' }));
});

test('Chinese resume maps contacts and independently grouped experiences to editor schema', () => {
  const result = parse(resume);
  assert.equal(section(result, 'basic')[0].values['姓名'], '张三');
  assert.equal(section(result, 'basic')[0].values['邮箱'], 'zhang@example.com');
  assert.equal(section(result, 'education').length, 2);
  assert.equal(section(result, 'education')[0].values['学校'], '上海交通大学');
  assert.equal(section(result, 'education')[0].values['专业'], '计算机科学与技术');
  assert.equal(section(result, 'education')[0].values['学历'], '本科');
  assert.equal(section(result, 'work')[0].values['结束时间'], '至今');
  assert.equal(section(result, 'internship')[0].values['公司'], '另一科技有限公司');
  assert.equal(section(result, 'project')[0].values['项目名称'], '网申助手');
  assert.equal(section(result, 'language')[0].values['成绩'], '520');
  for (const group of result.groups) {
    const config = schema.find(config => config.key === group.sectionKey);
    assert.equal(group.kind, config.kind);
    for (const label of Object.keys(group.values)) assert.ok(config.fields.some(field => field.label === label), `${group.sectionKey}.${label}`);
  }
});

test('English headings and explicit fields map into the Chinese profile', () => {
  const result = parse(`Jane Smith\nEmail: jane@example.com\nPhone: +1 415 555 1234\nEducation\n2018 - 2022 | Example University | Computer Science | Bachelor\nWork Experience\n2022.08 - Present | Example Inc. | Software Engineer\nBuilt accessible forms.\nProjects\nProject name: Job Portal\nRole: Developer\nDescription: A job application tool.`);
  assert.equal(section(result, 'basic')[0].values['姓名'], 'Jane Smith');
  assert.equal(section(result, 'basic')[0].values['电话'], '+1 415 555 1234');
  assert.equal(section(result, 'education')[0].values['开始时间'], '2018');
  assert.equal(section(result, 'education')[0].values['学校'], 'Example University');
  assert.equal(section(result, 'project')[0].values['项目名称'], 'Job Portal');
});

test('does not take a referee phone or a project email as the applicant contact', () => {
  const result = parse('姓名：李四\n电话：13900000000\n工作经历\n公司：示例公司\n证明人联系方式：13800000000\n项目经历\n项目名称：邮箱工具\n项目描述：demo@example.com');
  assert.equal(section(result, 'basic')[0].values['电话'], '13900000000');
  assert.equal(section(result, 'basic')[0].values['邮箱'], undefined);
});

test('multiple unlabeled emails or phones are not arbitrarily picked', () => {
  const result = parse('李明\na@example.com b@example.com\n13800000000 13900000000');
  const basic = section(result, 'basic')[0];
  assert.equal(basic.values['邮箱'], undefined);
  assert.equal(basic.values['电话'], undefined);
  assert.ok(basic.warnings.some(warning => warning.includes('多个')));
});

test('keeps repeated explicitly labeled schools in separate records', () => {
  const result = parse('教育经历\n学校：甲大学\n专业：数学\n学校：乙大学\n专业：物理');
  assert.equal(section(result, 'education').length, 2);
  assert.equal(section(result, 'education')[1].values['学校'], '乙大学');
});

test('inline headings and spaced Chinese headings are recognized', () => {
  const result = parse('姓名：王五\n求职意向：前端工程师\n教 育 背 景\n学校：甲大学');
  assert.equal(section(result, 'intention')[0].values['意向岗位'], '前端工程师');
  assert.equal(section(result, 'education')[0].values['学校'], '甲大学');
});

test('unrecognized sections stay visible instead of claiming successful mapping', () => {
  const result = parse('家庭情况\n这段无法可靠结构化');
  assert.equal(result.groups.length, 0);
  assert.equal(result.unclassified.length, 1);
});

test('descriptions preserve multiline content and HTML as inert text', () => {
  const result = parse('项目经历\n项目名称：<img src=x onerror=alert(1)>\n项目描述：第一行\n第二行\n本人职责：第三行');
  const values = section(result, 'project')[0].values;
  assert.equal(values['项目名称'], '<img src=x onerror=alert(1)>');
  assert.equal(values['项目内容'], '第一行\n第二行');
  assert.equal(values['本人职责'], '第三行');
});

test('date conversion preserves year precision and present instead of inventing dates', () => {
  for (const [source, expected] of [['2020年9月', '2020-09'], ['2020.09', '2020-09'], ['2020', '2020'], ['Present', '至今'], ['2020/09/08', '2020-09-08']]) assert.equal(normalizeDate(source), expected);
});

test('rejects empty and oversized input', () => {
  assert.throws(() => parse('  '), /没有可解析/);
  assert.throws(() => parse('a'.repeat(MAX_TEXT_LENGTH + 1)), /20 万/);
});

test('merge preserves existing values, custom sections, and the original object', () => {
  const original = empty();
  original.sections.basic = { key: 'basic', title: '基本信息', kind: 'simple', values: { 姓名: '保留姓名' }, custom: [{ label: '自定义', value: '保留值' }] };
  original.customSections.push({ key: 'extra', values: { test: 'original' } });
  const before = structuredClone(original);
  const { profile, stats } = mergeResumeGroups(original, section(parse(resume), 'basic'));
  assert.deepEqual(original, before);
  assert.equal(profile.sections.basic.values['姓名'], '保留姓名');
  assert.equal(profile.sections.basic.values['邮箱'], 'zhang@example.com');
  assert.deepEqual(profile.customSections, original.customSections);
  assert.equal(stats.preserved, 1);
});

test('overwrite only changes selected nonempty fields', () => {
  const original = empty();
  original.sections.basic = { values: { 姓名: '旧姓名', 电话: '13800000000' }, custom: [] };
  const groups = section(parse('姓名：新姓名\n电话：'), 'basic');
  const { profile, stats } = mergeResumeGroups(original, groups, { overwrite: true });
  assert.equal(profile.sections.basic.values['姓名'], '新姓名');
  assert.equal(profile.sections.basic.values['电话'], '13800000000');
  assert.equal(stats.updated, 1);
});

test('reimport is idempotent and preserves existing record indices', () => {
  const groups = parse(resume).groups;
  const first = mergeResumeGroups(empty(), groups).profile;
  const again = mergeResumeGroups(first, groups);
  assert.equal(again.stats.added, 0);
  assert.equal(again.stats.newItems, 0);
  const next = parse('教育经历\n2025.09 - 至今  新大学 | 软件工程 | 硕士').groups;
  const last = mergeResumeGroups(first, next).profile;
  assert.equal(last.sections.education.items[0].values['学校'], '上海交通大学');
  assert.equal(last.sections.education.items[2].values['学校'], '新大学');
});

test('different jobs at the same company are not merged by company alone', () => {
  const first = mergeResumeGroups(empty(), parse('工作经历\n2020.01 - 2021.01 | 示例有限公司 | 开发工程师').groups).profile;
  const next = mergeResumeGroups(first, parse('工作经历\n2023.01 - 2024.01 | 示例有限公司 | 开发工程师').groups);
  assert.equal(next.profile.sections.work.items.length, 2);
});

test('uniquely identified same experience fills missing values without duplicating it', () => {
  const groups = parse('教育经历\n学校：甲大学\n专业：计算机\n开始时间：2020.09\n学历：本科').groups;
  const original = mergeResumeGroups(empty(), groups).profile;
  const updated = structuredClone(groups);
  updated[0].values['成绩'] = '3.8';
  const next = mergeResumeGroups(original, updated);
  assert.equal(next.profile.sections.education.items.length, 1);
  assert.equal(next.profile.sections.education.items[0].values['成绩'], '3.8');
});

test('PDF text reconstruction handles out-of-order chunks and split Chinese glyphs', () => {
  const item = (str, x, y, width) => ({ str, width, height: 10, transform: [10, 0, 0, 10, x, y] });
  const result = pdfItemsToText([item('三', 20, 100, 10), item('邮箱', 10, 80, 20), item('张', 10, 100, 10), item('a@example.com', 100, 80, 80)]);
  assert.equal(result.text, '张三\n邮箱\ta@example.com');
});

test('file type and signature checks reject old DOC, renamed files, and broken archives', async () => {
  assert.equal(detectFileType('CV.PDF'), 'pdf');
  assert.throws(() => detectFileType('cv.doc'), /旧版/);
  assert.throws(() => detectFileType('cv.jpg'), /扫描件/);
  assert.throws(() => checkDocxArchive(new ArrayBuffer(32)), /不是有效/);
  await assert.rejects(extractResumeFile(new TextEncoder().encode('not a PDF').buffer, 'pdf'), /不是有效/);
});

test('plain text extraction supports UTF-8 and UTF-16 with BOM', async () => {
  const utf8 = await extractResumeFile(new TextEncoder().encode('姓名：张三').buffer, 'txt');
  assert.equal(utf8.text, '姓名：张三');
  const bytes = Buffer.from('\ufeff姓名：李四', 'utf16le');
  const utf16 = await extractResumeFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'txt');
  assert.equal(utf16.text, '姓名：李四');
});
