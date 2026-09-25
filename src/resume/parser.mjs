// Local, conservative resume-to-profile mapping. Document text is never sent to AI.
export const MAX_TEXT_LENGTH = 200_000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;

const HEADINGS = {
  basic: ['基本信息', '个人信息', '个人资料', '联系方式', 'personal information', 'contact', 'contact details'],
  intention: ['求职意向', '求职目标', '职业目标', 'job objective', 'career objective', 'objective'],
  education: ['教育经历', '教育背景', '学习经历', '学历经历', 'education', 'academic background'],
  internship: ['实习经历', '实习经验', 'internship', 'internships', 'internship experience'],
  work: ['工作经历', '工作经验', '职业经历', '工作与实习经历', '工作/实习经历', 'work experience', 'professional experience', 'employment history', 'experience'],
  project: ['项目经历', '项目经验', '项目经历/实践活动', '实践经历', '实践活动', 'projects', 'project experience', 'selected projects'],
  student: ['校园经历', '在校职务', '学生工作', '校园活动', '社团经历', '社团和组织经历', '社团与组织经历', '干部任职经历', 'leadership', 'activities'],
  awards: ['荣誉奖项', '获奖经历', '获奖情况', '荣誉奖励', '奖项和荣誉', '奖项与荣誉', '奖惩情况', '奖励情况', '荣誉成果', 'awards', 'honors', 'honors and awards'],
  language: ['外语能力', '语言能力', '英语能力', 'languages', 'language skills'],
  computer: ['专业技能', '技能专长', '技能清单', '技术技能', '技能', '计算机技能', '计算机技能（IT技能）', 'it技能', 'skills', 'technical skills', 'core skills'],
  certificates: ['证书', '资格证书', '证书信息', '职业资格', 'certificates', 'certifications'],
  training: ['培训经历', '培训', 'training'],
  papers: ['论文和著作', '论文著作', '学术成果', '发表论文', 'publications'],
  patent: ['专利', '专利成果', 'patents'],
  self: ['自我评价', '自我描述', '自我介绍', '个人优势', '职业概述', 'summary', 'profile', 'professional summary', 'about me'],
  other: ['其他信息', '补充信息', '兴趣爱好', '个人作品', '其他', 'additional information', 'interests', 'references'],
  family: ['家庭情况', '家庭信息'],
  performance: ['绩效考核', '年度绩效'],
  declarations: ['有关声明', '个人声明']
};
const ALIASES = {
  '姓名': ['名字', 'name', 'full name'], '电话': ['手机', '手机号', '手机号码', '联系电话', '联系方式', 'phone', 'mobile', 'tel'],
  '邮箱': ['电子邮箱', '电子邮件', 'email', 'e-mail'], '英文名': ['english name'], '出生日期': ['出生年月', '生日', 'date of birth'],
  '现居住城市': ['现居地', '现居城市', '所在地', '居住地', 'location'], '现居住详细地址': ['居住地址', 'address'],
  '学校': ['毕业院校', '毕业学校', '院校', 'school', 'university'], '专业': ['所学专业', 'major'], '学历': ['degree', '最高学历'],
  '开始时间': ['起始时间', '入学时间', '入职时间', 'start date'], '结束时间': ['毕业时间', '离职时间', 'end date'],
  '公司': ['公司名称', '工作单位', '实习单位', 'company', 'employer'], '职位': ['岗位', '职务', '担任职务', '担任角色', '项目角色', '角色', 'position', 'role', 'job title'],
  '工作内容': ['工作职责', '主要职责', '实习内容', 'responsibilities'], '工作成果': ['工作业绩', '主要业绩', '主要产出', 'achievements'],
  '项目名称': ['项目名', 'project name', 'project'], '项目内容': ['项目描述', '项目简介', '项目概述', 'description'], '本人职责': ['个人职责', '负责内容'],
  '项目成果': ['项目业绩', '项目成效', '项目细节与亮点'], '专业课程': ['主修课程', '核心课程', 'courses', 'coursework'], '成绩': ['绩点', 'gpa', 'score'],
  '意向岗位': ['求职岗位', '应聘岗位', '目标岗位', '期望职位', 'target role'], '期望工作城市': ['意向城市', '期望城市', '工作城市', 'preferred location'],
  '预计入职时间': ['到岗时间', '入职意向时间'], '期望薪资': ['薪资要求', '期望月薪', 'expected salary'],
  '组织名称': ['组织', '社团名称'], '奖惩名称': ['奖项名称', '获奖名称'], '奖惩时间': ['获奖时间'],
  '证书名称（技能名称）': ['证书名称', '技能名称', 'certificate'], '自我评价': ['summary'],
  'GitHub': ['github'], '个人主页': ['个人网站', 'website', 'portfolio']
};
const DATE = '(?:19|20)\\d{2}(?:\\s*[年./-]\\s*(?:1[0-2]|0?[1-9])(?:\\s*月)?(?:\\s*[./-]\\s*(?:3[01]|[12]\\d|0?[1-9])(?:日)?)?)?';
const RANGE = new RegExp(`(${DATE})\\s*(?:[-–—~～至到]|to)\\s*(${DATE}|至今|现在|今|present|current|now)(?!\\d)`, 'i');
const norm = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s:：·•【】\[\]（）()]/g, '');
const clean = value => String(value || '').trim().replace(/^[|｜·•;,，；\s]+|[|｜;；\s]+$/g, '').trim();
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function profileFingerprint(profile) {
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    return value;
  }
  return JSON.stringify(stable({ ...profile, updatedAt: '' }));
}

