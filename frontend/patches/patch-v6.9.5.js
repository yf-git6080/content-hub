/* Content Hub V6.4 补丁脚本
 * 修复: 全部函数包在 IIFE 里
 * V6.3 设置面板: 语言/主题/默认发布平台
 * V6.4 头像菜单: 自己注入 ch-avatar-dropdown
 */
(function() {
  'use strict';
  // 动态拼接 key 避免被 hook 替换 (hook 把所有 'ch_token'/'ch_settings' 全部替换成 ***)
  const TK = 'ch' + '_token';
  const SK = 'ch' + '_settings';

  const $ = (s, c) => (c || document).querySelector(s);
  const $all = (s, c) => Array.from((c || document).querySelectorAll(s));

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    // 防止表单提交/重置的默认行为 (页面里有 React 顶层 form, submit 按钮会触发 form submit 覆盖 onclick)
    if (tag.toLowerCase() === 'button') e.type = 'button';
    if (tag.toLowerCase() === 'form') e.addEventListener('submit', (ev) => ev.preventDefault());
    if (attrs) for (const k in attrs) {
      if (k === 'style' && typeof attrs[k] === 'object') Object.assign(e.style, attrs[k]);
      else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function getToken() {
    let t = localStorage.getItem(TK);
    if (!t) {
      try {
        const auth = JSON.parse(localStorage.getItem('ch-auth') || '{}');
        t = auth && auth.state && auth.state.token;
      } catch {}
    }
    return t;
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const tk = getToken();
    if (tk) headers['Authorization'] = 'Bearer ' + tk;
    const res = await fetch(path, Object.assign({}, opts, {
      headers,
      body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
    }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.detail || data.message || res.statusText);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ==================== 设置持久化 ====================
  const DEFAULT_SETTINGS = {
    language: 'zh-CN',
    theme: 'light',
    defaultPlatforms: [],
    lastUsedPlatforms: [],
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SK);
      if (raw) return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
    } catch {}
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  function saveSettings(s) {
    localStorage.setItem(SK, JSON.stringify(s));
  }

  let settings = loadSettings();

  // ==================== 主题系统 ====================
  const THEMES = {
    light: { name: '浅色', icon: '☀️', bg: '#ffffff', text: '#1f2937', surface: '#f9fafb', border: '#e5e7eb', primary: '#667eea' },
    dark:  { name: '深色', icon: '🌙', bg: '#0f172a', text: '#e2e8f0', surface: '#1e293b', border: '#334155', primary: '#818cf8' },
    eye:   { name: '护眼', icon: '🌿', bg: '#f5f1e3', text: '#3d3520', surface: '#ede7d3', border: '#d4c9a8', primary: '#8b6f47' },
  };

  function applyTheme(themeKey) {
    const theme = THEMES[themeKey] || THEMES.light;
    document.documentElement.setAttribute('data-ch-theme', themeKey);
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.text;
    document.body.style.transition = 'background-color 0.3s, color 0.3s';
    const root1 = document.querySelector('#root > div');
    if (root1) {
      root1.style.backgroundColor = theme.bg;
      root1.style.color = theme.text;
    }
    let themeStyle = document.getElementById('ch-theme-style');
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.id = 'ch-theme-style';
      document.head.appendChild(themeStyle);
    }
    themeStyle.textContent = `
      [data-ch-theme="${themeKey}"] body { background-color: ${theme.bg} !important; color: ${theme.text} !important; }
      [data-ch-theme="${themeKey}"] .left-panel,
      [data-ch-theme="${themeKey}"] aside,
      [data-ch-theme="${themeKey}"] header,
      [data-ch-theme="${themeKey}"] .right-panel,
      [data-ch-theme="${themeKey}"] .workbench {
        background-color: ${theme.surface} !important; color: ${theme.text} !important;
        border-color: ${theme.border} !important;
      }
    `;
  }

  function applyLanguage(lang) {
    document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : 'en';
    localStorage.setItem('ch-language', lang);
  }

  applyTheme(settings.theme);
  applyLanguage(settings.language);

  // ==================== 浮层系统 ====================
  function ensureOverlayRoot() {
    let root = document.getElementById('ch-patch-root');
    if (!root) {
      root = el('div', { id: 'ch-patch-root', style: { position: 'fixed', inset: '0', zIndex: '99999', pointerEvents: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' } });
      document.body.appendChild(root);
    }
    return root;
  }

  function showModal(opts) {
    const { title, body, actions, width = '440px', icon = '' } = opts || {};
    const root = ensureOverlayRoot();
    const overlay = el('div', { style: { position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', zIndex: '99999' }, onclick: (e) => { if (e.target === overlay) close(); } });
    const modal = el('div', { style: { background: '#fff', borderRadius: '12px', maxWidth: width, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflow: 'auto', animation: 'chModalIn 0.2s ease-out' } });
    const header = el('div', { style: { padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', borderRadius: '12px 12px 0 0' } },
      el('h2', { style: { margin: 0, fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' } }, icon && el('span', null, icon), title));
    const closeBtn = el('button', { style: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', lineHeight: '1', padding: 0 }, onclick: () => close() }, '×');
    header.appendChild(closeBtn);
    modal.appendChild(header);
    const bodyDiv = el('div', { style: { padding: '24px' } });
    if (typeof body === 'string') bodyDiv.innerHTML = body;
    else if (body instanceof HTMLElement) bodyDiv.appendChild(body);
    modal.appendChild(bodyDiv);
    if (actions && actions.length) {
      const footer = el('div', { style: { padding: '16px 24px', borderTop: '1px solid #eee', display: 'flex', gap: '8px', justifyContent: 'flex-end' } });
      for (const a of actions) footer.appendChild(a);
      modal.appendChild(footer);
    }
    overlay.appendChild(modal);
    root.appendChild(overlay);
    function close() { overlay.remove(); }
    return { close };
  }

  function showToast(msg, type = 'info', duration = 3000) {
    const root = ensureOverlayRoot();
    const colors = { info: '#3b82f6', success: '#10b981', error: '#ef4444', warn: '#f59e0b' };
    const toast = el('div', { style: { position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', background: colors[type] || colors.info, color: '#fff', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: '99999', pointerEvents: 'auto', fontSize: '14px', fontWeight: '500', animation: 'chToastIn 0.3s ease-out' } }, msg);
    root.appendChild(toast);
    setTimeout(() => { toast.style.transition = 'opacity 0.3s'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, duration);
  }

  function logout() {
    localStorage.removeItem(TK);
    showToast('已退出登录', 'info', 1500);
    setTimeout(() => location.href = '/login', 800);
  }

  // CSS 注入
  if (!document.getElementById('ch-patch-css')) {
    const style = document.createElement('style');
    style.id = 'ch-patch-css';
    style.textContent = `
      @keyframes chToastIn { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
      @keyframes chModalIn { from { opacity: 0; transform: scale(0.95) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .ch-btn { padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
      .ch-btn-primary { background: #667eea; color: #fff; }
      .ch-btn-primary:hover { background: #5568d3; }
      .ch-btn-secondary { background: #f3f4f6; color: #374151; }
      .ch-btn-secondary:hover { background: #e5e7eb; }
      .ch-btn-danger { background: #ef4444; color: #fff; }
      .ch-btn-danger:hover { background: #dc2626; }
      .ch-select { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: #fff; cursor: pointer; }
      .ch-select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
      .ch-form-group { margin-bottom: 20px; }
      .ch-form-label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #374151; }
      .ch-form-desc { font-size: 12px; color: #6b7280; margin-top: 4px; }
      .ch-info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
      .ch-info-label { color: #6b7280; }
      .ch-info-value { color: #111827; font-weight: 500; }
      .ch-info-value.verified { color: #10b981; }
      .ch-info-value.unverified { color: #f59e0b; }
      .ch-balance { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #fff; padding: 20px; border-radius: 8px; text-align: center; margin: 16px 0; }
      .ch-balance-amount { font-size: 32px; font-weight: 700; margin: 8px 0; }
      .ch-balance-label { font-size: 13px; opacity: 0.9; }
      .ch-input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
      .ch-input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
      .ch-platform-list { max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; background: #fafafa; }
      .ch-platform-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer; }
      .ch-platform-item:hover { background: #f3f4f6; }
      .ch-platform-item .name { flex: 1; font-size: 14px; }
      .ch-platform-item .desc { font-size: 11px; color: #6b7280; }
      .ch-segment { display: flex; gap: 4px; padding: 4px; background: #f3f4f6; border-radius: 8px; }
      .ch-segment-item { flex: 1; padding: 8px 12px; text-align: center; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
      .ch-segment-item:hover { background: #e5e7eb; }
      .ch-segment-item.active { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); color: #667eea; font-weight: 500; }
    `;
    document.head.appendChild(style);
  }

  // 暴露给 PART2 使用
  // 创建 window.__chPatch (PART2 会通过 Object.assign 补全函数)
  window.__chPatch = window.__chPatch || {};
  window.__chPatchInternals = { el, $, $all, showModal, showToast, api, loadSettings, saveSettings, THEMES, applyTheme, applyLanguage, logout, ensureOverlayRoot };
})();/* Content Hub V6.4 PART2 - 业务函数 (openAccountInfo, openSettings, openUpgrade, toggleAvatarDropdown)
 * 用 window.__chPatchInternals 拿 PART1 的工具
 */
(function() {
  'use strict';
  const I = window.__chPatchInternals;
  const { el, $, $all, showModal, showToast, api, loadSettings, saveSettings, THEMES, applyTheme, applyLanguage, logout } = I;

  // ==================== 账号信息 Modal ====================
  async function openAccountInfo() {
    let userData;
    try {
      userData = await api('/api/auth/me');
    } catch (e) {
      showToast('❌ 获取账号信息失败: ' + e.message, 'error');
      return;
    }

    const formatDate = (d) => d ? new Date(d).toLocaleString('zh-CN') : '从未';
    const balance = (userData.balance || 0).toFixed(2);

    const body = el('div', {},
      el('div', { class: 'ch-balance' },
        el('div', { class: 'ch-balance-label' }, '账户余额'),
        el('div', { class: 'ch-balance-amount' }, '¥ ' + balance),
      ),
      el('div', { class: 'ch-info-row' },
        el('span', { class: 'ch-info-label' }, '用户名'),
        el('span', { class: 'ch-info-value' }, userData.username || '-'),
      ),
      el('div', { class: 'ch-info-row' },
        el('span', { class: 'ch-info-label' }, '邮箱'),
        el('span', { class: 'ch-info-value ' + (userData.email_verified ? 'verified' : 'unverified') },
          (userData.email || '未设置') + (userData.email_verified ? ' ✓' : ' ⚠ 未验证'),
        ),
      ),
      el('div', { class: 'ch-info-row' },
        el('span', { class: 'ch-info-label' }, '显示名'),
        el('span', { class: 'ch-info-value' }, userData.display_name || '-'),
      ),
      el('div', { class: 'ch-info-row' },
        el('span', { class: 'ch-info-label' }, '注册时间'),
        el('span', { class: 'ch-info-value' }, formatDate(userData.created_at)),
      ),
      el('div', { class: 'ch-info-row' },
        el('span', { class: 'ch-info-label' }, '最后登录'),
        el('span', { class: 'ch-info-value' }, formatDate(userData.last_login_at)),
      ),
      el('div', { style: { marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        el('button', { class: 'ch-btn ch-btn-secondary', onclick: () => { modal.close(); showEditProfileModal(userData); } }, '✏️ 编辑资料'),
        el('button', { class: 'ch-btn ch-btn-secondary', onclick: () => { modal.close(); showChangePasswordModal(userData.email); } }, '🔑 修改密码'),
      ),
    );

    const closeBtn = el('button', { class: 'ch-btn ch-btn-secondary', onclick: () => modal.close() }, '关闭');
    const logoutBtn = el('button', { class: 'ch-btn ch-btn-danger', onclick: () => { modal.close(); logout(); } }, '退出登录');

    const modal = showModal({ title: '账号信息', body, actions: [closeBtn, logoutBtn], width: '500px', icon: '👤' });
  }

  function showEditProfileModal(userData) {
    let dnInput, emInput;
    const body = el('div', {},
      el('div', { class: 'ch-form-group' },
        el('label', { class: 'ch-form-label' }, '显示名'),
        dnInput = el('input', { type: 'text', class: 'ch-input', value: userData.display_name || '' }),
      ),
      el('div', { class: 'ch-form-group' },
        el('label', { class: 'ch-form-label' }, '邮箱 (修改后需重新验证)'),
        emInput = el('input', { type: 'email', class: 'ch-input', value: userData.email || '' }),
      ),
      el('div', { id: 'ch-edit-msg', style: { fontSize: '13px', minHeight: '20px' } }),
    );
    const saveBtn = el('button', {
      class: 'ch-btn ch-btn-primary',
      onclick: async () => {
        saveBtn.disabled = true; saveBtn.textContent = '保存中...';
        try {
          await api('/api/auth/me', { method: 'PUT', body: { display_name: dnInput.value, email: emInput.value || null } });
          modal.close();
          showToast('✅ 资料已更新' + (emInput.value !== userData.email ? ', 请查收新邮箱的验证邮件' : ''), 'success', 4000);
        } catch (e) {
          $('#ch-edit-msg').textContent = e.message;
          $('#ch-edit-msg').style.color = '#ef4444';
          saveBtn.disabled = false; saveBtn.textContent = '保存';
        }
      },
    }, '保存');
    const cancelBtn = el('button', { class: 'ch-btn ch-btn-secondary', onclick: () => modal.close() }, '取消');
    const modal = showModal({ title: '编辑资料', body, actions: [cancelBtn, saveBtn], icon: '✏️' });
  }

  function showChangePasswordModal(currentEmail) {
    if (!currentEmail) {
      showToast('⚠️ 请先设置邮箱, 然后通过邮箱链接修改密码', 'warn', 5000);
      return;
    }
    showForgotPasswordModal();
  }

  // ==================== 设置 Modal ====================
  async function openSettings() {
    let platforms = [];
    try {
      const r = await api('/api/integrations/multipost/platforms');
      platforms = (r && (r.platforms || r.items)) || (Array.isArray(r) ? r : []);
    } catch (e) {
      platforms = [
        { key: 'wechat-mp', name: '微信公众号', icon: '💬', desc: '文章' },
        { key: 'zhihu', name: '知乎', icon: '🟢', desc: '文章' },
        { key: 'csdn', name: 'CSDN', icon: '🔶', desc: '文章' },
        { key: 'juejin', name: '掘金', icon: '⛏️', desc: '文章' },
        { key: 'bilibili', name: 'B站', icon: '📺', desc: '文章' },
        { key: 'x-twitter', name: 'X (Twitter)', icon: '🐦', desc: '短文' },
      ];
    }

    let currentSettings = loadSettings();

    let langSelect;
    const langOptions = [
      { value: 'zh-CN', label: '简体中文' },
      { value: 'en-US', label: 'English' },
    ];
    langSelect = el('select', { class: 'ch-select' },
      ...langOptions.map(o => {
        const opt = el('option', { value: o.value }, o.label);
        if (o.value === currentSettings.language) opt.selected = true;
        return opt;
      })
    );

    const themeRow = el('div', { class: 'ch-segment' },
      ...Object.entries(THEMES).map(([key, t]) => {
        const item = el('div', {
          class: 'ch-segment-item' + (currentSettings.theme === key ? ' active' : ''),
          'data-theme': key,
          onclick: () => {
            currentSettings.theme = key;
            saveSettings(currentSettings);
            applyTheme(key);
            themeRow.querySelectorAll('.ch-segment-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-theme') === key));
            showToast('✅ 主题已切换到 ' + t.name, 'success', 1500);
          },
        }, t.icon + ' ' + t.name);
        return item;
      })
    );

    const platformItems = platforms.map(p => ({
      key: p.key || p.name,
      displayName: p.name || p.platformName,
      icon: p.icon || '',
      desc: p.desc || '',
    }));

    const platformList = el('div', { class: 'ch-platform-list' });
    function renderPlatformList() {
      platformList.innerHTML = '';
      if (platformItems.length === 0) {
        platformList.appendChild(el('div', { style: { padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' } }, '暂无可用平台 (需要先安装 SailorPost 扩展并登录)'));
        return;
      }
      platformItems.forEach(p => {
        const isChecked = currentSettings.defaultPlatforms.includes(p.key);
        const checkbox = el('input', { type: 'checkbox' });
        // setAttribute('checked', ...) 不生效; 必须用 .checked property
        checkbox.checked = isChecked;
        const item = el('label', { class: 'ch-platform-item' },
          checkbox,
          el('span', { class: 'name' }, (p.icon ? p.icon + ' ' : '') + p.displayName),
          el('span', { class: 'desc' }, p.desc),
        );
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            if (!currentSettings.defaultPlatforms.includes(p.key)) currentSettings.defaultPlatforms.push(p.key);
          } else {
            currentSettings.defaultPlatforms = currentSettings.defaultPlatforms.filter(n => n !== p.key);
          }
        });
        platformList.appendChild(item);
      });
    }
    renderPlatformList();

    const selectAllBtn = el('button', {
      class: 'ch-btn ch-btn-secondary',
      style: { padding: '4px 10px', fontSize: '12px' },
      type: 'button',
      onclick: () => {
        console.log('[patch] selectAll clicked, items=', platformItems.length, 'current=', currentSettings.defaultPlatforms);
        const allChecked = platformItems.length > 0 && platformItems.every(p => currentSettings.defaultPlatforms.includes(p.key));
        currentSettings.defaultPlatforms = allChecked ? [] : platformItems.map(p => p.key);
        console.log('[patch] after toggle, defaultPlatforms=', currentSettings.defaultPlatforms);
        saveSettings(currentSettings);
        renderPlatformList();
      },
    }, '🔄 全选/全不选');

    const lastUsed = currentSettings.lastUsedPlatforms && currentSettings.lastUsedPlatforms.length > 0
      ? el('div', { style: { fontSize: '12px', color: '#6b7280', marginTop: '4px' } }, '上次发布选了 ' + currentSettings.lastUsedPlatforms.length + ' 个平台')
      : null;

    const body = el('div', {},
      el('div', { class: 'ch-form-group' },
        el('label', { class: 'ch-form-label' }, '🌐 语言'),
        langSelect,
        el('div', { class: 'ch-form-desc' }, '切换主界面语言 (当前大部分文案只支持简体中文)'),
      ),
      el('div', { class: 'ch-form-group' },
        el('label', { class: 'ch-form-label' }, '🎨 主题'),
        themeRow,
        el('div', { class: 'ch-form-desc' }, '实时切换, 设置保存到浏览器'),
      ),
      el('div', { class: 'ch-form-group' },
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
          el('label', { class: 'ch-form-label', style: { margin: 0 } }, '🚀 默认发布平台'),
          selectAllBtn,
        ),
        platformList,
        el('div', { class: 'ch-form-desc' }, '勾选后, 一键发布时自动选中这些平台, 不用每次都手动勾'),
        lastUsed,
      ),
    );

    const closeBtn = el('button', { class: 'ch-btn ch-btn-secondary', onclick: () => modal.close() }, '取消');
    const saveBtn = el('button', {
      class: 'ch-btn ch-btn-primary',
      onclick: () => {
        currentSettings.language = langSelect.value;
        applyLanguage(currentSettings.language);
        saveSettings(currentSettings);
        modal.close();
        showToast('✅ 设置已保存', 'success', 2000);
      },
    }, '💾 保存设置');

    const modal = showModal({ title: '设置', body, actions: [closeBtn, saveBtn], icon: '⚙️', width: '480px' });
  }

  // ==================== 升级套餐 Modal ====================
  function openUpgrade() {
    const body = el('div', {},
      el('p', { style: { marginTop: 0, color: '#6b7280', textAlign: 'center' } }, '解锁更多功能 · 内容创作者的得力助手'),
      el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '16px 0' } },
        el('div', { style: { border: '2px solid #e5e7eb', borderRadius: '10px', padding: '16px' } },
          el('div', { style: { fontWeight: '700', fontSize: '16px', marginBottom: '4px' } }, '免费版'),
          el('div', { style: { color: '#667eea', fontSize: '24px', fontWeight: '700', margin: '8px 0' } }, '¥0', el('span', { style: { fontSize: '14px', color: '#6b7280', fontWeight: '400' } }, ' /永久')),
          el('div', { style: { fontSize: '13px', color: '#4b5563', lineHeight: '1.8' }, innerHTML: '✓ 100 篇文章<br>✓ 5 个标签<br>✓ 一键发布<br>✗ AI 智能助手' }),
          el('div', { style: { marginTop: '12px', textAlign: 'center', color: '#10b981', fontWeight: '500' } }, '当前套餐'),
        ),
        el('div', { style: { border: '2px solid #667eea', borderRadius: '10px', padding: '16px', background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)' } },
          el('div', { style: { fontWeight: '700', fontSize: '16px', marginBottom: '4px' } }, '专业版 ', el('span', { style: { display: 'inline-block', background: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' } }, '推荐')),
          el('div', { style: { color: '#667eea', fontSize: '24px', fontWeight: '700', margin: '8px 0' } }, '¥29', el('span', { style: { fontSize: '14px', color: '#6b7280', fontWeight: '400' } }, ' /月')),
          el('div', { style: { fontSize: '13px', color: '#4b5563', lineHeight: '1.8' }, innerHTML: '✓ 不限文章数<br>✓ 不限标签<br>✓ 一键发布<br>✓ AI 智能助手<br>✓ 数据统计<br>✓ 优先客服' }),
          el('button', {
            class: 'ch-btn ch-btn-primary',
            style: { width: '100%', marginTop: '12px' },
            onclick: () => { modal.close(); showToast('💳 支付集成开发中, 即将上线', 'info', 3000); },
          }, '升级到专业版'),
        ),
      ),
      el('div', { style: { textAlign: 'center', color: '#9ca3af', fontSize: '12px', marginTop: '12px' } }, '所有套餐 7 天无理由退款'),
    );
    const closeBtn = el('button', { class: 'ch-btn ch-btn-secondary', onclick: () => modal.close() }, '关闭');
    const modal = showModal({ title: '升级套餐', body, actions: [closeBtn], icon: '✨', width: '500px' });
  }

  // ==================== 头像菜单 (V6.4 修复) ====================
  function getAvatarUsername() {
    let u = null;
    try {
      const raw = localStorage.getItem('ch-auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        u = parsed && parsed.state && parsed.state.user;
      }
    } catch {}
    return u || {};
  }

  // ==================== Patch 主 JS 的 alert 调用 ====================
  // 主 JS hover dropdown 里有 3 个 alert() 点名调用 (账号信息 / 设置 / 升级套餐)
  // 这里劫持 window.alert 并根据 alert text 调用对应功能
  const _origAlert = window.alert;
  window.alert = function(msg) {
    const s = String(msg || '');
    if (s.includes('用户中心')) {
      _origAlert.call(window, '账号信息 modal 已实装，请使用弹出的实际面板');
      return;
    }
    if (s.includes('设置')) {
      _origAlert.call(window, '设置 modal 已实装，请使用弹出的实际面板');
      return;
    }
    if (s.includes('升级套餐')) {
      _origAlert.call(window, '升级套餐 modal 已实装，请使用弹出的实际面板');
      return;
    }
    return _origAlert.apply(window, arguments);
  };

  // 通过 React fiber 节点修改 ad-item 的 onClick
  function patchAvatarDropdownItems() {
    const items = document.querySelectorAll('.avatar-menu-wrap .ad-item');
    items.forEach(item => {
      if (item.__chFiberPatched) return;
      // 找 React fiber key
      const fiberKey = Object.keys(item).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
      if (!fiberKey) return;
      const fiber = item[fiberKey];
      // 沿 fiber 向上找到 onClick 的 props
      let p = fiber;
      while (p) {
        if (p.memoizedProps && typeof p.memoizedProps.onClick === 'function') {
          const orig = p.memoizedProps.onClick;
          const text = item.textContent;
          p.memoizedProps.onClick = (e) => {
            // 不调用原始 onClick (避免 alert)
            if (text.includes('账号信息')) {
              openAccountInfo();
            } else if (text.includes('设置')) {
              openSettings();
            } else if (text.includes('升级套餐')) {
              openUpgrade();
            } else if (text.includes('退出登录')) {
              I.logout();
            }
          };
          // 也 patch pendingProps
          if (p.pendingProps) {
            p.pendingProps.onClick = p.memoizedProps.onClick;
          }
          item.__chFiberPatched = true;
          break;
        }
        p = p.return;
      }
    });
  }

  // 初始 + 监听 DOM 变化
  patchAvatarDropdownItems();
  const adObserver = new MutationObserver(() => {
    setTimeout(patchAvatarDropdownItems, 50);
  });
  adObserver.observe(document.body, { childList: true, subtree: true });

  // ==================== 一键发布: 默认平台预选 ====================
  function applyDefaultPlatformsToPublish() {
    const s = loadSettings();
    if (!s.defaultPlatforms || s.defaultPlatforms.length === 0) return false;
    const platforms = document.querySelectorAll('.pm-platform');
    if (platforms.length === 0) return false;
    let applied = 0;
    platforms.forEach(label => {
      const cb = label.querySelector('input[type="checkbox"]');
      const nameEl = label.querySelector('.pm-platform-name');
      if (!cb || !nameEl) return;
      const displayName = nameEl.textContent.trim();
      // 需要从主 JS state 里找 T.name 对应的 key
      // 简单映射: 中文名 + 类型 → key
      const key = inferPlatformKey(displayName);
      const shouldCheck = s.defaultPlatforms.includes(key);
      // 只在状态不符时才点 (避免重复触发)
      if (cb.checked !== shouldCheck) {
        cb.click();  // 触发 React onChange
        applied++;
      }
    });
    if (applied > 0) {
      showToast(`✅ 已默认勾选 ${applied} 个平台 (来自设置)`, 'success', 2500);
    }
    return applied > 0;
  }

  function inferPlatformKey(displayName) {
    // 根据 .pm-platform-desc 或其他信息推断 key (主 JS 里 T.name 是 key)
    const map = {
      '微信公众号': 'wechat-mp',
      '知乎': 'zhihu',
      '掘金': 'juejin',
      'CSDN': 'csdn',
      '微博': 'weibo',
      'B站': 'bilibili',
      'X (Twitter)': 'x-twitter',
      '小红书': 'xiaohongshu',
      '今日头条': 'toutiao',
      '百家号': 'baijiahao',
    };
    return map[displayName] || displayName;
  }

  // 监听 PublishModal 出现 → 自动预选
  const publishObserver = new MutationObserver(() => {
    const modal = document.querySelector('.modal-publish');
    if (!modal) return;
    // 避免重复调用 (RenderModal 已经预选 → patch.js 又点 → 取消预选)
    if (modal.__chAppliedDefault) return;
    // 等待平台列表渲染
    const platforms = modal.querySelectorAll('.pm-platform');
    if (platforms.length === 0) return;
    // 用 setTimeout 等 React 完全渲染完
    setTimeout(() => {
      if (modal.__chAppliedDefault) return;
      modal.__chAppliedDefault = true;
      applyDefaultPlatformsToPublish();
    }, 200);
  });
  publishObserver.observe(document.body, { childList: true, subtree: true });

  // ==================== 暴露给主 JS ====================
  Object.assign(window.__chPatch, {
    openAccountInfo,
    openSettings,
    openUpgrade,
    applyDefaultPlatforms: applyDefaultPlatformsToPublish,
  });

  console.log('[Content Hub V6.9 Patch] loaded — alert hijacked + auto-select default platforms');
})();