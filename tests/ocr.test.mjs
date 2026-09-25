import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { prepareOcrImage, ocrResultToText, findPortraitOperations } from '../src/resume/ocr-layout.mjs';
import { probabilityBoxes, decodeCtc } from '../src/resume/paddle.mjs';
import { ocrScale, OCR_MAX_EDGE, OCR_MAX_PIXELS } from '../src/resume/ocr.mjs';
import { parseResumeText } from '../src/resume/parser.mjs';

const source = await readFile(new URL('../src/options.js', import.meta.url), 'utf8');
const declaration = source.slice(source.indexOf('const STRUCTURED_RESUME_SECTIONS'), source.indexOf('let activeProfileSectionKey'));
const schema = JSON.parse(JSON.stringify(vm.runInNewContext(`${declaration}; STRUCTURED_RESUME_SECTIONS`, { profileFields: labels => labels.map(label => ({ label })) })));
const groups = (result, key) => result.groups.filter(group => group.sectionKey === key);

// Synthetic content only: no applicant name, contact details, or resume prose.
const scannedLayout = `林示例
(+86)138-0000-0000 | sample@example.com | 共青团员
教育背景
景云大学QS36\t中国香港
计算机科学与技术|硕士|在读\t2022.10-2024.11
晴川学院211双一流\t南京
人工智能|本科|GPA 4.0/5.0\t2018.09-2022.06
奖项和荣誉
学习奖学金(2020)、社团积极分子(2021、2022)
实习经历
示例软件中心\t2024.07-2024.12
开发实习生\t杭州
工作内容:实现测试系统。
主要产出:
。任务功能:实现任务列表。
增加了搜索功能。
新星技术有限公司\t2024.01-2024.06
AI平台工程师\t南京
工作职责;维护实验平台。
主要产出:
。任务恢复:支持重试。
项目经历
桔子社区\t全栈开发\t2023.02-2023.11
项目概述:实现演示社区。
项目细节与亮点:
。存储:引入缓存。
社团和组织经历
某学院文艺部\t2019.10-2021.06
协助举办活动。
专业技能
。开发基础:掌握Java、Python。
能够编写自动化测试。
。数据库:熟悉事务与索引。
。语言能力:英语(CET-4,CET-6,IELTS 7.0)。
。兴趣爱好:游泳、阅读。`;

test('OCR layout with glued badges and next-line dates retains two complete schools', () => {
  const result = parseResumeText(scannedLayout, schema);
  const education = groups(result, 'education');
  assert.equal(education.length, 2);
  assert.equal(education[0].values['学校'], '景云大学');
  assert.equal(education[0].values['专业'], '计算机科学与技术');
  assert.equal(education[0].values['结束时间'], '2024-11');
  assert.equal(education[0].values['城市'], '中国香港');
  assert.equal(education[1].values['学校'], '晴川学院');
  assert.equal(education[1].values['专业'], '人工智能');
  assert.equal(education[1].values['成绩'], '4.0/5.0');
  assert.equal(education[1].values['城市'], '南京');
  assert.ok(!education[0].values['专业描述']?.includes('晴川'));
});

test('OCR converts work, awards, student activities, bullet skills and hobbies to their own sections', () => {
  const result = parseResumeText(scannedLayout, schema);
  assert.equal(groups(result, 'basic')[0].values['姓名'], '林示例');
  assert.equal(groups(result, 'basic')[0].values['政治面貌'], '共青团员');
  const internships = groups(result, 'internship');
  assert.equal(internships.length, 2);
  assert.equal(internships[0].values['公司'], '示例软件中心');
  assert.equal(internships[0].values['结束时间'], '2024-12');
  assert.equal(internships[0].values['地点'], '杭州');
  assert.equal(internships[1].values['工作内容'], '维护实验平台。');
  assert.match(internships[0].values['工作成果'], /增加了搜索功能/);
  assert.ok(!internships[0].values['工作成果'].includes('undefined'));
  assert.equal(groups(result, 'project')[0].values['项目成果'], '。存储:引入缓存。');
  assert.equal(groups(result, 'student')[0].values['组织名称'], '某学院文艺部');
  assert.equal(groups(result, 'awards').length, 2);
  assert.equal(groups(result, 'awards')[1].values['奖惩时间'], '2021、2022');
  assert.equal(groups(result, 'computer').length, 2);
  assert.match(groups(result, 'computer')[0].custom[0].value, /能够编写自动化测试/);
  assert.equal(groups(result, 'other')[0].values['爱好及专长'], '游泳、阅读。');
});