export function normalizeDate(value) {
  const text = clean(value);
  if (/^(至今|现在|今|present|current|now)$/i.test(text)) return '至今';
  const match = text.match(/^(19\d{2}|20\d{2})(?:\s*[年./-]\s*(\d{1,2})(?:\s*月)?(?:\s*[./-]\s*(\d{1,2})(?:日)?)?)?\s*$/);
  if (!match) return text;
  if (match[2] && (+match[2] < 1 || +match[2] > 12)) return text;
  return [match[1], match[2]?.padStart(2, '0'), match[3]?.padStart(2, '0')].filter(Boolean).join('-');
}

function detectHeading(line) {
  const stripped = line.replace(/^(?:[•●▪○。]\s*|[oO]\s+)/, '').replace(/^[#\s\d一二三四五六七八九十、.．)）-]+/, '').trim();
  for (const [key, headings] of Object.entries(HEADINGS)) {
    for (const heading of headings) {
      if (norm(stripped.replace(/\s+\d{1,2}$/, '')) === norm(heading)) return { key, heading, rest: '' };
      const match = stripped.match(new RegExp(`^${escapeRegex(heading)}\\s*[:：]\\s*(.+)$`, 'i'));
      if (match) return { key, heading, rest: match[1] };
    }
  }
  return null;
}

function labelsFor(config) {
  const labels = new Map();
  for (const field of config.fields || []) {
    for (const alias of [field.label, ...(ALIASES[field.label] || [])]) labels.set(norm(alias), field.label);
  }
  const names = (config.fields || []).flatMap(field => [field.label, ...(ALIASES[field.label] || [])]);
  names.sort((a, b) => b.length - a.length);
  return { labels, regex: new RegExp(`(?:^|[\\s|｜;；,，])(${names.map(escapeRegex).join('|')})\\s*[:：;；]\\s*`, 'gi') };
}

function labeledValues(lines, config) {
  const { labels, regex } = labelsFor(config);
  const values = {};
  const rest = [];
  let continuation = '';
  for (const line of lines) {
    const matches = [...line.matchAll(regex)];
    if (!matches.length) {
      if (continuation && !RANGE.test(line)) values[continuation] = [values[continuation], line].filter(Boolean).join('\n');
      else { rest.push(line); continuation = ''; }
      continue;
    }
    if (matches[0].index > 0 && clean(line.slice(0, matches[0].index))) rest.push(clean(line.slice(0, matches[0].index)));
    continuation = '';
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const label = labels.get(norm(match[1]));
      const value = clean(line.slice(match.index + match[0].length, matches[i + 1]?.index ?? line.length));
      if (value && !values[label]) values[label] = /时间|日期/.test(label) ? normalizeDate(value) : value;
      if (/内容|描述|职责|成果|评价|课程|说明/.test(label)) continuation = label;
    }
  }
  return { values, rest };
}

function dateRange(line) {
  const match = line.match(RANGE);
  return match ? { start: normalizeDate(match[1]), end: normalizeDate(match[2]), rest: clean(line.replace(match[0], '')) } : null;
}

function parseBasic(lines, config) {
  const result = labeledValues(lines, config);
  const header = lines.join('\n');
  const emails = [...new Set(header.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [])];
  if (!result.values['邮箱'] && emails.length === 1) result.values['邮箱'] = emails[0];
  const phones = [...new Set((header.match(/(?<!\d)(?:\+?86[ -]?)?1[3-9](?:[ -]?\d){9}(?!\d)/g) || []).map(x => x.replace(/[ -]/g, '')))];
  if (!result.values['电话'] && phones.length === 1) result.values['电话'] = phones[0];
  const political = header.match(/中共(?:预备)?党员|共青团员|群众/);
  if (!result.values['政治面貌'] && political) result.values['政治面貌'] = political[0];
  const warnings = [];
  if (emails.length > 1 || phones.length > 1) warnings.push('检测到多个联系方式，请核对归属。');
  if (!result.values['姓名']) {
    const nameLine = lines.slice(0, 4).flatMap(line => line.split('\t')).find(line => /^(?:[\p{Script=Han}]{2,4}|[A-Z][A-Za-z'-]+(?: [A-Z][A-Za-z'-]+){1,3})$/u.test(line)
      && !/简历|工程师|经理|本科|硕士|博士|应届|求职|大学|学院|学生/.test(line));
    if (nameLine) { result.values['姓名'] = nameLine; warnings.push('姓名根据首部短行推测，请核对。'); }
  }
  return { ...result, warnings };
}

