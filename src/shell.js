(() => {
  const titles = {
    profile: ['简历资料', '本机资料', '用于网申填写的本机资料，修改后请保存。'],
    import: ['简历导入', '导入资料', '文件与文字均在本机解析，无需 API。'],
    memory: ['字段记忆', '本机增强', '只记字段名称与资料路径，不保存资料值。'],
    settings: ['设置', '偏好与连接', '维护可选 API、本机资料备份与版本信息。']
  };
  function route() {
    const hash = location.hash.slice(1);
    const view = hash.startsWith('settings') ? 'settings' : titles[hash] ? hash : 'profile';
    document.querySelectorAll('[data-view]').forEach(el => { el.hidden = el.dataset.view !== view; });
    document.querySelectorAll('[data-main-nav]').forEach(el => {
      if (el.dataset.mainNav === (view === 'import' ? 'profile' : view)) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    const [title, kicker, description] = titles[view];
    document.getElementById('viewTitle').textContent = title;
    document.getElementById('viewKicker').textContent = kicker;
    document.getElementById('viewDescription').textContent = description;
    document.title = `${title} · 网申助手`;
    document.getElementById('profileHeaderActions').hidden = view !== 'profile';
    document.getElementById('backToProfile').hidden = view !== 'import';
    const tab = hash === 'settings-data' ? 'data' : hash === 'settings-version' ? 'version' : 'api';
    document.querySelectorAll('[data-settings-pane]').forEach(el => { el.hidden = el.dataset.settingsPane !== tab; });
    document.querySelectorAll('[data-settings-tab]').forEach(el => {
      if (el.dataset.settingsTab === tab) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    if (hash.startsWith('profile-section-')) setActiveProfileSection(hash.slice('profile-section-'.length), { force: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const save = document.getElementById('saveProfile'), headerSave = document.getElementById('headerSaveProfile');
  headerSave.addEventListener('click', () => save.click());
  new MutationObserver(() => { headerSave.disabled = save.disabled; headerSave.textContent = save.textContent; }).observe(save, { attributes: true, childList: true, subtree: true });
  window.addEventListener('hashchange', route);
  route();
})();