test('IELTS score is not borrowed by either CET certificate', () => {
  const languages = groups(parseResumeText(scannedLayout, schema), 'language');
  assert.equal(languages.length, 3);
  assert.equal(languages[0].values['成绩'], undefined);
  assert.equal(languages[1].values['成绩'], undefined);
  assert.equal(languages[2].values['证书名称（技能名称）'], 'IELTS');
  assert.equal(languages[2].values['成绩'], '7.0');
});

test('white-on-dark heading preprocessing inverts the band, leaving body pixels untouched', () => {
  const width = 400, height = 800, data = new Uint8ClampedArray(width*height*4).fill(255);
  const paint = (x0,y0,x1,y1,value) => { for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=value; } };
  paint(20,100,150,122,20); paint(40,106,50,116,255); paint(10,200,17,209,20);
  const result = prepareOcrImage({ data, width, height });
  assert.equal(result.invertedBands.length, 1);
  assert.ok(data[(105*width+25)*4] > 200);
  assert.equal(data[(110*width+45)*4], 0);
  assert.equal(data[(205*width+12)*4], 20);
});

test('portrait masking keeps page-sized scans and only skips small corner photos amid vector text', () => {
  const ops = { constructPath:1, save:2, restore:3, transform:4, paintImageXObject:5, paintInlineImageXObject:6 };
  const operatorList = { fnArray: [...Array(35).fill(1),2,4,5,3,2,4,5,3], argsArray:[...Array(35).fill([]),[],[70,0,0,100,500,700],[],[],[],[595,0,0,842,0,0],[],[]] };
  const skipped = findPortraitOperations(operatorList, ops, [0,0,595,842]);
  assert.deepEqual([...skipped], [37]);
  assert.equal(findPortraitOperations({fnArray:[5],argsArray:[[]]},ops,[0,0,595,842]).size,0);
});

test('OCR geometry keeps distant date columns but does not split close Chinese words', () => {
  const box = (x0,x1,y0=10,y1=30) => ({x0,x1,y0,y1});
  const data = {blocks:[{paragraphs:[{lines:[
    {bbox:box(10,500),words:[{text:'示例',bbox:box(10,40)},{text:'大学',bbox:box(45,85)},{text:'2024.11',bbox:box(400,500)}]}
  ]}]}]};
  assert.equal(ocrResultToText(data),'示例大学\t2024.11');
});

test('CTC decoder collapses repeated predictions while respecting intervening blanks', () => {
  const data = new Float32Array(5*3);
  [1,1,0,1,2].forEach((index,step)=>{data[step*3+index]=0.95;});
  assert.equal(decodeCtc({data,dims:[1,5,3]},['甲','乙']).text,'甲甲乙');
});

test('probability map extracts distinct text components and rejects isolated noise', () => {
  const data = new Float32Array(80*60);
  for(let y=10;y<20;y++)for(let x=5;x<25;x++)data[y*80+x]=0.9;
  for(let y=35;y<45;y++)for(let x=30;x<60;x++)data[y*80+x]=0.95;
  data[0]=1;
  const boxes=probabilityBoxes(data,80,60);
  assert.equal(boxes.length,2);
  assert.ok(boxes[0].x0>=0&&boxes[0].y0<10&&boxes[1].x1<=80);
  assert.equal(probabilityBoxes(new Float32Array(100),10,10).length,0);
});

test('OCR raster dimensions remain bounded for oversized PDF pages', () => {
  for(const [width,height]of [[595,842],[20000,50000],[50000,1000]]){
    const scale=ocrScale(width,height);
    assert.ok(width*height*scale*scale<=OCR_MAX_PIXELS+1);
    assert.ok(Math.max(width,height)*scale<=OCR_MAX_EDGE+1);
  }
});
