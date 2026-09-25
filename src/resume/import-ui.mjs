import { detectFileType } from './extract.mjs';
import { MAX_FILE_BYTES, MAX_TEXT_LENGTH, mergeResumeGroups, profileFingerprint as fingerprint } from './parser.mjs';
const el = (tag, properties = {}) => Object.assign(document.createElement(tag), properties);

export function initResumeImport({ schema, readProfile, readSavedProfile, saveProfile }) {
  const get = id => document.getElementById(id);
  const controls = get('resumeImportControls');
  const previewControls = get('resumePreviewControls');
  const status = get('resumeImportStatus');
  const preview = get('resumeImportPreview');
  const container = get('resumePreviewGroups');
  const textInput = get('resumeText');
  const apply = get('applyResumeImport');
  const cancel = get('cancelResumeParsing');
  const undo = get('undoResumeImport');
  let result = null;
  let worker = null;
  let timer = 0;
  let busy = false;
  let revision = 0;
  let draft = false;
  let undoState = null;
  controls.disabled = false;
  setStatus('选择文件或粘贴文字，解析后在这里预览。');

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  }
  function stopWorker() {
    worker?.terminate(); worker = null;
    clearTimeout(timer);
  }
  function setBusy(value, cancellable = false) {
    busy = value;
    controls.disabled = value;
    previewControls.disabled = value;
    undo.disabled = value;
    cancel.hidden = !cancellable;
    get('resumeImport').setAttribute('aria-busy', String(value));
  }
  function discard() {
    result = null; draft = false;
    preview.hidden = true;
    container.replaceChildren();
  }
  function fail(error) {
    revision++;
    stopWorker(); setBusy(false);
    setStatus(`解析失败：${String(error.message || error).replace(/[。.!！]+$/, '')}。可尝试粘贴文字后重新解析。`, true);
  }
  async function parse(file) {
    if (busy) return;
    const run = ++revision;
    try {
      let type;
      if (file) {
        type = detectFileType(file.name);
        if (!file.size) throw new Error('文件为空，请重新选择');
        if (file.size > MAX_FILE_BYTES) throw new Error('文件超过 10 MB，请精简后重试');
      } else {
        if (!textInput.value.trim()) throw new Error('请先粘贴简历文字');
        if (textInput.value.length > MAX_TEXT_LENGTH) throw new Error('简历文字超过 20 万字');
      }
      discard();
      stopWorker();
      setBusy(true, true);
      setStatus(file ? `正在本机解析 ${file.name}…` : '正在本机解析简历文字…');
      timer = setTimeout(() => { if (run === revision) fail(new Error('解析超时，请拆分简历或使用文字粘贴')); }, file && type === 'pdf' ? 180000 : 45000);
      const buffer = file ? await file.arrayBuffer() : null;
      if (run !== revision) return;
      worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
      worker.onerror = () => { if (run === revision) fail(new Error('文档读取失败，请重新导出 PDF/DOCX 或粘贴文字')); };
      worker.onmessage = ({ data }) => {
        if (run !== revision) return;
        if (data.type === 'resume-progress') { setStatus(data.progress); return; }
        if (data.type === 'resume-error') { fail(new Error(data.error)); return; }
        if (data.type !== 'resume-result') return;
        stopWorker(); setBusy(false);
        result = data.result;
        draft = Boolean(result.groups.length);
        textInput.value = result.text;
        render();
      };
      worker.postMessage({ buffer, type, text: file ? '' : textInput.value, schema }, buffer ? [buffer] : []);
    } catch (error) {
      if (run === revision) fail(error);
    }
  }
  function addField(groupIndex, label, value, customIndex = null) {
    const id = `resume-field-${groupIndex}-${container.querySelectorAll('textarea').length}`;
    const row = el('div', { className: 'resume-preview-field' });
    const check = el('input', { type: 'checkbox', checked: true });
    check.setAttribute('aria-label', `导入${label}`);
    const labelEl = el('label', { textContent: label, htmlFor: id });
    const input = el('textarea', { id, value, rows: value.includes('\n') || value.length > 80 ? 3 : 1 });
    row.dataset.groupIndex = groupIndex;
    row.dataset.label = label;
    if (customIndex !== null) row.dataset.customIndex = customIndex;
    row.append(check, labelEl, input);
    return row;
  }
  function render() {
    container.replaceChildren();
    get('resumeImportWarnings').replaceChildren(...result.warnings.map(message => el('li', { textContent: message })));
    for (const [index, group] of result.groups.entries()) {
      const section = el('section', { className: 'resume-preview-group' });
      section.dataset.sourceIndex = index;
      section.append(el('h4', { textContent: `${group.sectionTitle} · ${group.title}` }));
      for (const warning of group.warnings) section.append(el('p', { className: 'hint', textContent: warning }));
      // Attach before making rows so field IDs remain unique across all groups.
      container.append(section);
      for (const [label, value] of Object.entries(group.values)) section.append(addField(index, label, value));
      group.custom.forEach((row, customIndex) => section.append(addField(index, row.label, row.value, customIndex)));
      const source = el('details');
      source.append(el('summary', { textContent: '查看这条的提取原文' }), el('pre', { className: 'resume-preview-source', textContent: group.source }));
      section.append(source);
    }
    if (result.unclassified.length) {
      const warning = el('li', { textContent: `有 ${result.unclassified.length} 段内容未自动归类，请从提取原文手动补录。` });
      get('resumeImportWarnings').append(warning);
      const details = el('details', { className: 'resume-preview-group' });
      details.append(el('summary', { textContent: '查看未归类内容' }), el('pre', { className: 'resume-preview-source', textContent: result.unclassified.join('\n\n') }));
      container.append(details);
    }
    preview.hidden = false;
    get("resumeTextDetails").open = false;
    get("resumeSourceText").textContent = result.groups[0]?.source || result.text;
    setStatus(result.groups.length ? `已解析出 ${result.groups.length} 组资料，尚未写入。请核对下方结果。` : '未识别到可填入的字段。请展开提取原文，补充“教育经历”等标题或手动维护资料。');
    updateSummary();
    get('resumePreviewTitle').focus({ preventScroll: true });
  }
  function selectedGroups() {
    if (!result) return [];
    const selected = result.groups.map(group => ({ ...group, values: {}, custom: [] }));
    for (const row of container.querySelectorAll('[data-group-index]')) {
      if (!row.querySelector('input').checked) continue;
      const value = row.querySelector('textarea').value.trim();
      if (!value) continue;
      const group = selected[Number(row.dataset.groupIndex)];
      if (row.dataset.customIndex !== undefined) group.custom.push({ label: row.dataset.label, value });
      else group.values[row.dataset.label] = value;
    }
    return selected.filter(group => Object.keys(group.values).length || group.custom.length);
  }
  function updateSummary() {
    if (!result) return;
    try {
      const selected = selectedGroups();
      const { stats } = mergeResumeGroups(readProfile(), selected, { overwrite: get('resumeMergeMode').value === 'overwrite' });
      get('resumeMergeSummary').textContent = `将新增 ${stats.added} 个值、更新 ${stats.updated} 个值，保留 ${stats.preserved} 个已有冲突值；追加 ${stats.newItems} 条经历，相同值跳过 ${stats.unchanged} 个。`;
      apply.disabled = !selected.length || !(stats.added + stats.updated);
    } catch (error) { apply.disabled = true; setStatus(error.message, true); }
  }
  get('parseResumeFile').addEventListener('click', () => {
    const file = get('resumeFile').files?.[0];
    if (!file) { setStatus('请先选择 PDF、DOCX 或 TXT 简历。', true); get('resumeFile').focus(); return; }
    void parse(file);
  });
  get('parseResumeText').addEventListener('click', () => void parse(null));
  cancel.addEventListener('click', () => {
    revision++; stopWorker(); setBusy(false); discard(); setStatus('已取消解析，资料未修改。');
  });
  get('discardResumeImport').addEventListener('click', () => {
    discard(); textInput.value = ''; get('resumeFile').value = ''; setStatus('已放弃本次结果，资料未修改。');
  });
  for (const [id, checked] of [['selectAllResumeFields', true], ['clearResumeSelection', false]]) {
    get(id).addEventListener('click', () => {
      container.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = checked; });
      updateSummary();
    });
  }
  const showSource = event => {
    const section = event.target.closest('[data-source-index]');
    if (section && result) get('resumeSourceText').textContent = result.groups[Number(section.dataset.sourceIndex)]?.source || '';
  };
  container.addEventListener('focusin', showSource);
  container.addEventListener('click', showSource);
  container.addEventListener('input', updateSummary);
  get('resumeMergeMode').addEventListener('change', updateSummary);
  get('profileSectionEditor').addEventListener('input', updateSummary);
  apply.addEventListener('click', async () => {
    if (busy || !result) return;
    try {
      const before = readProfile();
      const { profile, stats } = mergeResumeGroups(before, selectedGroups(), { overwrite: get('resumeMergeMode').value === 'overwrite' });
      if (!(stats.added + stats.updated)) { updateSummary(); return; }
      setBusy(true);
      setStatus('正在填入并保存到本机…');
      await saveProfile(profile, `简历已导入并保存：新增 ${stats.added} 个值，更新 ${stats.updated} 个值。`);
      undoState = { before, after: fingerprint(readProfile()) };
      undo.hidden = false;
      discard();
      textInput.value = ''; get('resumeFile').value = '';
      setStatus(`已填入并保存到本机，保留 ${stats.preserved} 个已有冲突值。可返回简历资料继续检查，也可撤销本次导入。`);
    } catch (error) { setStatus(`保存失败：${error.message}。解析结果已保留，可重试。`, true); }
    finally { setBusy(false); }
  });
  undo.addEventListener('click', async () => {
    if (busy || !undoState) return;
    try {
      setBusy(true);
      if (fingerprint(readProfile()) !== undoState.after || fingerprint(await readSavedProfile()) !== undoState.after) {
        throw new Error('导入后资料已被修改，为保留这些修改，无法直接撤销。请在资料区手动调整');
      }
      await saveProfile(undoState.before, '已撤销本次简历导入并保存。');
      undoState = null; undo.hidden = true;
      setStatus('已恢复到本次导入前的资料。');
      updateSummary();
    } catch (error) { setStatus(`撤销失败：${error.message}`, true); }
    finally { setBusy(false); }
  });
  window.addEventListener('beforeunload', event => {
    if (!draft && !busy) return;
    event.preventDefault(); event.returnValue = '';
  });
}
