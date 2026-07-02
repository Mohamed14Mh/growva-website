(function () {
  'use strict';

  const MOCK_SESSION_KEY = 'growva_admin_session';
  const MOCK_DRAFT_KEY = 'growva_admin_draft';
  const MOCK_EMAIL = 'admin@growva.local';
  const MOCK_PASSWORD = 'growva-admin';
  const PLACEHOLDER_URL = 'https://YOUR_PROJECT.supabase.co';
  const PLACEHOLDER_KEY = 'YOUR_SUPABASE_ANON_KEY';

  const params = new URLSearchParams(window.location.search);
  const mockAdminEnabled = params.get('mockAdmin') === 'true';
  const cmsDebug = params.get('cmsDebug') === 'true';
  const pagePath = getPagePath();

  let mode = 'preview';
  let selectedElement = null;
  let adminRoot = null;
  let modal = null;
  let panel = null;
  let hoverBadge = null;
  let entryEventsBound = false;
  let supabaseClient = null;
  let supabaseState = {
    configured: false,
    ready: false,
    unsafeKey: false,
    failed: false,
    label: 'Supabase not configured',
    warning: ''
  };
  let currentUser = null;
  let adminProfile = null;
  let publishedRows = {};
  let draftRows = {};
  let originalValues = {};
  let unsavedCount = 0;
  let statusMessage = '';
  let mockDraft = readMockDraft();
  let publishedRowsLoadedCount = 0;
  let draftRowsLoadedCount = 0;
  let saveInFlight = false;
  let publishInFlight = false;
  let resetInFlight = false;

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function getPagePath() {
    const pathname = decodeURIComponent(window.location.pathname || '/');
    const script = document.currentScript || $('script[src$="admin/admin.js"]');
    let rootPath = '/';
    try {
      if (script && script.src) {
        const scriptPath = new URL(script.src, window.location.href).pathname.replace(/\\/g, '/');
        rootPath = scriptPath.replace(/admin\/admin\.js(?:\?.*)?$/, '');
      }
    } catch (error) {
      rootPath = '/';
    }
    let clean = pathname.replace(/\\/g, '/').replace(/\/+/g, '/');
    rootPath = rootPath.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (rootPath !== '/' && clean.indexOf(rootPath) === 0) clean = clean.slice(rootPath.length);
    clean = clean.replace(/^\/+/, '').replace(/\/+/g, '/');
    if (!clean || clean.endsWith('/')) clean = `${clean}index.html`;
    clean = clean.replace(/^([A-Za-z]:)?\/?/, match => match.includes(':') ? '' : match);
    const adminIndex = clean.lastIndexOf('/admin/admin.js');
    if (adminIndex >= 0) clean = 'index.html';
    return clean || 'index.html';
  }

  function getSupabaseConfig() {
    const config = window.GROWVA_SUPABASE_CONFIG || {};
    const url = typeof config.url === 'string' ? config.url.trim() : '';
    const anonKey = typeof config.anonKey === 'string' ? config.anonKey.trim() : '';
    const unsafeKey = isUnsafeSupabaseKey(anonKey);
    const configured = Boolean(
      url &&
      anonKey &&
      !unsafeKey &&
      url !== PLACEHOLDER_URL &&
      anonKey !== PLACEHOLDER_KEY &&
      !url.includes('YOUR_PROJECT') &&
      !anonKey.includes('YOUR_SUPABASE')
    );
    return { url, anonKey, configured, unsafeKey };
  }

  function isUnsafeSupabaseKey(key) {
    const value = String(key || '').trim();
    const lower = value.toLowerCase();
    if (!value) return false;
    if (lower.startsWith('sb_secret_')) return true;
    if (lower.includes('service_role') || lower.includes('service-role') || lower.includes('service role')) return true;
    if (lower.includes('supabase_service_role')) return true;
    const jwtRole = getJwtRole(value);
    return jwtRole === 'service_role' || jwtRole === 'supabase_admin';
  }

  function getJwtRole(value) {
    if (!value || value.split('.').length < 2) return '';
    try {
      const payload = value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decoded = JSON.parse(atob(padded));
      return String(decoded.role || '').toLowerCase();
    } catch (error) {
      return '';
    }
  }

  function initSupabase() {
    const config = getSupabaseConfig();
    supabaseState.configured = config.configured;
    supabaseState.unsafeKey = config.unsafeKey;
    supabaseState.failed = false;
    supabaseState.warning = '';
    if (config.unsafeKey) {
      supabaseClient = null;
      supabaseState.ready = false;
      supabaseState.label = 'Unsafe key detected';
      supabaseState.warning = 'Unsafe Supabase key detected. Use publishable/anon key only.';
      return;
    }
    if (!config.configured) {
      supabaseClient = null;
      supabaseState.ready = false;
      supabaseState.label = 'Supabase not configured';
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      supabaseClient = null;
      supabaseState.ready = false;
      supabaseState.failed = true;
      supabaseState.label = 'Supabase connection failed';
      supabaseState.warning = 'Supabase connection failed. The browser client could not initialize.';
      return;
    }
    try {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      supabaseState.ready = true;
      supabaseState.label = 'Logged out';
    } catch (error) {
      supabaseClient = null;
      supabaseState.ready = false;
      supabaseState.failed = true;
      supabaseState.label = 'Supabase connection failed';
      supabaseState.warning = 'Supabase connection failed. Check the project URL and publishable key.';
    }
  }

  function setupAuthStateListener() {
    if (!supabaseClient || !supabaseClient.auth || typeof supabaseClient.auth.onAuthStateChange !== 'function') return;
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        currentUser = null;
        adminProfile = null;
        supabaseState.label = 'Logged out';
        if (document.body.classList.contains('admin-mode')) exitAdminMode();
        updateTopbar();
        return;
      }
      if (session.user) {
        await loadAdminProfile(session.user);
        updateTopbar();
      }
    });
  }

  function readMockDraft() {
    try {
      return JSON.parse(localStorage.getItem(MOCK_DRAFT_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function saveMockDraft() {
    localStorage.setItem(MOCK_DRAFT_KEY, JSON.stringify(mockDraft));
  }

  function captureOriginalValues() {
    $all('[data-edit-key]').forEach(element => {
      const key = element.dataset.editKey;
      if (!key || Object.prototype.hasOwnProperty.call(originalValues, key)) return;
      originalValues[key] = getEditableValue(element);
      element.dataset.adminOriginalText = originalValues[key];
    });
  }

  function getRegistry() {
    if (window.GROWVA_CONTENT_REGISTRY) return window.GROWVA_CONTENT_REGISTRY;
    const fields = {};
    $all('[data-edit-key]').forEach(element => {
      if (!fields[element.dataset.editKey]) fields[element.dataset.editKey] = element;
    });
    return {
      pageId: document.body.dataset.pageId || 'unknown',
      fields,
      duplicateKeys: [],
      sections: $all('[data-section-type]'),
      keys() {
        return Object.keys(fields);
      },
      get(key) {
        return fields[key] || null;
      }
    };
  }

  function currentPageLabel() {
    const registry = getRegistry();
    const title = document.title ? document.title.split('|')[0].trim() : '';
    return `${registry.pageId || 'unknown'} - ${title || pagePath}`;
  }

  function isLocalFileMode() {
    return window.location.protocol === 'file:';
  }

  function getConnectionLabel() {
    if (supabaseState.unsafeKey) return 'Unsafe key detected';
    if (supabaseState.failed) return 'Supabase connection failed';
    if (!supabaseState.configured) return 'Supabase not configured';
    if (adminProfile && adminProfile.role) return `Supabase connected - ${adminProfile.role}`;
    if (supabaseState.ready) return currentUser ? 'Supabase connected' : 'Logged out';
    return supabaseState.label || 'Logged out';
  }

  function ensureRoot() {
    if (adminRoot) return adminRoot;
    adminRoot = document.createElement('div');
    adminRoot.className = 'gv-admin-root';
    adminRoot.dataset.adminUi = 'true';
    adminRoot.setAttribute('data-lenis-prevent', '');
    document.body.appendChild(adminRoot);
    buildModal();
    buildTopbar();
    buildPanel();
    buildHoverBadge();
    bindGlobalEvents();
    return adminRoot;
  }

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'gv-admin-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'gvAdminLoginTitle');
    modal.innerHTML = `
      <form class="gv-admin-login" data-admin-login-form>
        <div class="gv-admin-login-head">
          <div>
            <div class="gv-admin-kicker">GROWVA Admin</div>
            <h2 id="gvAdminLoginTitle">Owner access</h2>
            <p data-admin-login-copy>Sign in with Supabase Auth to manage draft and published content.</p>
          </div>
          <button class="gv-admin-close" type="button" aria-label="Close login" data-admin-action="close-modal">x</button>
        </div>
        <div class="gv-admin-warning" data-admin-config-warning hidden>Supabase is not configured yet.</div>
        <div class="gv-admin-field">
          <label for="gvAdminEmail">Email</label>
          <input id="gvAdminEmail" type="email" autocomplete="username" required>
        </div>
        <div class="gv-admin-field">
          <label for="gvAdminPassword">Password</label>
          <input id="gvAdminPassword" type="password" autocomplete="current-password" required>
        </div>
        <div class="gv-admin-error" data-admin-login-error></div>
        <button class="gv-admin-action gv-admin-action--mint" type="submit" style="width:100%;min-height:42px;">Enter Admin Mode</button>
        <p class="gv-admin-note" data-admin-login-note>Authentication is handled by Supabase. This static site never stores admin passwords.</p>
      </form>
    `;
    adminRoot.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });

    $('[data-admin-login-form]', modal).addEventListener('submit', handleLoginSubmit);
  }

  function buildTopbar() {
    const topbar = document.createElement('div');
    topbar.className = 'gv-admin-topbar';
    topbar.innerHTML = `
      <div class="gv-admin-brand">
        <div class="gv-admin-mark">G</div>
        <div class="gv-admin-title">
          <strong>GROWVA Admin</strong>
          <span data-admin-page-label></span>
        </div>
      </div>
      <div class="gv-admin-segment" aria-label="Admin display mode">
        <button type="button" data-admin-action="mode-preview">Preview</button>
        <button type="button" data-admin-action="mode-edit">Edit</button>
      </div>
      <div class="gv-admin-actions">
        <span class="gv-admin-state" data-admin-counts>Unsaved 0 / Drafts 0</span>
        <span class="gv-admin-state" data-admin-connection><span class="gv-admin-status-dot"></span>Offline</span>
        <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="publish-page">Publish</button>
        <button class="gv-admin-action" type="button" data-admin-action="exit-admin">Exit Admin</button>
        <button class="gv-admin-action" type="button" data-admin-action="logout">Logout</button>
      </div>
    `;
    adminRoot.appendChild(topbar);
  }

  function buildPanel() {
    panel = document.createElement('aside');
    panel.className = 'gv-admin-panel';
    panel.setAttribute('aria-label', 'GROWVA admin inspector');
    panel.innerHTML = `
      <div class="gv-admin-panel-head">
        <div>
          <span class="gv-admin-pill">Persistent CMS</span>
          <h3 data-admin-panel-title>Select an editable element</h3>
        </div>
        <button class="gv-admin-close" type="button" aria-label="Close inspector" data-admin-action="close-panel">x</button>
      </div>
      <div class="gv-admin-panel-body" data-admin-panel-body></div>
    `;
    adminRoot.appendChild(panel);
  }

  function buildHoverBadge() {
    hoverBadge = document.createElement('div');
    hoverBadge.className = 'gv-admin-hover-badge';
    hoverBadge.textContent = 'Edit';
    hoverBadge.hidden = true;
    adminRoot.appendChild(hoverBadge);
  }

  function bindGlobalEvents() {
    adminRoot.addEventListener('click', handleAdminClick);
    bindEntryEvents();

    document.addEventListener('click', event => {
      if (!document.body.classList.contains('admin-edit-mode')) return;
      if (event.target.closest('[data-admin-ui], .gv-admin-root, [data-admin-entry]')) return;
      const editable = event.target.closest('[data-edit-key]');
      if (!editable) return;
      event.preventDefault();
      event.stopPropagation();
      selectElement(editable);
    }, true);

    document.addEventListener('mouseover', event => {
      if (!document.body.classList.contains('admin-edit-mode')) return;
      if (event.target.closest('[data-admin-ui], .gv-admin-root')) return;
      const editable = event.target.closest('[data-edit-key]');
      if (!editable) return;
      showHoverBadge(editable);
    });

    document.addEventListener('mouseout', event => {
      if (!document.body.classList.contains('admin-edit-mode')) return;
      const editable = event.target.closest('[data-edit-key]');
      if (editable) hideHoverBadge();
    });

    document.addEventListener('keydown', event => {
      const target = event.target;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (typing) return;
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        if (!document.body.classList.contains('admin-mode')) return;
        event.preventDefault();
        setMode(mode === 'edit' ? 'preview' : 'edit');
      }
      if (event.key === 'Escape') {
        if (modal && modal.classList.contains('is-open')) closeModal();
        else if (selectedElement) clearSelection();
      }
    });
  }

  function bindEntryEvents() {
    if (entryEventsBound) return;
    entryEventsBound = true;

    document.addEventListener('click', event => {
      const entry = event.target.closest('[data-admin-entry]');
      if (!entry) return;
      event.preventDefault();
      event.stopPropagation();
      openAdminEntry();
    }, true);

    document.addEventListener('keydown', event => {
      const target = event.target;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (typing) return;
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        openAdminEntry();
      }
    });
  }

  async function openAdminEntry() {
    ensureRoot();
    if (await hasActiveAdminSession()) enterAdminMode();
    else openModal();
  }

  async function hasActiveAdminSession() {
    if (mockAdminEnabled && localStorage.getItem(MOCK_SESSION_KEY) === 'true') {
      currentUser = { id: 'mock-user', email: MOCK_EMAIL };
      adminProfile = { id: 'mock-user', email: MOCK_EMAIL, role: 'owner' };
      return true;
    }
    if (!supabaseClient) return false;
    let sessionResult = null;
    try {
      sessionResult = await supabaseClient.auth.getSession();
    } catch (error) {
      markConnectionFailed();
      return false;
    }
    if (sessionResult && sessionResult.error) {
      markConnectionFailed();
      return false;
    }
    const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
    if (!session || !session.user) return false;
    return loadAdminProfile(session.user);
  }

  async function loadAdminProfile(user) {
    if (!supabaseClient || !user) return false;
    const { data, error } = await supabaseClient
      .from('admin_profiles')
      .select('id,email,role')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !data || !['owner', 'editor', 'viewer'].includes(data.role)) {
      currentUser = null;
      adminProfile = null;
      supabaseState.label = 'Logged out';
      return false;
    }
    currentUser = user;
    adminProfile = data;
    supabaseState.label = `Supabase connected - ${data.role}`;
    return true;
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const email = $('#gvAdminEmail', modal).value.trim();
    const password = $('#gvAdminPassword', modal).value;
    const error = $('[data-admin-login-error]', modal);
    setLoginError('');

    if (!supabaseClient) {
      if (supabaseState.unsafeKey) {
        error.textContent = 'Unsafe Supabase key detected. Use publishable/anon key only.';
        error.classList.add('is-visible');
        return;
      }
      if (mockAdminEnabled && email === MOCK_EMAIL && password === MOCK_PASSWORD) {
        localStorage.setItem(MOCK_SESSION_KEY, 'true');
        currentUser = { id: 'mock-user', email };
        adminProfile = { id: 'mock-user', email, role: 'owner' };
        closeModal();
        enterAdminMode();
        return;
      }
      error.textContent = supabaseState.configured ? 'Supabase could not be initialized.' : 'Supabase is not configured yet.';
      error.classList.add('is-visible');
      return;
    }

    const submit = $('[data-admin-login-form] button[type="submit"]', modal);
    submit.textContent = 'Signing in...';
    submit.disabled = true;
    let data = null;
    let authError = null;
    try {
      ({ data, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password }));
    } catch (error) {
      authError = error;
      markConnectionFailed();
    }
    submit.textContent = 'Enter Admin Mode';
    submit.disabled = false;
    if (authError || !data || !data.user) {
      setLoginError('Could not sign in with those Supabase credentials.');
      return;
    }
    const allowed = await loadAdminProfile(data.user);
    if (!allowed) {
      await supabaseClient.auth.signOut();
      setLoginError('This user is not listed in admin_profiles.');
      return;
    }
    closeModal();
    enterAdminMode();
  }

  function setLoginError(message) {
    const error = modal ? $('[data-admin-login-error]', modal) : null;
    if (!error) return;
    error.textContent = message;
    error.classList.toggle('is-visible', Boolean(message));
  }

  function handleAdminClick(event) {
    const actionElement = event.target.closest('[data-admin-action]');
    if (!actionElement) return;
    const action = actionElement.dataset.adminAction;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();

    if (action === 'close-modal') closeModal();
    if (action === 'mode-preview') setMode('preview');
    if (action === 'mode-edit') setMode('edit');
    if (action === 'exit-admin') exitAdminMode();
    if (action === 'logout') logout();
    if (action === 'close-panel') clearSelection();
    if (action === 'apply-temp') saveSelectedDraft();
    if (action === 'reset-field') resetSelectedField();
    if (action === 'scroll-section') scrollToSection(actionElement.dataset.sectionTarget);
    if (action === 'publish-page') publishCurrentPage();
  }

  function openModal() {
    ensureRoot();
    updateLoginModalState();
    modal.classList.add('is-open');
    setTimeout(() => $('#gvAdminEmail', modal)?.focus(), 40);
  }

  function updateLoginModalState() {
    if (!modal) return;
    const warning = $('[data-admin-config-warning]', modal);
    const note = $('[data-admin-login-note]', modal);
    const copy = $('[data-admin-login-copy]', modal);
    const submit = $('[data-admin-login-form] button[type="submit"]', modal);
    const warningNeeded = !supabaseClient;
    const fileMessage = isLocalFileMode() ? 'For best CMS behavior, use Live Server or a deployed URL.' : '';
    const configMessage = supabaseState.warning || (warningNeeded ? (supabaseState.configured ? 'Supabase is configured, but the browser client could not initialize.' : 'Supabase is not configured yet.') : '');
    warning.hidden = !configMessage && !fileMessage;
    warning.textContent = [configMessage, fileMessage].filter(Boolean).join(' ');
    if (mockAdminEnabled) {
      warning.hidden = false;
      warning.textContent = 'Local mock admin fallback is enabled for this URL only.';
      note.textContent = `Development fallback credentials: ${MOCK_EMAIL} / ${MOCK_PASSWORD}`;
      copy.textContent = 'Use Supabase Auth, or the URL-only mock fallback for local testing.';
      submit.disabled = false;
    } else {
      note.textContent = 'Authentication is handled by Supabase. This static site never stores admin passwords.';
      copy.textContent = 'Sign in with Supabase Auth to manage draft and published content.';
      submit.disabled = !supabaseClient || supabaseState.unsafeKey;
    }
    setLoginError('');
  }

  function closeModal() {
    if (modal) modal.classList.remove('is-open');
  }

  async function enterAdminMode() {
    ensureRoot();
    document.body.classList.add('admin-mode', 'admin-preview-mode');
    document.body.classList.remove('admin-edit-mode');
    setAdminInteractionIsolation(true);
    mode = 'preview';
    await loadDraftEdits();
    applyDraftRows();
    updateTopbar();
    renderPanelEmpty();
    logCmsDebug('enter-admin-mode');
  }

  function exitAdminMode() {
    clearSelection();
    document.body.classList.remove('admin-mode', 'admin-edit-mode', 'admin-preview-mode');
    setAdminInteractionIsolation(false);
    mode = 'preview';
  }

  function setAdminInteractionIsolation(active) {
    $all('.cursor-dot, .cursor-ring, .custom-cursor, .cursor, [data-cursor]').forEach(cursor => {
      cursor.classList.remove('hovered', 'has-label');
      delete cursor.dataset.label;
      cursor.setAttribute('aria-hidden', active ? 'true' : cursor.getAttribute('aria-hidden') || 'true');
    });
    if (active && window.gsap) {
      window.gsap.set('.btn-primary, .btn-ghost, .btn-nav, .has-tilt', {
        x: 0,
        y: 0,
        clearProps: 'transform'
      });
    }
    if (active) {
      $all('.has-tilt').forEach(card => {
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
      });
    }
  }

  async function logout() {
    if (mockAdminEnabled) localStorage.removeItem(MOCK_SESSION_KEY);
    if (supabaseClient) await supabaseClient.auth.signOut();
    currentUser = null;
    adminProfile = null;
    supabaseState.label = supabaseState.ready ? 'Logged out' : supabaseState.label;
    exitAdminMode();
  }

  function setMode(nextMode) {
    mode = nextMode === 'edit' ? 'edit' : 'preview';
    document.body.classList.toggle('admin-edit-mode', mode === 'edit');
    document.body.classList.toggle('admin-preview-mode', mode !== 'edit');
    if (mode !== 'edit') {
      hideHoverBadge();
      clearSelection(false);
    }
    updateTopbar();
    if (!selectedElement) renderPanelEmpty();
  }

  function updateTopbar() {
    if (!adminRoot) return;
    const label = $('[data-admin-page-label]', adminRoot);
    const counts = $('[data-admin-counts]', adminRoot);
    const connection = $('[data-admin-connection]', adminRoot);
    if (label) label.textContent = currentPageLabel();
    if (counts) counts.textContent = `Unsaved ${unsavedCount} / Drafts ${Object.keys(draftRows).length}`;
    if (connection) {
      const online = (supabaseClient && !supabaseState.unsafeKey && !supabaseState.failed) || (mockAdminEnabled && currentUser);
      const label = mockAdminEnabled && !supabaseClient && currentUser ? 'Mock admin - owner' : getConnectionLabel();
      connection.innerHTML = `<span class="gv-admin-status-dot ${online ? 'is-online' : ''}"></span>${escapeHtml(label)}`;
    }
    $all('[data-admin-action="mode-preview"], [data-admin-action="mode-edit"]', adminRoot).forEach(button => {
      const isPreview = button.dataset.adminAction === 'mode-preview';
      button.classList.toggle('is-active', (mode === 'preview' && isPreview) || (mode === 'edit' && !isPreview));
    });
  }

  function renderPanelEmpty() {
    if (!panel) return;
    const registry = getRegistry();
    const fileWarning = isLocalFileMode()
      ? '<div class="gv-admin-warning">For best CMS behavior, use Live Server or a deployed URL.</div>'
      : '';
    $('[data-admin-panel-title]', panel).textContent = 'Select an editable element';
    $('[data-admin-panel-body]', panel).innerHTML = `
      <p class="gv-admin-empty">Switch to Edit Mode, then select any highlighted text, button, link label, card, or section field.</p>
      ${fileWarning}
      ${statusMessage ? `<div class="gv-admin-warning">${escapeHtml(statusMessage)}</div>` : ''}
      <div class="gv-admin-meta">
        <div>Page path: <code>${escapeHtml(pagePath)}</code></div>
        <div>Page ID: <code>${escapeHtml(registry.pageId || 'unknown')}</code></div>
        <div>Editable fields: <code>${registry.keys().length}</code></div>
        <div>Connection: <code>${escapeHtml(getConnectionLabel())}</code></div>
        <div>Saved drafts: <code>${Object.keys(draftRows).length}</code></div>
        <div>Sections: <code>${registry.sections.length}</code></div>
      </div>
      <div class="gv-admin-divider"></div>
      ${renderSectionNavigator(registry)}
    `;
  }

  function selectElement(element) {
    if (selectedElement) selectedElement.classList.remove('gv-admin-selected');
    selectedElement = element;
    selectedElement.classList.add('gv-admin-selected');
    renderInspector(element);
  }

  function clearSelection(renderEmpty = true) {
    if (selectedElement) selectedElement.classList.remove('gv-admin-selected');
    selectedElement = null;
    hideHoverBadge();
    if (renderEmpty && document.body.classList.contains('admin-mode')) renderPanelEmpty();
  }

  function renderInspector(element) {
    const registry = getRegistry();
    const key = element.dataset.editKey || '';
    const type = element.dataset.editType || 'text';
    const sectionId = element.dataset.sectionId || '';
    const currentValue = getEditableValue(element);
    const draftValue = draftRows[key] ? draftRows[key].value_text || '' : '';
    const publishedValue = publishedRows[key] ? publishedRows[key].value_text || '' : '';
    const originalValue = originalValues[key] || '';
    const fieldTag = currentValue.length > 90 || type === 'card' || type === 'richtext' ? 'textarea' : 'input';
    $('[data-admin-panel-title]', panel).textContent = draftRows[key] ? 'Editing draft override' : 'Editing field';
    $('[data-admin-panel-body]', panel).innerHTML = `
      <div class="gv-admin-meta">
        <div>Edit key: <code>${escapeHtml(key)}</code></div>
        <div>Edit type: <code>${escapeHtml(type)}</code></div>
        <div>Section: <code>${escapeHtml(sectionId || 'none')}</code></div>
        <div>Draft override: <code>${draftRows[key] ? 'yes' : 'no'}</code></div>
      </div>
      <div class="gv-admin-value-stack">
        <div><strong>Published</strong><span>${escapeHtml(publishedValue || 'No published override')}</span></div>
        <div><strong>Draft</strong><span>${escapeHtml(draftValue || 'No draft override')}</span></div>
        <div><strong>Hardcoded</strong><span>${escapeHtml(originalValue || 'Unavailable')}</span></div>
      </div>
      <div class="gv-admin-field">
        <label for="gvAdminFieldValue">Current text value</label>
        ${fieldTag === 'textarea'
          ? `<textarea id="gvAdminFieldValue" class="gv-admin-textarea">${escapeHtml(currentValue)}</textarea>`
          : `<input id="gvAdminFieldValue" type="text" value="${escapeHtml(currentValue)}">`}
      </div>
      <p class="gv-admin-note" data-admin-save-state>Text only. User-entered content is applied with textContent, not HTML.</p>
      <div class="gv-admin-panel-actions">
        <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="apply-temp">Save Draft</button>
        <button class="gv-admin-action" type="button" data-admin-action="reset-field">Reset Field</button>
        <button class="gv-admin-action" type="button" data-admin-action="close-panel">Close</button>
      </div>
      <div class="gv-admin-divider"></div>
      ${renderSectionNavigator(registry)}
    `;
  }

  function renderSectionNavigator(registry) {
    const items = registry.sections.map((section, index) => {
      const id = section.dataset.sectionId || `section-${index + 1}`;
      const type = section.dataset.sectionType || 'section';
      const label = section.querySelector('h1,h2,h3,.eyebrow,.service-section-title,.work-cat-card-name')?.textContent?.trim() || type;
      return `
        <button class="gv-admin-section-btn" type="button" data-admin-action="scroll-section" data-section-target="${escapeHtml(id)}">
          <strong>${escapeHtml(id)}</strong>
          <span>${escapeHtml(type)}${label ? ' - ' + escapeHtml(label).slice(0, 80) : ''}</span>
        </button>
      `;
    }).join('');
    return `
      <div>
        <span class="gv-admin-pill">Section Navigator</span>
        <div class="gv-admin-section-list">${items || '<p class="gv-admin-empty">No section markers found.</p>'}</div>
      </div>
    `;
  }

  function getEditableValue(element) {
    return element.textContent.trim();
  }

  function setEditableValue(element, value) {
    const safeValue = sanitizeText(value);
    if (!element.dataset.adminOriginalText) element.dataset.adminOriginalText = element.textContent.trim();
    const textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
    if (textNode) {
      textNode.nodeValue = safeValue;
      return;
    }
    const textTarget = Array.from(element.children).find(child => {
      if (child.classList.contains('faq-icon') || child.classList.contains('eyebrow-dot') || child.getAttribute('aria-hidden') === 'true') return false;
      return child.textContent.trim();
    });
    if (textTarget && element.children.length <= 3) {
      textTarget.textContent = safeValue;
      return;
    }
    if (element.children.length === 0 || ['text', 'richtext', 'button', 'link'].includes(element.dataset.editType || 'text')) {
      element.textContent = safeValue;
    }
  }

  function sanitizeText(value) {
    return String(value || '').replace(/\u0000/g, '').trim();
  }

  function applyRowToElement(row) {
    if (!row || !row.edit_key) return;
    const element = document.querySelector(`[data-edit-key="${cssEscape(row.edit_key)}"]`);
    if (!element) return;
    if (typeof row.value_text === 'string') setEditableValue(element, row.value_text);
    if (row.value_json && row.value_json.href && element.matches('a[href]') && isSafeHref(row.value_json.href)) {
      element.setAttribute('href', row.value_json.href);
    }
  }

  function isSafeHref(value) {
    const href = String(value || '').trim();
    return href.startsWith('https://') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../') || /^[a-z0-9-]+\.html(?:[#?].*)?$/i.test(href);
  }

  async function saveSelectedDraft() {
    if (saveInFlight) return;
    if (!selectedElement) return;
    const input = $('#gvAdminFieldValue', panel);
    if (!input) return;
    saveInFlight = true;
    const saveButton = $('[data-admin-action="apply-temp"]', panel);
    if (saveButton) saveButton.disabled = true;
    const finishSave = () => {
      saveInFlight = false;
      if (saveButton) saveButton.disabled = false;
    };
    const value = sanitizeText(input.value);
    const key = selectedElement.dataset.editKey;
    const note = $('[data-admin-save-state]', panel);
    setSaveState(note, 'Saving...');
    unsavedCount = 1;
    updateTopbar();
    setEditableValue(selectedElement, value);

    if (mockAdminEnabled && !supabaseClient) {
      mockDraft[key] = value;
      saveMockDraft();
      draftRows[key] = makeLocalDraftRow(selectedElement, value);
      unsavedCount = 0;
      setSaveState(note, 'Draft saved locally in mock mode.');
      updateTopbar();
      renderInspector(selectedElement);
      finishSave();
      return;
    }

    if (!supabaseClient || !currentUser || !adminProfile || !['owner', 'editor'].includes(adminProfile.role)) {
      unsavedCount = 0;
      setSaveState(note, adminProfile && adminProfile.role === 'viewer' ? 'Save failed. Viewers can inspect but cannot save drafts.' : 'Save failed. Supabase admin access is required.');
      updateTopbar();
      finishSave();
      return;
    }

    const payload = makeContentPayload(selectedElement, value, 'draft');
    let data = null;
    let error = null;
    try {
      ({ data, error } = await supabaseClient
        .from('cms_content')
        .upsert(payload, { onConflict: 'page_path,edit_key,status' })
        .select()
        .single());
    } catch (caught) {
      error = caught;
    }

    unsavedCount = 0;
    if (error) {
      setSaveState(note, 'Save failed. Check Supabase policies and schema.');
      updateTopbar();
      finishSave();
      return;
    }
    draftRows[key] = data || payload;
    await insertAuditLog('save_draft', key, originalValues[key] || '', value);
    setSaveState(note, 'Draft saved.');
    updateTopbar();
    renderInspector(selectedElement);
    finishSave();
  }

  function setSaveState(note, value) {
    if (note) note.textContent = value;
    statusMessage = value;
  }

  function makeLocalDraftRow(element, value) {
    return {
      page_path: pagePath,
      page_id: getRegistry().pageId || '',
      edit_key: element.dataset.editKey || '',
      edit_type: element.dataset.editType || 'text',
      section_id: element.dataset.sectionId || '',
      section_type: element.closest('[data-section-type]')?.dataset.sectionType || '',
      value_text: value,
      status: 'draft'
    };
  }

  function makeContentPayload(element, value, status) {
    return {
      page_path: pagePath,
      page_id: getRegistry().pageId || '',
      edit_key: element.dataset.editKey || '',
      edit_type: element.dataset.editType || 'text',
      section_id: element.dataset.sectionId || '',
      section_type: element.closest('[data-section-type]')?.dataset.sectionType || '',
      value_text: value,
      value_json: null,
      status,
      updated_by: currentUser ? currentUser.id : null,
      updated_at: new Date().toISOString()
    };
  }

  async function resetSelectedField() {
    if (resetInFlight) return;
    if (!selectedElement) return;
    const key = selectedElement.dataset.editKey;
    if (!window.confirm('Reset this field draft? Published content will not be deleted.')) return;
    resetInFlight = true;
    const resetButton = $('[data-admin-action="reset-field"]', panel);
    if (resetButton) resetButton.disabled = true;
    const finishReset = () => {
      resetInFlight = false;
      if (resetButton) resetButton.disabled = false;
    };

    if (mockAdminEnabled && !supabaseClient) {
      delete mockDraft[key];
      delete draftRows[key];
      saveMockDraft();
      restoreSelectedFromPublishedOrOriginal(key);
      renderInspector(selectedElement);
      updateTopbar();
      finishReset();
      return;
    }

    if (supabaseClient && currentUser && adminProfile && ['owner', 'editor'].includes(adminProfile.role)) {
      try {
        const { error } = await supabaseClient
          .from('cms_content')
          .delete()
          .eq('page_path', pagePath)
          .eq('edit_key', key)
          .eq('status', 'draft');
        if (error) {
          statusMessage = 'Reset failed. Check Supabase policies and schema.';
          renderInspector(selectedElement);
          updateTopbar();
          finishReset();
          return;
        }
        await insertAuditLog('reset_draft', key, draftRows[key]?.value_text || '', publishedRows[key]?.value_text || originalValues[key] || '');
      } catch (error) {
        statusMessage = 'Reset failed. Supabase connection failed.';
        renderInspector(selectedElement);
        updateTopbar();
        finishReset();
        return;
      }
    } else if (adminProfile && adminProfile.role === 'viewer') {
      statusMessage = 'Reset failed. Viewers can inspect but cannot delete drafts.';
      renderInspector(selectedElement);
      updateTopbar();
      finishReset();
      return;
    }
    delete draftRows[key];
    restoreSelectedFromPublishedOrOriginal(key);
    renderInspector(selectedElement);
    updateTopbar();
    finishReset();
  }

  function restoreSelectedFromPublishedOrOriginal(key) {
    const row = publishedRows[key];
    if (row && typeof row.value_text === 'string') setEditableValue(selectedElement, row.value_text);
    else setEditableValue(selectedElement, originalValues[key] || selectedElement.dataset.adminOriginalText || '');
  }

  async function loadPublishedEdits() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('cms_content')
        .select('page_path,page_id,edit_key,edit_type,section_id,section_type,value_text,value_json,status,version,updated_at')
        .eq('page_path', pagePath)
        .eq('status', 'published');
      if (error || !Array.isArray(data)) {
        publishedRowsLoadedCount = 0;
        if (error) markConnectionFailed();
        return;
      }
      publishedRows = indexRows(data);
      publishedRowsLoadedCount = data.length;
      data.forEach(applyRowToElement);
    } catch (error) {
      publishedRowsLoadedCount = 0;
      markConnectionFailed();
    }
  }

  async function loadDraftEdits() {
    if (mockAdminEnabled && !supabaseClient) {
      draftRows = {};
      Object.entries(mockDraft).forEach(([key, value]) => {
        const element = document.querySelector(`[data-edit-key="${cssEscape(key)}"]`);
        if (element) draftRows[key] = makeLocalDraftRow(element, value);
      });
      draftRowsLoadedCount = Object.keys(draftRows).length;
      return;
    }
    if (!supabaseClient || !currentUser || !adminProfile) return;
    try {
      const { data, error } = await supabaseClient
        .from('cms_content')
        .select('page_path,page_id,edit_key,edit_type,section_id,section_type,value_text,value_json,status,version,updated_at')
        .eq('page_path', pagePath)
        .eq('status', 'draft');
      if (error || !Array.isArray(data)) {
        draftRowsLoadedCount = 0;
        if (error) markConnectionFailed();
        return;
      }
      draftRows = indexRows(data);
      draftRowsLoadedCount = data.length;
    } catch (error) {
      draftRowsLoadedCount = 0;
      markConnectionFailed();
    }
  }

  function markConnectionFailed() {
    supabaseState.failed = true;
    supabaseState.ready = false;
    supabaseState.label = 'Supabase connection failed';
    supabaseState.warning = 'Supabase connection failed. Check the project URL, publishable key, and RLS policies.';
  }

  function logCmsDebug(context) {
    if (!cmsDebug) return;
    const registry = getRegistry();
    console.info('[GROWVA CMS Debug]', {
      context,
      page_path: pagePath,
      page_id: registry.pageId || 'unknown',
      editable_fields_count: registry.keys().length,
      supabase_configured: supabaseState.configured,
      unsafe_key_detected: supabaseState.unsafeKey,
      connection_status: getConnectionLabel(),
      current_role: adminProfile ? adminProfile.role : null,
      published_rows_loaded_count: publishedRowsLoadedCount,
      draft_rows_loaded_count: draftRowsLoadedCount,
      file_protocol: isLocalFileMode()
    });
  }

  function applyDraftRows() {
    Object.values(draftRows).forEach(applyRowToElement);
  }

  function indexRows(rows) {
    return rows.reduce((acc, row) => {
      if (row && row.edit_key) acc[row.edit_key] = row;
      return acc;
    }, {});
  }

  async function publishCurrentPage() {
    if (publishInFlight) return;
    publishInFlight = true;
    const publishButton = adminRoot ? $('[data-admin-action="publish-page"]', adminRoot) : null;
    if (publishButton) {
      publishButton.disabled = true;
      publishButton.textContent = 'Publishing...';
    }
    const finishPublish = () => {
      publishInFlight = false;
      if (publishButton) {
        publishButton.disabled = false;
        publishButton.textContent = 'Publish';
      }
    };
    if (mockAdminEnabled && !supabaseClient) {
      if (!window.confirm('Publish all draft changes for this page only?')) {
        finishPublish();
        return;
      }
      publishedRows = Object.assign({}, publishedRows, draftRows);
      statusMessage = `Published ${Object.keys(draftRows).length} mock changes.`;
      renderPanelEmpty();
      finishPublish();
      return;
    }
    if (!supabaseClient || !currentUser || !adminProfile) {
      statusMessage = 'Publish failed. Supabase admin access is required.';
      renderPanelEmpty();
      finishPublish();
      return;
    }
    if (adminProfile.role !== 'owner') {
      statusMessage = adminProfile.role === 'editor' ? 'Publish failed. Editors can save drafts, but only owners can publish.' : 'Publish failed. Only owners can publish.';
      renderPanelEmpty();
      finishPublish();
      return;
    }
    if (!window.confirm('Publish all draft changes for this page only?')) {
      finishPublish();
      return;
    }
    let drafts = null;
    let error = null;
    try {
      ({ data: drafts, error } = await supabaseClient
        .from('cms_content')
        .select('*')
        .eq('page_path', pagePath)
        .eq('status', 'draft'));
    } catch (caught) {
      error = caught;
    }
    if (error || !Array.isArray(drafts)) {
      statusMessage = 'Publish failed while loading drafts.';
      renderPanelEmpty();
      finishPublish();
      return;
    }
    if (!drafts.length) {
      statusMessage = 'No draft changes to publish.';
      renderPanelEmpty();
      finishPublish();
      return;
    }
    const publishedPayload = drafts.map(row => ({
      page_path: row.page_path,
      page_id: row.page_id,
      edit_key: row.edit_key,
      edit_type: row.edit_type,
      section_id: row.section_id,
      section_type: row.section_type,
      value_text: row.value_text,
      value_json: row.value_json,
      status: 'published',
      version: Number(row.version || 1) + 1,
      updated_by: currentUser.id,
      updated_at: new Date().toISOString()
    }));
    let published = null;
    let publishError = null;
    try {
      ({ data: published, error: publishError } = await supabaseClient
        .from('cms_content')
        .upsert(publishedPayload, { onConflict: 'page_path,edit_key,status' })
        .select());
    } catch (caught) {
      publishError = caught;
    }
    if (publishError) {
      statusMessage = 'Publish failed. Check owner role and RLS policies.';
      renderPanelEmpty();
      finishPublish();
      return;
    }
    try {
      await supabaseClient.from('cms_publish_log').insert({
        page_path: pagePath,
        published_by: currentUser.id,
        published_count: publishedPayload.length
      });
    } catch (error) {
      // Publishing succeeded; log write is best-effort and also protected by RLS.
    }
    publishedRows = indexRows(published || publishedPayload);
    publishedPayload.forEach(applyRowToElement);
    statusMessage = `Published ${publishedPayload.length} changes.`;
    updateTopbar();
    renderPanelEmpty();
    finishPublish();
  }

  async function insertAuditLog(action, key, oldValue, newValue) {
    if (!supabaseClient || !currentUser) return;
    try {
      await supabaseClient.from('cms_audit_log').insert({
        action,
        page_path: pagePath,
        edit_key: key,
        old_value: oldValue,
        new_value: newValue,
        user_id: currentUser.id
      });
    } catch (error) {
      // Audit logging is best-effort on the client; RLS remains the source of truth.
    }
  }

  function scrollToSection(sectionId) {
    const section = document.querySelector(`[data-section-id="${cssEscape(sectionId)}"]`);
    if (!section) return;
    if (window._lenis && typeof window._lenis.scrollTo === 'function') {
      window._lenis.scrollTo(section, { offset: -100 });
    } else {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function showHoverBadge(element) {
    if (!hoverBadge) return;
    const rect = element.getBoundingClientRect();
    hoverBadge.style.left = `${Math.min(window.innerWidth - 84, Math.max(8, rect.right))}px`;
    hoverBadge.style.top = `${Math.max(24, rect.top + rect.height / 2)}px`;
    hoverBadge.hidden = false;
  }

  function hideHoverBadge() {
    if (hoverBadge) hoverBadge.hidden = true;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function ensureEntryButtonsAreSafe() {
    $all('[data-admin-entry]').forEach(button => {
      button.type = 'button';
      button.dataset.adminAction = button.dataset.adminAction || 'open-admin';
    });
  }

  async function boot() {
    ensureEntryButtonsAreSafe();
    bindEntryEvents();
    captureOriginalValues();
    initSupabase();
    setupAuthStateListener();
    await loadPublishedEdits();
    logCmsDebug('boot');
    if (await hasActiveAdminSession()) ensureRoot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