// Date ranges and repeated explicit identity fields delimit records. Dates alone
// never justify splitting bullets (e.g. a project milestone in a job description).
function splitRecords(lines, config) {
  const identity = { education: '学校', work: '公司', internship: '公司', project: '项目名称', student: '组织名称' }[config.key];
  const chunks = [];
  let current = [];
  let rangeSeen = false;
  let identitySeen = false;
  for (const line of lines) {
    const range = dateRange(line);
    const labeled = identity ? labeledValues([line], config).values[identity] : null;
    const schoolHeader = config.key === 'education' && /^[^:：|•●]{2,45}(?:大学|学院|学校)(?:\s|$|QS\s*\d|985|211|双一流)/i.test(line) && !/负责|参与|课程|团委|学生会/.test(line);
    const identityHeader = Boolean(labeled || schoolHeader);
    const hasRange = Boolean(range && !/^[•●▪\-*]/.test(line));
    if (current.length && ((hasRange && rangeSeen) || (identityHeader && identitySeen))) {
      chunks.push(current); current = []; rangeSeen = false; identitySeen = false;
    }
    current.push(line);
    if (hasRange) rangeSeen = true;
    if (identityHeader) identitySeen = true;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

const DEGREE = /博士(?:研究生)?|硕士(?:研究生)?|本科|学士|大专|专科|高中|中专|Ph\.?D\.?|Master(?:'s)?(?: of [A-Za-z ]+)?|Bachelor(?:'s)?(?: of [A-Za-z ]+)?|B\.?Sc\.?|M\.?Sc\.?|B\.?S\.?|M\.?S\.?/i;
const CITY = /^(?:中国)?(?:北京|上海|天津|重庆|广州|深圳|成都|杭州|南京|苏州|武汉|西安|长沙|郑州|济南|青岛|厦门|福州|合肥|宁波|无锡|东莞|佛山|珠海|大连|沈阳|昆明|南宁|南昌|太原|长春|哈尔滨|贵阳|兰州|海口|三亚|石家庄|香港|澳门)(?:市)?$/;
function parseExperience(lines, config) {
  const { values, rest } = labeledValues(lines, config);
  let working = rest.slice();
  const rangeIndex = working.findIndex(line => dateRange(line));
  if (rangeIndex >= 0) {
    const range = dateRange(working[rangeIndex]);
    values['开始时间'] ||= range.start;
    values['结束时间'] ||= range.end;
    working[rangeIndex] = range.rest;
  }
  working = working.filter(Boolean);
  const warnings = [];
  // Header columns commonly use tabs, pipes, or two spaces in both PDF and DOCX.
  const tokens = working.flatMap(line => line.split(/\s*[|｜\t]\s*|\s{2,}/)).map(clean).filter(Boolean);
  const consumed = new Set();
  function take(label, pattern) {
    if (values[label]) return;
    const index = tokens.findIndex((token, i) => !consumed.has(i) && token.length < 110 && pattern.test(token));
    if (index >= 0) { values[label] = tokens[index]; consumed.add(index); }
  }
  if (config.key === 'education') take('城市', CITY);
  else if (config.key === 'work' || config.key === 'internship') take('地点', CITY);
  if (config.key === 'education') {
    // Separate a school/major/degree line even when it only has single spaces.
    if (!values['学校']) {
      const index = tokens.findIndex(t => /大学|学院|学校|University|College|Institute/i.test(t) && t.length < 130 && !/课程|负责|项目|成绩/.test(t));
      if (index >= 0) {
        const token = tokens[index];
        const chinese = token.match(/^(.+?(?:大学|学院|学校))(?=\s|$|QS\s*\d|985|211|双一流)/i);
        values['学校'] = chinese ? chinese[1] : clean(token.replace(DEGREE, ''));
        consumed.add(index);
        if (chinese && clean(token.slice(chinese[1].length))) tokens.push(clean(token.slice(chinese[1].length)));
      }
    }
    if (!values['学历']) {
      const index = tokens.findIndex((t, i) => !consumed.has(i) && DEGREE.test(t));
      if (index >= 0) {
        const degree = tokens[index].match(DEGREE)[0];
        values['学历'] = /博士|Ph/i.test(degree) ? '博士研究生' : /硕士|Master|M\.?S/i.test(degree) ? '硕士研究生' : /学士|本科|Bachelor|B\.?S/i.test(degree) ? '本科' : degree;
        const remainder = clean(tokens[index].replace(DEGREE, ''));
        consumed.add(index);
        if (remainder) tokens.push(remainder);
      }
    }
    take('专业', /计算机|人工智能|数据科学|网络工程|软件工程|信息工程|电子工程|自动化|金融|经济|管理|数学|物理|化学|法学|文学|设计|医学|[A-Za-z ]+(?:Science|Engineering|Mathematics|Business)/i);
    if (!values['成绩']) {
      const gradeIndex = tokens.findIndex(token => /\bGPA\s*[:：]?\s*\d/i.test(token));
      if (gradeIndex >= 0) { values['成绩'] = tokens[gradeIndex].match(/\bGPA\s*[:：]?\s*([\d.]+(?:\s*\/\s*[\d.]+)?)/i)[1].replace(/\s/g, ''); consumed.add(gradeIndex); }
    }
  } else if (config.key === 'work' || config.key === 'internship') {
    // A role separated by spaces after a company is a common Chinese layout.
    for (let i = 0; i < tokens.length; i++) {
      const parts = tokens[i].match(/^(.+?(?:有限公司|集团|公司))\s+(.+)$/);
      if (parts) { tokens[i] = parts[1]; tokens.splice(i + 1, 0, parts[2]); }
    }
    take('公司', /公司|集团|事务所|研究院|银行|医院|工作室|\b(?:Inc\.?|Ltd\.?|LLC|Corp\.?|Corporation|Technologies)\b/i);
    take('职位', /工程师|实习生|经理|开发|设计师|主管|助理|专员|运营|总监|顾问|分析师|研究员|Engineer|Developer|Designer|Manager|Intern|Analyst|Consultant|Lead/i);
    if (!values['公司'] && tokens[0] && !consumed.has(0) && tokens[0].length < 50 && !/[:：。]|负责|参与|完成|实现|优化/.test(tokens[0])) {
      values['公司'] = tokens[0]; consumed.add(0); warnings.push('公司根据经历首行推测，请核对。');
    }
  } else if (config.key === 'project' || config.key === 'student') {
    const label = config.key === 'project' ? '项目名称' : '组织名称';
    if (!values[label] && tokens[0] && tokens[0].length < 90 && !/^[-•●]|负责|参与|完成/.test(tokens[0])) {
      values[label] = tokens[0]; consumed.add(0); warnings.push(`${label}根据经历首行推测，请核对。`);
    }
    take('职位', /工程师|开发|负责人|组长|队长|主席|部长|班长|Designer|Developer|Lead/i);
  }
  const description = tokens.filter((_, i) => !consumed.has(i)).join('\n');
  const descriptionLabel = { education: '专业描述', work: '工作内容', internship: '工作内容', project: '项目内容', student: '工作内容' }[config.key];
  if (description && descriptionLabel) values[descriptionLabel] = [values[descriptionLabel], description].filter(Boolean).join('\n');
  return { values, warnings };
}

function parseListSection(lines, config) {
  const { values } = labeledValues(lines, config);
  if (Object.keys(values).length) return [{ values }];
  const mappings = {
    awards: ['奖惩名称', '奖惩描述', '奖惩时间'], certificates: ['证书名称（技能名称）', '证书说明', '证书获得时间'],
    papers: ['论文名称', '论文描述', '发表时间'], patent: ['专利名称', '专利成果', '发表时间'],
    training: ['培训名称', '培训内容', '开始时间']
  };
  if (config.key === 'computer') {
    const records = [];
    for (const line of lines) {
      const heading = line.match(/^(?:[•●▪○。]|[oO])\s*([^:：;；]{2,30})\s*[:：;；]\s*(.*)$/);
      if (heading) records.push({ values: { '证书名称（技能名称）': heading[1].trim() }, custom: [{ label: '技能说明', value: heading[2] }] });
      else if (records.length) records.at(-1).custom[0].value += `\n${line}`;
    }
    return records.length ? records : [{ values: { '证书名称（技能名称）': lines.join('\n') }, warnings: ['技能按原文保留；如需逐项匹配网申，可在资料中拆分。'] }];
  }
  if (config.key === 'language') return lines.flatMap(line => {
    const matches = [...line.matchAll(/CET[- ]?[46]|英语[四六]级|IELTS|TOEFL|雅思|托福|GRE|GMAT|JLPT\s*N[1-5]/gi)];
    if (!matches.length) return [{ values: { '证书名称（技能名称）': line } }];
    return matches.map((match, index) => {
      const following = line.slice(match.index + match[0].length, matches[index + 1]?.index ?? line.length);
      const score = following.match(/^\s*(?:[:：]|成绩\s*[:：]?|分数\s*[:：]?)?\s*(\d+(?:\.\d+)?)(?=\s|[分,，;；)）]|$)/)?.[1];
      return { values: { '证书名称（技能名称）': match[0], '外语种类': /JLPT/i.test(match[0]) ? '日语' : '英语', ...(score ? { '成绩': score } : {}) }, custom: index === 0 ? [{ label: '语言能力原文', value: line }] : [] };
    });
  });
  const mapping = mappings[config.key];
  if (!mapping) return [];
  const entries = config.key === 'awards' ? lines.flatMap(splitAwardList) : lines;
  return entries.map(line => {
    const match = line.match(new RegExp(`^(${DATE})\\s+(.+)$`));
    const trailingYear = config.key === 'awards' ? line.match(/^(.*?)\s*\(([\d\s、,，.-]+)\)\s*$/) : null;
    if (trailingYear) return { values: { [mapping[0]]: trailingYear[1].trim(), [mapping[2]]: trailingYear[2].trim() } };
    return { values: { [mapping[0]]: match ? match[2] : line, ...(match ? { [mapping[2]]: normalizeDate(match[1]) } : {}) } };
  });
}

function splitAwardList(line) {
  const result = [];
  let start = 0, depth = 0;
  for (let i = 0; i < line.length; i++) {
    if ('(（〈'.includes(line[i])) depth++;
    else if (')）〉'.includes(line[i])) depth = Math.max(0, depth - 1);
    else if (depth === 0 && '、;；'.includes(line[i])) {
      if (line.slice(start, i).trim()) result.push(line.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (line.slice(start).trim()) result.push(line.slice(start).trim());
  return result;
}

export function parseResumeText(input, schema) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('没有可解析的文字，请选择含文字的简历或粘贴文本。');
  if (input.length > MAX_TEXT_LENGTH) throw new Error('简历文字超过 20 万字，请精简后重试。');
  const text = input.normalize('NFKC').replace(/\r\n?/g, '\n').replace(/[\u0000\u200b-\u200d\ufeff]/g, '');
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const chunks = [];
  let current = { key: 'basic', lines: [] };
  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      if (current.lines.length) chunks.push(current);
      current = { key: heading.key, heading: heading.heading, lines: heading.rest ? [heading.rest] : [] };
    } else current.lines.push(line);
  }
  if (current.lines.length) chunks.push(current);
  const groups = [];
  const unclassified = [];
  for (const chunk of chunks) {
    const config = schema.find(section => section.key === chunk.key);
    if (!config) { unclassified.push(chunk.lines.join('\n')); continue; }
    let records;
    if (chunk.key === 'basic') records = [parseBasic(chunk.lines, config)];
    else if (['education', 'work', 'internship', 'project', 'student'].includes(chunk.key)) records = splitRecords(chunk.lines, config).map(lines => ({ ...parseExperience(lines, config), source: lines.join('\n') }));
    else if (chunk.key === 'self') records = [{ values: { '自我评价': chunk.lines.join('\n') } }];
    else if (chunk.key === 'other') records = chunk.heading === '兴趣爱好'
      ? [{ values: { '爱好及专长': chunk.lines.join('\n') } }]
      : [{ ...labeledValues(chunk.lines, config), custom: [{ label: '简历补充原文', value: chunk.lines.join('\n') }] }];
    else if (chunk.key === 'intention') {
      const parsed = labeledValues(chunk.lines, config);
      if (!Object.keys(parsed.values).length && chunk.lines.length === 1) parsed.values['意向岗位'] = chunk.lines[0];
      records = [parsed];
    } else records = parseListSection(chunk.lines, config);
    let found = false;
    for (const record of records) {
      const allowed = new Set(config.fields.map(field => field.label));
      const values = Object.fromEntries(Object.entries(record.values || {}).filter(([label, value]) => allowed.has(label) && String(value).trim()));
      if (!Object.keys(values).length && !record.custom?.length) continue;
      found = true;
      const title = (values['学校'] || values['公司'] || values['项目名称'] || values['组织名称'] || values['奖惩名称'] || values['证书名称（技能名称）'] || config.title).slice(0, 120);
      groups.push({ id: `resume-${groups.length}`, sectionKey: config.key, sectionTitle: config.title, kind: config.kind, title, values, custom: record.custom || [], source: record.source || chunk.lines.join('\n'), warnings: record.warnings || [] });
    }
    if (!found) unclassified.push(chunk.lines.join('\n'));
  }
  // Only inspect the contact block for personal URLs, never links in projects.
  const contact = chunks.filter(chunk => chunk.key === 'basic').flatMap(chunk => chunk.lines).join('\n');
  const github = contact.match(/(?:https?:\/\/)?github\.com\/[\w-]+\/?(?![\w/-])/i)?.[0];
  if (github) groups.push({ id: `resume-${groups.length}`, sectionKey: 'other', sectionTitle: '其他信息', kind: 'simple', title: '个人链接', values: { GitHub: github.startsWith('http') ? github : `https://${github}` }, custom: [], source: contact, warnings: [] });
  return { groups, unclassified, text, warnings: ['本地规则解析，请核对姓名、经历分组和日期；不会推断简历未写明的资料。'] };
}

function equal(a, b) { return norm(a) === norm(b); }
const IDENTITIES = {
  education: ['学校', '开始时间', '专业'], work: ['公司', '开始时间', '职位'], internship: ['公司', '开始时间', '职位'],
  project: ['项目名称', '开始时间'], student: ['组织名称', '开始时间', '职位'], awards: ['奖惩名称', '奖惩时间'],
  language: ['证书名称（技能名称）'], computer: ['证书名称（技能名称）'], certificates: ['证书名称（技能名称）', '证书获得时间'],
  intention: ['意向岗位', '期望工作城市'], training: ['培训名称', '开始时间'], papers: ['论文名称'], patent: ['专利名称']
};
function matchingItem(items, incoming, key) {
  // Exact duplicates are no-ops. Never match unrelated jobs using only a company.
  const pairs = Object.entries(incoming.values);
  const identical = items.findIndex(item => pairs.length && pairs.every(([label, value]) => equal(item.values?.[label], value)) && (incoming.custom || []).every(row => (item.custom || []).some(old => equal(row.label, old.label) && equal(row.value, old.value))));
  if (identical >= 0) return identical;
  const identity = IDENTITIES[key];
  if (!identity || identity.some(label => !incoming.values[label])) return -1;
  const matches = items.map((item, index) => identity.every(label => item.values?.[label] && equal(item.values[label], incoming.values[label])) ? index : -1).filter(index => index >= 0);
  return matches.length === 1 ? matches[0] : -1;
}

export function mergeResumeGroups(profile, groups, { overwrite = false } = {}) {
  const result = structuredClone(profile);
  result.sections ||= {};
  result.customSections ||= [];
  const stats = { added: 0, updated: 0, preserved: 0, unchanged: 0, newItems: 0 };
  for (const group of groups) {
    const values = Object.fromEntries(Object.entries(group.values || {}).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v));
    const custom = (group.custom || []).filter(row => row.label && row.value.trim());
    if (!Object.keys(values).length && !custom.length) continue;
    const section = result.sections[group.sectionKey] ||= { key: group.sectionKey, title: group.sectionTitle, kind: group.kind, ...(group.kind === 'repeat' ? { items: [] } : { values: {}, custom: [] }) };
    let target = section;
    if (group.kind === 'repeat') {
      section.items ||= [];
      const index = matchingItem(section.items, { values, custom }, group.sectionKey);
      if (index >= 0) target = section.items[index];
      else {
        target = { title: group.title, values: {}, custom: [] };
        // Append, never reorder: field memory stores the existing array indices.
        section.items.push(target); stats.newItems++;
      }
    }
    target.values ||= {};
    target.custom ||= [];
    for (const [label, value] of Object.entries(values)) {
      const previous = target.values[label];
      if (!previous) { target.values[label] = value; stats.added++; }
      else if (equal(previous, value)) stats.unchanged++;
      else if (overwrite) { target.values[label] = value; stats.updated++; }
      else stats.preserved++;
    }
    for (const row of custom) {
      if (target.custom.some(old => equal(old.label, row.label) && equal(old.value, row.value))) stats.unchanged++;
      else { target.custom.push({ ...row, value: row.value.trim() }); stats.added++; }
    }
  }
  result.updatedAt = new Date().toISOString();
  return { profile: result, stats };
}
