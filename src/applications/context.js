// Shared by the background module and isolated content scripts. No network calls.
(() => {
  const VERSION = 1;
  if (globalThis.OJAFApplicationContext?.version === VERSION) return;
  const clean = (value, max = 240) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, max);
  const normalize = value => clean(value).toLowerCase();
  const platform = /^(?:moka|mokahr|hotjob|北森|智联招聘|前程无忧|猎聘|BOSS直聘|牛客|牛客网|飞书招聘|招聘官网|人才招聘|校园招聘|社会招聘|招聘系统|职位详情|职位申请|申请职位|填写简历|个人中心|个人信息|基本信息|网申系统|careers?|jobs?|apply|job application|recruitment|workday|greenhouse|lever)$/i;
  const rolePattern = /工程师|开发|设计师|经理|专员|助理|总监|主管|顾问|分析师|研究员|实习生|运营|产品|销售|测试|财务|会计|法务|人力|管培|校招|engineer|developer|designer|manager|analyst|scientist|intern|consultant|specialist|director|sales|accountant/i;
  const companyPattern = /公司|集团|银行|研究院|研究所|事务所|医院|大学|工作室|\b(?:inc\.?|ltd\.?|llc|corp\.?|corporation|technologies)\b/i;
  const tracking = /^(?:utm_.+|spm|from|source|ref|referrer|referral|gclid|fbclid|msclkid|tracking.*|track.*|token|.*_token|accessToken|refreshToken|authorization|auth|authCode|code|session|sessionId|session_id|sid|password|pwd|ticket|credential|signature)$/i;
  function filterParams(params) {
    for (const key of [...params.keys()]) if (tracking.test(key)) params.delete(key);
    params.sort();
    return params.toString();
  }
  function safeUrl(value, base) {
    try {
      const url = new URL(value, base);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      url.username = ''; url.password = '';
      url.search = filterParams(url.searchParams);
      const hash = url.hash.slice(1);
      if (hash.includes('?')) {
        const [route, ...query] = hash.split('?');
        const filtered = filterParams(new URLSearchParams(query.join('?')));
        url.hash = route + (filtered ? `?${filtered}` : '');
      } else if (hash.includes('=')) {
        url.hash = filterParams(new URLSearchParams(hash));
      }
      return url.href;
    } catch { return ''; }
  }
  function routeInfo(value) {
    const safe = safeUrl(value);
    if (!safe) return { host: '', scope: '', jobId: '', url: '' };
    const url = new URL(safe);
    const hashQuery = url.hash.includes('?') ? url.hash.split('?').slice(1).join('?') : url.hash.slice(1);
    const params = new URLSearchParams([...url.searchParams, ...new URLSearchParams(hashQuery)]);
    let jobId = '', tenant = '';
    for (const [key, val] of params) {
      if (/^(job_?id|position_?id|requisition_?id|recruitment_?id|vacancy_?id|job_?code)$/i.test(key)) jobId ||= clean(val, 160);
      if (/^(tenant_?id|company_?id|org_?id|organization_?id|corp_?id|enterprise_?id)$/i.test(key)) tenant += `${key.toLowerCase()}=${val}|`;
    }
    const path = `${url.pathname}${url.hash.startsWith('#/') || url.hash.startsWith('#!/') ? url.hash.slice(1).split('?')[0] : ''}`;
    const match = path.match(/^(.*?)(?:\/(?:jobs?|positions?|requisitions?|vacancies))\/([^/?#]+)(?:\/|$)/i);
    if (match && !/^(apply|application|search|list|detail|form|resume)$/i.test(match[2])) jobId ||= clean(match[2], 160);
    const prefix = match?.[1] || path.match(/^(.*?)(?:\/(?:apply|application|form|resume))(?:\/|$)/i)?.[1] || '';
    return { host: url.hostname, scope: `${url.origin}|${tenant || prefix}`, jobId, url: safe };
  }
  function useful(value) { const text = clean(value); return text && !platform.test(text) ? text : ''; }
  function parseTitle(value) {
    const text = clean(value, 500);
    const parts = text.split(/\s*(?:\||｜|·|_|\s[-–—]\s|(?<=[\p{Script=Han}])[-–—]|[-–—](?=[\p{Script=Han}]))\s*/u).map(part => clean(part.replace(/(?:招聘官网|招聘网站|招聘门户|人才招聘|校园招聘|社会招聘|Careers)\s*$/i, ''))).filter(useful);
    let position = parts.find(part => rolePattern.test(part) && !companyPattern.test(part)) || '';
    let company = parts.find(part => companyPattern.test(part) && part !== position && !/招聘.+(?:工程师|经理|专员|开发)/.test(part)) || '';
    if (position && !company && parts.length === 2) company = parts.find(part => part !== position) || '';
    if (!position && parts.length === 1 && rolePattern.test(parts[0]) && !companyPattern.test(parts[0])) position = parts[0];
    return { company: useful(company), position: useful(position) };
  }
  function collectJobs(value, result = [], depth = 0) {
    if (!value || typeof value !== 'object' || depth > 12 || result.length > 100) return result;
    if (Array.isArray(value)) { for (const item of value.slice(0, 100)) collectJobs(item, result, depth + 1); return result; }
    if ([].concat(value['@type'] || []).some(type => /(?:^|\/)JobPosting$/i.test(type))) result.push(value);
    if (value['@graph']) collectJobs(value['@graph'], result, depth + 1);
    if (value.mainEntity) collectJobs(value.mainEntity, result, depth + 1);
    return result;
  }
  function resolveContext({ url, title, ogTitle = '', jobs = [], domCompany = '', domPosition = '' }) {
    const route = routeInfo(url);
    const candidates = jobs.map(job => {
      const jobUrl = job.url ? safeUrl(job.url, url) : '';
      const identifier = typeof job.identifier === 'object' ? job.identifier?.value : job.identifier;
      return { company: useful(job.hiringOrganization?.name), position: useful(job.title), jobId: clean(identifier || routeInfo(jobUrl).jobId, 160), jobUrl };
    });
    const matches = candidates.filter(job => {
      if (route.jobId && job.jobId && route.jobId !== job.jobId) return false;
      return (job.jobUrl && job.jobUrl === route.url) || (route.jobId && route.jobId === job.jobId);
    });
    let job = matches.length === 1 ? matches[0] : null;
    if (!job && candidates.length === 1 && (!route.jobId || !candidates[0].jobId || route.jobId === candidates[0].jobId)) job = candidates[0];
    const inferred = parseTitle(title);
    const shared = parseTitle(ogTitle);
    const company = job?.company || useful(domCompany) || inferred.company || shared.company;
    const position = job?.position || useful(domPosition) || inferred.position || shared.position;
    return { company, position, sourceUrl: route.url, pageTitle: clean(title, 500), siteHost: route.host, jobId: job?.jobId || route.jobId, jobUrl: job?.jobUrl || '', scope: route.scope };
  }
  function identityKeys(context) {
    const route = routeInfo(context.jobUrl || context.sourceUrl);
    const company = normalize(context.company), position = normalize(context.position);
    const keys = [];
    // Company is also a tenant guard on shared ATS hosts when URL tenant IDs are absent.
    if (context.jobId) keys.push(JSON.stringify(['job', route.scope, company, clean(context.jobId, 160)]));
    if (company && position) keys.push(JSON.stringify(['page', route.url, company, position]));
    return keys;
  }
  function capture(document, href) {
    const jobs = [];
    for (const node of [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 20)) {
      if (node.textContent.length > 1_000_000) continue;
      try { collectJobs(JSON.parse(node.textContent), jobs); } catch { /* Non-JSON analytics markup. */ }
    }
    const excluded = 'form,input,textarea,select,[contenteditable="true"],[id^="ojaf-"],[data-ojaf-app-card]';
    function textFrom(selectors, attribute) {
      for (const node of document.querySelectorAll(selectors)) {
        if (node.closest(excluded) || !node.getClientRects().length) continue;
        const value = clean((attribute && node.getAttribute(attribute)) || node.textContent);
        if (useful(value)) return value;
      }
      return '';
    }
    const domCompany = textFrom('[data-company-name]', 'data-company-name') || textFrom('[itemprop="hiringOrganization"] [itemprop="name"],.job-company,.employer-name,.hiring-organization');
    const domPosition = textFrom('[data-job-title]', 'data-job-title') || textFrom('[data-position-name]', 'data-position-name') || textFrom('.job-title,.position-title,[itemtype*="JobPosting"] [itemprop="title"]');
    const heading = textFrom('h1');
    return resolveContext({ url: href, title: document.title, ogTitle: document.querySelector('meta[property="og:title"]')?.content || '', jobs, domCompany, domPosition: domPosition || (rolePattern.test(heading) ? heading : '') });
  }
  globalThis.OJAFApplicationContext = Object.freeze({ version: VERSION, clean, normalize, safeUrl, routeInfo, parseTitle, collectJobs, resolveContext, identityKeys, capture });
})();
