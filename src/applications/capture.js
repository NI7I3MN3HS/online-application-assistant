(() => {
  const VERSION = 2;
  if (globalThis.OJAFApplicationRecorder?.version === VERSION) return;
  const context = globalThis.OJAFApplicationContext;
  if (!context) return;
  const documentId = crypto.randomUUID();
  let pageSignature = '', pageInstance = '', root = null, current = null, saving = false, dirty = false, cardObserver = null;
  const request = (type, payload = {}) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, response => {
      const error = chrome.runtime.lastError;
      if (error || !response?.ok) return reject(Object.assign(new Error(error?.message || response?.error || '记录未保存，请重试。'), { code: response?.code }));
      resolve(response.data);
    });
  });
  const node = (tag, properties = {}) => Object.assign(document.createElement(tag), properties);
  const stamp = value => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚无填写记录';
  function begin(runId) {
    const metadata = context.capture(document, location.href);
    const signature = JSON.stringify([location.href, document.title, metadata.jobId, metadata.company, metadata.position]);
    if (signature !== pageSignature) { pageSignature = signature; pageInstance = crypto.randomUUID(); }
    return { context: metadata, signature, href: location.href, title: document.title, instanceKey: `${documentId}:${pageInstance}`, eventKey: `${documentId}:${runId}` };
  }
  function ensureCard() {
    if (root?.isConnected) return root;
    const host = node('div'); host.dataset.ojafAppCard = 'true'; host.id = 'ojaf-application-record';
    host.style.cssText = 'all:initial;position:fixed;right:16px;bottom:16px;width:min(390px,calc(100vw - 32px));z-index:2147483647;';
    root = host.attachShadow({ mode: 'open' });
    const style = node('style', { textContent: `
      :host{font-family:"Plus Jakarta Sans","Noto Sans SC",system-ui,sans-serif;color:#181715;color-scheme:light;font-size:12px}
      *{box-sizing:border-box}[hidden]{display:none!important}.card{padding:24px;background:#fff;border:1px solid #E5DFCE;border-radius:4px;box-shadow:0 16px 40px -8px rgba(24,23,21,.07);max-height:calc(100dvh - 32px);overflow:auto;scrollbar-width:thin;scrollbar-color:#DDD8CB transparent}
      header{display:flex;align-items:start;justify-content:space-between;gap:12px;padding-bottom:18px;border-bottom:1px solid #F0ECE1}h2{font:400 20px/1.5 "Cormorant Garamond","Noto Serif SC","Songti SC",serif;margin:0}p{font-size:11px;line-height:1.7;margin:12px 0;color:#6E6A62;overflow-wrap:anywhere}
      label{display:grid;gap:6px;font-size:12px;margin-top:18px}input,select,button{font:inherit}input,select{width:100%;padding:9px 12px;border:1px solid #E5DFCE;border-radius:4px;background:#FDFCFA;color:#181715;caret-color:#181715}
      button{cursor:pointer;border:1px solid #181715;border-radius:4px;padding:7px 14px;min-height:34px;color:#FDFCFA;background:#181715}button.secondary{background:#fff;border-color:#E5DFCE;color:#3D3A35}button.close{background:none;border:0;color:#6E6A62;padding:2px 0;min-height:28px}button:hover{filter:brightness(.94)}
      button:disabled{opacity:.5;cursor:wait}:focus-visible{outline:2px solid #3D3A35;outline-offset:3px}::selection{background:#E5DFCE}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;border-top:1px solid #F0ECE1;padding-top:18px}.error{color:#A8523A}.meta{font-variant-numeric:tabular-nums}
    ` });
    root.append(style, node('section', { className: 'card' })); document.documentElement.append(host);
    cardObserver?.disconnect();
    cardObserver = new ResizeObserver(() => document.documentElement.style.setProperty('--ojaf-application-card-height', `${host.getBoundingClientRect().height}px`));
    cardObserver.observe(host);
    return root;
  }
  function close() {
    if (dirty && !confirm('记录有尚未保存的修改，确定放弃并关闭吗？')) return;
    cardObserver?.disconnect(); cardObserver = null;
    document.documentElement.style.removeProperty('--ojaf-application-card-height');
    root?.host.remove(); root = null; dirty = false; current = null;
  }
  function display(data, snapshot, error = '') {
    if (dirty && root?.host.isConnected) {
      if (error) {
        current.pendingSnapshot = snapshot;
        root.querySelector('#retry-capture').hidden = false;
        setFeedback(`本次填写的记录未保存：${error}。正在编辑的内容已保留，可重试记录。`, true);
      } else if (data?.record) {
        setFeedback('再次填写已记录；你正在编辑的内容已保留，保存时将检查最新版本。');
      }
      return;
    }
    ensureCard();
    const pendingSnapshot = current?.pendingSnapshot || null;
    current = { record: data?.record || null, statuses: data?.statuses || [{ id: 'filled', label: '填写' }], snapshot, pendingSnapshot };
    dirty = false;
    const card = root.querySelector('.card'); card.replaceChildren();
    const heading = node('h2', { textContent: data?.record ? '已记录本次填写' : '填写完成，记录未保存' });
    heading.id = 'application-card-title'; card.setAttribute('role', 'region'); card.setAttribute('aria-labelledby', heading.id);
    const header = node('header'); const closeButton = node('button', { type: 'button', className: 'close', textContent: '关闭' }); closeButton.addEventListener('click', close);
    header.append(heading, closeButton); card.append(header);
    const record = data?.record || { ...snapshot.context, statusId: 'filled' };
    card.append(node('p', { textContent: '“填写”仅表示已填表。是否已投递，由你手动维护。' }));
    card.append(node('p', { className: 'meta', textContent: `${record.siteHost || snapshot.context.siteHost} · 最近填写 ${stamp(record.lastFilledAt)}` }));
    for (const [key, title] of [['company', '公司'], ['position', '岗位']]) {
      const label = node('label', { textContent: title }); const input = node('input', { value: record[key] || '', placeholder: '待补全', maxLength: 240 });
      input.dataset.field = key; label.append(input); card.append(label);
    }
    const label = node('label', { textContent: '状态（手动维护）' }); const select = node('select'); select.dataset.field = 'statusId';
    for (const status of current.statuses) select.append(node('option', { value: status.id, textContent: status.label }));
    select.value = record.statusId; select.disabled = !data?.record; label.append(select); card.append(label);
    card.append(node('p', { textContent: record.pageTitle || snapshot.context.pageTitle }));
    const feedback = node('p', { textContent: error || ((!record.company || !record.position) ? '公司或岗位待补全，记录已保存在本机。' : '记录已保存在本机，修改后请保存。') });
    feedback.id = 'record-feedback'; feedback.setAttribute('role', 'status'); feedback.classList.toggle('error', Boolean(error)); card.append(feedback);
    const actions = node('div', { className: 'actions' });
    const save = node('button', { type: 'button', textContent: data?.record ? '保存修改' : '重试保存' }); save.addEventListener('click', () => void saveCard());
    const all = node('button', { type: 'button', className: 'secondary', textContent: '查看全部' }); all.addEventListener('click', () => void request('OJAF_OPEN_APPLICATIONS', { id: current?.record?.id }).catch(error => setFeedback(error.message, true)));
    const reload = node('button', { type: 'button', className: 'secondary', textContent: '重新加载记录', hidden: true }); reload.id = 'reload-record'; reload.addEventListener('click', () => void reloadCard());
    const retry = node('button', { type: 'button', className: 'secondary', textContent: '重试记录本次填写', hidden: !pendingSnapshot }); retry.id = 'retry-capture'; retry.addEventListener('click', () => void retryPendingCapture());
    actions.append(save, all, reload, retry); card.append(actions);
    card.oninput = () => { dirty = true; };
  }
  async function retryPendingCapture() {
    if (saving || !current?.pendingSnapshot) return;
    saving = true;
    const retry = root.querySelector('#retry-capture'); retry.disabled = true;
    const snapshot = current.pendingSnapshot;
    try {
      const data = await request('OJAF_RECORD_APPLICATION', { ...snapshot, filled: snapshot.filled });
      if (!data.record) throw new Error('未创建记录，请在管理页检查。');
      current.pendingSnapshot = null; retry.hidden = true;
      setFeedback('本次填写已记录。卡片内的修改尚未保存；保存时会检查最新版本。');
    } catch (error) { setFeedback(`记录仍未保存：${error.message}`, true); }
    finally { saving = false; retry.disabled = false; }
  }
  function setFeedback(message, error = false) {
    const feedback = root?.querySelector('#record-feedback'); if (!feedback) return;
    feedback.textContent = message; feedback.classList.toggle('error', error);
  }
  async function reloadCard() {
    if (saving || !current?.record || (dirty && !confirm('重新加载会放弃卡片内未保存的修改，是否继续？'))) return;
    try {
      const data = await request('OJAF_GET_APPLICATION', { id: current.record.id });
      if (!data.record) throw new Error('记录已删除，可在管理页手动新增。');
      dirty = false; display(data, current.snapshot);
    } catch (error) { setFeedback(error.message, true); }
  }
  async function saveCard() {
    if (saving || !current) return;
    saving = true;
    const snapshot = current.snapshot;
    const values = Object.fromEntries([...root.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value]));
    const changes = current.record ? Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== current.record[key])) : values;
    const controls = [...root.querySelectorAll('button,input,select')]; controls.forEach(control => { control.disabled = true; });
    try {
      let data;
      if (!current.record) {
        // Same event key makes retry safe when a prior write succeeded but the response was lost.
        data = await request('OJAF_RECORD_APPLICATION', { ...snapshot, filled: snapshot.filled });
        if (!data.record) throw new Error('没有成功填写项，未创建记录。');
        if (changes.company !== data.record.company || changes.position !== data.record.position) data = await request('OJAF_SAVE_APPLICATION', { id: data.record.id, expectedRevision: data.record.revision, changes: { company: changes.company, position: changes.position } });
      } else data = await request('OJAF_SAVE_APPLICATION', { id: current.record.id, expectedRevision: current.record.revision, changes });
      dirty = false; display(data, snapshot); setFeedback(current.pendingSnapshot ? '修改已保存到本机；仍有一次填写未记录，请重试记录。' : '修改已保存到本机。');
    } catch (error) {
      setFeedback(error.message, true);
      if (error.code === 'APPLICATION_CONFLICT') root.querySelector('#reload-record').hidden = false;
    } finally {
      saving = false; controls.forEach(control => { control.disabled = false; });
      if (!current?.record) root?.querySelector('select')?.setAttribute('disabled', '');
    }
  }
  async function complete(snapshot, filled) {
    if (!snapshot || !(filled > 0)) return;
    if (snapshot.href !== location.href || snapshot.title !== document.title) return;
    const nowContext = context.capture(document, location.href);
    if (snapshot.context.jobId && nowContext.jobId && snapshot.context.jobId !== nowContext.jobId) return;
    if (['company', 'position'].some(key => snapshot.context[key] && nowContext[key] && snapshot.context[key] !== nowContext[key])) return;
    snapshot.filled = filled;
    try { display(await request('OJAF_RECORD_APPLICATION', { ...snapshot, filled }), snapshot); }
    catch (error) { display(null, snapshot, error.message); }
  }
  globalThis.OJAFApplicationRecorder = Object.freeze({ version: VERSION, begin, complete });
})();
