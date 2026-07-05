(function () {
  'use strict';

  const MOCK_SESSION_KEY = 'growva_admin_session';
  const MOCK_DRAFT_KEY = 'growva_admin_draft';
  const MOCK_CUSTOM_SECTIONS_KEY = 'growva_admin_custom_sections';
  const MOCK_EMAIL = 'admin@growva.local';
  const MOCK_PASSWORD = 'growva-admin';
  const PLACEHOLDER_URL = 'https://YOUR_PROJECT.supabase.co';
  const PLACEHOLDER_KEY = 'YOUR_SUPABASE_ANON_KEY';

  const params = new URLSearchParams(window.location.search);
  const mockAdminEnabled = params.get('mockAdmin') === 'true';
  const cmsDebug = params.get('cmsDebug') === 'true';
  const pagePath = getPagePath();

  const ALLOWED_STYLE_PROPS = new Set([
    'color','backgroundColor','fontSize','fontFamily','fontWeight',
    'lineHeight','letterSpacing','textAlign','marginTop','marginBottom',
    'marginLeft','marginRight','paddingTop','paddingBottom','paddingLeft','paddingRight',
    'borderColor','borderRadius','opacity','maxWidth'
  ]);
  const SAFE_FONTS = ['Inter','Fraunces','Arial','Georgia','system-ui','sans-serif','serif'];
  const SAFE_TEXT_ALIGNS = new Set(['left','center','right','justify']);
  const SAFE_FONT_WEIGHTS = new Set(['100','200','300','400','500','600','700','800','900','normal','bold']);
  const CUSTOM_SECTION_STYLE_PROPS = new Set([
    'backgroundColor','color','paddingTop','paddingBottom','marginTop','marginBottom',
    'maxWidth','textAlign','borderRadius','borderColor','cardBackground','cardRadius'
  ]);
  const CUSTOM_SECTION_IMAGE_POSITIONS = new Set(['left','right','top','bottom','background']);
  const CUSTOM_SECTION_IMAGE_TEMPLATES = new Set(['simple_text','cta','feature_cards','project_highlight','logo_strip']);
  const CUSTOM_SECTION_TEMPLATES = {
    simple_text: {
      label: 'Simple Text Section',
      sectionType: 'custom-simple-text',
      description: 'Eyebrow, headline, body, and one button.',
      defaults: { eyebrow: 'Studio note', heading: 'A focused section headline', body: 'Use this safe text section to add a concise page message.', buttonLabel: 'Learn More', buttonLink: 'about.html', image_asset_id: '', image_url: '', image_alt: '', image_position: 'right' }
    },
    cta: {
      label: 'CTA Section',
      sectionType: 'custom-cta',
      description: 'Conversion-focused call to action with two links.',
      defaults: { heading: 'Ready to build a sharper commerce system?', body: 'Tell us what you are launching, improving, or scaling next.', primaryLabel: 'Start a Project', primaryLink: 'contact.html', secondaryLabel: 'View Work', secondaryLink: 'work.html', image_asset_id: '', image_url: '', image_alt: '', overlay_strength: '0.45' }
    },
    feature_cards: {
      label: 'Feature Cards Section',
      sectionType: 'custom-feature-cards',
      description: 'Three compact cards for services, benefits, or pillars.',
      defaults: { eyebrow: 'Capabilities', heading: 'Built for brand and commerce momentum', cards: [{ title: 'Strategy', description: 'Clarify the offer and conversion path.', iconLabel: '01', image_asset_id: '', image_url: '', image_alt: '' }, { title: 'Design', description: 'Shape a premium visual system.', iconLabel: '02', image_asset_id: '', image_url: '', image_alt: '' }, { title: 'Growth', description: 'Improve the parts that move revenue.', iconLabel: '03', image_asset_id: '', image_url: '', image_alt: '' }] }
    },
    stats: {
      label: 'Stats Section',
      sectionType: 'custom-stats',
      description: 'A headline with measurable proof points.',
      defaults: { heading: 'Momentum you can measure', stats: [{ value: '35%', label: 'conversion lift' }, { value: '4wk', label: 'launch sprint' }, { value: '12+', label: 'systems optimized' }] }
    },
    faq: {
      label: 'FAQ Section',
      sectionType: 'custom-faq',
      description: 'Plain-text questions and answers.',
      defaults: { heading: 'Helpful answers', questions: [{ question: 'What can we edit here?', answer: 'Plain text only, stored as structured JSON.' }, { question: 'Can this include code?', answer: 'No. Phase 8 uses predefined safe templates only.' }] }
    },
    project_highlight: {
      label: 'Project Highlight Section',
      sectionType: 'custom-project-highlight',
      description: 'A compact work teaser with category and metric.',
      defaults: { eyebrow: 'Project highlight', heading: 'A refined commerce moment', description: 'Showcase one project outcome with a focused summary.', projectTitle: 'Noor Perfumery', category: 'Shopify / Brand', metric: '+28% add-to-cart rate', ctaLabel: 'View Project', ctaLink: 'work.html', image_asset_id: '', image_url: '', image_alt: '' }
    },
    logo_strip: {
      label: 'Logo / Partners Strip',
      sectionType: 'custom-logo-strip',
      description: 'A simple text-based partner or logo strip.',
      defaults: { heading: 'Trusted by focused brand teams', items: [{ label: 'Noor', image_asset_id: '', image_url: '', image_alt: '' }, { label: 'Vella', image_asset_id: '', image_url: '', image_alt: '' }, { label: 'Atelier', image_asset_id: '', image_url: '', image_alt: '' }, { label: 'Terra Grove', image_asset_id: '', image_url: '', image_alt: '' }] }
    }
  };

  let mode = 'preview';
  let selectedElement = null;
  let adminRoot = null;
  let modal = null;
  let panel = null;
  let dashboard = null;
  let publishDialog = null;
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
  let mockCustomSections = readMockCustomSections();
  let publishedRowsLoadedCount = 0;
  let draftRowsLoadedCount = 0;
  let saveInFlight = false;
  let publishInFlight = false;
  let resetInFlight = false;
  let adminEntryInFlight = false;
  let dashboardTab = 'overview';
  let dashboardDraftRows = [];
  let dashboardPublishedRows = [];
  let dashboardAuditRows = [];
  let dashboardPublishRows = [];
  let dashboardMessage = '';
  let lastHealthResult = 'Health check has not run yet.';
  let pendingPublishRows = [];
  let pendingCustomPublishRows = [];
  let pendingVisualPublishCount = 0;
  let inspectorDirty = false;
  let inspectorBaselineValue = '';
  let mediaAssets = [];
  let mediaUploadInFlight = false;
  let mediaSelectedAssetId = null;
  let mediaLibraryLoaded = false;
  let mediaLibraryMessage = '';
  let mediaLibrarySearch = '';
  let mediaShowArchived = false;
  let mediaSchemaSupportsManagement = false;
  let mediaSchemaWarning = '';
  let mediaAssetUsage = {};
  let mediaUsageLoaded = false;
  let mediaDetailAssetId = null;
  let editorSafeMode = true;
  let inspectorTab = 'content';
  let visualControlTab = 'tokens';
  let designTokenDrafts = {};
  let designTokenPublished = {};
  let sectionSettingsDrafts = {};
  let sectionSettingsPublished = {};
  let elementStyleDrafts = {};
  let elementStylesPublished = {};
  let unsavedVisualCount = 0;
  let sectionManagerExpanded = null;
  let globalTokenPublishPending = false;
  let customSectionDrafts = {};
  let customSectionPublished = {};
  let customSectionEditorId = null;
  let customMediaPicker = null;
  let customMediaPickerSearch = '';
  // Phase 13 state
  let visitorPreviewMode = false;
  let visitorPreviewType = 'published';
  let auditFilter = 'all';
  let draftCompareExpanded = null;

  // ── Phase 12: Role helpers ────────────────────────────────────────────────

  function getAdminRole() {
    if (adminProfile && adminProfile.role) return adminProfile.role;
    if (isMockAdminSession && isMockAdminSession()) return 'owner';
    return null;
  }

  function canAdminEdit() {
    const role = getAdminRole();
    return role === 'owner' || role === 'editor';
  }

  function canAdminPublish() {
    return getAdminRole() === 'owner';
  }

  function classifySupabaseError(error) {
    if (!error) return 'An unknown error occurred.';
    const raw = String(error.message || error.details || error.hint || error).toLowerCase();
    const code = String(error.code || '');
    if (code === 'PGRST301' || raw.includes('jwt expired') || raw.includes('session expired') || raw.includes('invalid claim')) {
      return 'Session expired. Please sign out and sign in again to continue.';
    }
    if (code === '42P01' || (raw.includes('relation') && raw.includes('does not exist'))) {
      return 'Database table missing. Ensure all SQL patches (schema.sql + Phase patches) have been applied in the Supabase SQL Editor.';
    }
    if (code === '42703' || (raw.includes('column') && raw.includes('does not exist'))) {
      return 'Database column missing. The Phase 11 SQL patch (phase-11-media-asset-management.sql) may not have been applied.';
    }
    if (code === '23505' || raw.includes('duplicate key') || raw.includes('unique constraint') || raw.includes('unique violation')) {
      return 'Duplicate record conflict. The record already exists with this key — try refreshing and retrying.';
    }
    if (raw.includes('row-level security') || raw.includes('violates row') || raw.includes('permission denied') || raw.includes('rls')) {
      return 'Permission denied by the database RLS policy. Check your role in admin_profiles and that the correct SQL patches have been applied.';
    }
    if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('network request') || raw.includes('timeout') || raw.includes('fetch error')) {
      return 'Network error. Check your internet connection and try again. Supabase may also be momentarily unavailable.';
    }
    if (raw.includes('invalid api key') || raw.includes('unauthorized') || (raw.includes('jwt') && !raw.includes('expired'))) {
      return 'Authentication error. Your Supabase anon key may be invalid. Check supabase-config.js.';
    }
    if (raw.includes('no rows') || raw.includes('pgrst116')) {
      return 'No data returned. The record may have been deleted or RLS is preventing access.';
    }
    return 'Operation failed. Add ?cmsDebug=true to the URL for technical details.';
  }

  function getAuthErrorText(error) {
    if (!error) return '';
    return [
      error.name,
      error.message,
      error.error,
      error.error_description,
      error.details,
      error.hint,
      error.code,
      error.status
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function isRevokedOrInvalidAuthSessionError(error) {
    const raw = getAuthErrorText(error);
    if (!raw) return false;
    if (raw.includes('authapierror')) return true;
    if (raw.includes('refresh token') && (raw.includes('revoked') || raw.includes('invalid') || raw.includes('not found') || raw.includes('already used'))) return true;
    if (raw.includes('invalid refresh token') || raw.includes('refresh token revoked')) return true;
    if (raw.includes('invalid_grant') || raw.includes('auth session missing') || raw.includes('session missing')) return true;
    if ((raw.includes('jwt') || raw.includes('session')) && (raw.includes('expired') || raw.includes('invalid') || raw.includes('refresh'))) return true;
    return false;
  }

  function clearSupabaseAuthStorage() {
    [window.localStorage, window.sessionStorage].forEach(storage => {
      if (!storage) return;
      try {
        Object.keys(storage)
          .filter(key => key.includes('supabase') || key.startsWith('sb-'))
          .forEach(key => storage.removeItem(key));
      } catch (error) {
        logCmsDebug('supabase-auth-storage-clear-failed');
      }
    });
  }

  function resetAdminAuthState(label = 'Logged out') {
    currentUser = null;
    adminProfile = null;
    if (supabaseClient && supabaseState.configured && !supabaseState.unsafeKey) {
      supabaseState.failed = false;
      supabaseState.ready = true;
    }
    supabaseState.label = label;
    if (adminRoot) updateTopbar();
  }

  function handleAdminAuthSessionFailure(error, context = 'auth-session-check') {
    if (isRevokedOrInvalidAuthSessionError(error)) clearSupabaseAuthStorage();
    resetAdminAuthState('Logged out');
    if (cmsDebug) {
      console.info('[GROWVA CMS Auth]', {
        context,
        treated_as_logged_out: true,
        stale_auth_storage_cleared: isRevokedOrInvalidAuthSessionError(error),
        error_name: error?.name || null,
        error_message: error?.message || String(error || '')
      });
    }
    return false;
  }

  function getRoleAccessBanner(context) {
    const role = getAdminRole();
    if (!role) return '';
    if (role === 'viewer') {
      return `<div class="gv-admin-role-banner gv-admin-role-banner--viewer" role="status">Viewer access: editing is disabled. You can inspect drafts and published content but cannot make changes.</div>`;
    }
    if (role === 'editor' && (context === 'publish' || context === 'visual' || context === 'global-publish')) {
      const msg = context === 'global-publish'
        ? 'Editor access: global token publishing requires owner approval.'
        : context === 'publish'
          ? 'Editor access: you can prepare drafts, but publishing requires owner approval.'
          : 'Editor access: save drafts freely. Publishing visual changes requires owner approval.';
      return `<div class="gv-admin-role-banner gv-admin-role-banner--editor" role="status">${escapeHtml(msg)}</div>`;
    }
    return '';
  }

  // ── DOM utilities ─────────────────────────────────────────────────────────

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
        global: {
          fetch: (input, init = {}) => {
            const method = String(init.method || (input && input.method) || 'GET').toUpperCase();
            return fetch(input, Object.assign({}, init, { cache: method === 'GET' || method === 'HEAD' ? 'no-store' : init.cache }));
          }
        },
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
        resetAdminAuthState('Logged out');
        if (document.body.classList.contains('admin-mode')) exitAdminMode();
        updateTopbar();
        return;
      }
      if (session.user) {
        await loadAdminProfile(session.user).catch(error => handleAdminAuthSessionFailure(error, 'auth-state-profile-check'));
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

  function readMockCustomSections() {
    try {
      return JSON.parse(localStorage.getItem(MOCK_CUSTOM_SECTIONS_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function saveMockCustomSections() {
    localStorage.setItem(MOCK_CUSTOM_SECTIONS_KEY, JSON.stringify(mockCustomSections));
  }

  function isMockAdminSession() {
    return mockAdminEnabled && localStorage.getItem(MOCK_SESSION_KEY) === 'true';
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

  function refreshContentRegistry() {
    const fields = {};
    const duplicateKeys = [];
    $all('[data-edit-key]').forEach(element => {
      const key = element.dataset.editKey;
      if (!key) return;
      if (fields[key]) duplicateKeys.push(key);
      else fields[key] = element;
    });
    window.GROWVA_CONTENT_REGISTRY = {
      pageId: document.body.dataset.pageId || document.querySelector('[data-page-id]')?.dataset.pageId || 'unknown',
      fields,
      duplicateKeys,
      sections: $all('[data-section-type]').filter(section => !section.closest('[data-admin-ui]')),
      get(key) {
        return fields[key] || null;
      },
      keys() {
        return Object.keys(fields);
      }
    };
    captureOriginalValues();
    return window.GROWVA_CONTENT_REGISTRY;
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
    if (adminRoot && document.body.contains(adminRoot)) return adminRoot;
    adminRoot = document.createElement('div');
    adminRoot.className = 'gv-admin-root gv-admin-shell';
    adminRoot.dataset.adminUi = 'true';
    adminRoot.dataset.adminShell = 'true';
    adminRoot.setAttribute('data-lenis-prevent', '');
    document.body.appendChild(adminRoot);
    buildModal();
    buildTopbar();
    buildPanel();
    buildDashboard();
    buildPublishDialog();
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
        <span class="sr-only" aria-live="polite" aria-atomic="true" data-admin-live-status></span>
        <button class="gv-admin-action" type="button" data-admin-action="toggle-safe-mode" data-admin-safe-mode-btn>Safe Mode: ON</button>
        <button class="gv-admin-action" type="button" data-admin-action="enter-visitor-preview">Preview as Visitor</button>
        <button class="gv-admin-action" type="button" data-admin-action="open-dashboard">CMS Dashboard</button>
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
    panel.dataset.adminPanel = 'true';
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

  function buildDashboard() {
    dashboard = document.createElement('section');
    dashboard.className = 'gv-admin-dashboard';
    dashboard.dataset.adminUi = 'true';
    dashboard.setAttribute('data-lenis-prevent', '');
    dashboard.setAttribute('role', 'dialog');
    dashboard.setAttribute('aria-modal', 'true');
    dashboard.setAttribute('aria-labelledby', 'gvDashboardTitle');
    dashboard.hidden = true;
    dashboard.innerHTML = `
      <div class="gv-admin-dashboard-shell">
        <div class="gv-admin-dashboard-head">
          <div>
            <span class="gv-admin-pill">CMS Dashboard</span>
            <h2 id="gvDashboardTitle">Content Control Room</h2>
            <p>Manage this page's drafts, published overrides, audit history, role access, and system health.</p>
          </div>
          <button class="gv-admin-close" type="button" aria-label="Close dashboard" data-admin-action="close-dashboard">x</button>
        </div>
        <div class="gv-admin-dashboard-tabs" role="tablist" data-dashboard-tabs></div>
        <div class="gv-admin-dashboard-body" data-dashboard-body></div>
      </div>
    `;
    adminRoot.appendChild(dashboard);
  }

  function buildPublishDialog() {
    publishDialog = document.createElement('div');
    publishDialog.className = 'gv-admin-confirm';
    publishDialog.dataset.adminUi = 'true';
    publishDialog.setAttribute('role', 'dialog');
    publishDialog.setAttribute('aria-modal', 'true');
    publishDialog.setAttribute('aria-labelledby', 'gvPublishDialogTitle');
    publishDialog.hidden = true;
    publishDialog.innerHTML = `
      <div class="gv-admin-confirm-card">
        <div class="gv-admin-dashboard-head">
          <div>
            <span class="gv-admin-pill">Publish Current Page</span>
            <h2 id="gvPublishDialogTitle">Review draft changes</h2>
            <p>This publishes current page only.</p>
          </div>
          <button class="gv-admin-close" type="button" aria-label="Cancel publish" data-admin-action="cancel-publish">x</button>
        </div>
        <div data-publish-confirm-body></div>
        <div class="gv-admin-confirm-actions">
          <button class="gv-admin-action" type="button" data-admin-action="cancel-publish">Cancel</button>
          <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="confirm-publish-page">Publish Current Page</button>
        </div>
      </div>
    `;
    adminRoot.appendChild(publishDialog);
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
        if (publishDialog && !publishDialog.hidden) closePublishDialog();
        else if (dashboard && !dashboard.hidden) closeDashboard();
        else if (modal && modal.classList.contains('is-open')) closeModal();
        else if (selectedElement) clearSelection();
      }
      // Phase 14: Visual Designer Engine undo/redo
      if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        if (!document.body.classList.contains('admin-edit-mode')) return;
        event.preventDefault();
        vdHistoryUndo();
      }
      if (event.ctrlKey && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        if (!document.body.classList.contains('admin-edit-mode')) return;
        event.preventDefault();
        vdHistoryRedo();
      }
    });
  }

  function bindEntryEvents() {
    if (entryEventsBound) return;
    entryEventsBound = true;

    document.addEventListener('click', event => {
      const entry = event.target.closest('[data-admin-action="open-admin"], [data-admin-entry]');
      if (!entry) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      openAdminEntry(entry, event);
    }, true);

    document.addEventListener('keydown', event => {
      const target = event.target;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (typing) return;
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        openAdminEntry(null, event);
      }
    });
  }

  async function openAdminEntry(trigger, sourceEvent) {
    if (adminEntryInFlight) {
      logAdminEntryDebug('admin-entry-click-ignored', trigger, 'already-opening', sourceEvent);
      return;
    }
    adminEntryInFlight = true;
    setAdminEntryLoading(trigger, true);
    closePublicMobileNav();
    ensureRoot();
    logAdminEntryDebug('admin-entry-click', trigger, 'checking-session', sourceEvent);
    try {
      const hasSession = currentUser && adminProfile
        ? true
        : await withTimeout(hasActiveAdminSession(), 2500, false);
      if (hasSession) {
        await enterAdminMode();
        logAdminEntryDebug('admin-entry-action', trigger, 'enter-admin', sourceEvent);
      } else {
        openModal();
        logAdminEntryDebug('admin-entry-action', trigger, 'login-modal', sourceEvent);
      }
    } catch (error) {
      openModal();
      logAdminEntryDebug('admin-entry-action', trigger, 'fallback-login-modal', sourceEvent, { error: error?.message || String(error || '') });
    } finally {
      setAdminEntryLoading(trigger, false);
      clearAdminEntryLoadingState();
      adminEntryInFlight = false;
    }
  }

  function setAdminEntryLoading(trigger, active) {
    if (!trigger) return;
    trigger.classList.toggle('is-admin-loading', Boolean(active));
    if (active) trigger.setAttribute('aria-busy', 'true');
    else trigger.removeAttribute('aria-busy');
  }

  function clearAdminEntryLoadingState() {
    $all('[data-admin-entry], [data-admin-action="open-admin"]').forEach(trigger => {
      trigger.classList.remove('is-admin-loading');
      trigger.removeAttribute('aria-busy');
    });
  }

  function withTimeout(promise, timeoutMs, fallbackValue) {
    let timer = null;
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  function closePublicMobileNav() {
    const mobileNav = document.getElementById('navMobile');
    const burger = document.getElementById('navBurger');
    if (mobileNav) {
      mobileNav.classList.remove('open');
      mobileNav.querySelectorAll('.mobile-mega.open').forEach(item => {
        item.classList.remove('open');
        const toggle = item.querySelector('.mobile-mega-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }
    if (burger) burger.setAttribute('aria-expanded', 'false');
  }

  function logAdminEntryDebug(context, trigger, actionTaken, sourceEvent, extra = {}) {
    if (!cmsDebug) return;
    console.info('[GROWVA CMS Admin Entry]', {
      context,
      trigger_found: Boolean(trigger),
      target_tag: sourceEvent?.target?.tagName || null,
      trigger_tag: trigger?.tagName || null,
      trigger_entry: trigger?.dataset?.adminEntry || null,
      current_auth_state: currentUser ? 'authenticated' : 'unknown-or-logged-out',
      supabase_configured: supabaseState.configured,
      unsafe_key: supabaseState.unsafeKey,
      action_taken: actionTaken,
      public_transition_prevented: true,
      admin_mode: document.body.classList.contains('admin-mode'),
      ...extra
    });
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
      if (isRevokedOrInvalidAuthSessionError(error)) return handleAdminAuthSessionFailure(error, 'get-session');
      markConnectionFailed();
      return false;
    }
    if (sessionResult && sessionResult.error) {
      if (isRevokedOrInvalidAuthSessionError(sessionResult.error)) return handleAdminAuthSessionFailure(sessionResult.error, 'get-session-result');
      markConnectionFailed();
      return false;
    }
    let session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
    for (let attempt = 0; !session && attempt < 6; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
      try {
        sessionResult = await supabaseClient.auth.getSession();
        session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
      } catch (error) {
        if (isRevokedOrInvalidAuthSessionError(error)) return handleAdminAuthSessionFailure(error, 'get-session-retry');
        markConnectionFailed();
        return false;
      }
      if (sessionResult && sessionResult.error) {
        if (isRevokedOrInvalidAuthSessionError(sessionResult.error)) return handleAdminAuthSessionFailure(sessionResult.error, 'get-session-retry-result');
        markConnectionFailed();
        return false;
      }
    }
    if (!session || !session.user) {
      resetAdminAuthState('Logged out');
      return false;
    }
    try {
      return await loadAdminProfile(session.user);
    } catch (error) {
      if (isRevokedOrInvalidAuthSessionError(error)) return handleAdminAuthSessionFailure(error, 'profile-session-check');
      markConnectionFailed();
      return false;
    }
  }

  async function loadAdminProfile(user) {
    if (!supabaseClient || !user) return false;
    let data = null;
    let error = null;
    try {
      ({ data, error } = await supabaseClient
        .from('admin_profiles')
        .select('id,email,role')
        .eq('id', user.id)
        .maybeSingle());
    } catch (profileError) {
      if (isRevokedOrInvalidAuthSessionError(profileError)) return handleAdminAuthSessionFailure(profileError, 'profile-query');
      throw profileError;
    }
    if (error && isRevokedOrInvalidAuthSessionError(error)) return handleAdminAuthSessionFailure(error, 'profile-query-result');
    if (error || !data || !['owner', 'editor', 'viewer'].includes(data.role)) {
      resetAdminAuthState('Logged out');
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

  async function openDashboard() {
    if (!adminProfile && !mockAdminEnabled) return;
    ensureRoot();
    dashboard.hidden = false;
    document.body.classList.add('admin-dashboard-open');
    dashboardMessage = 'Loading dashboard...';
    renderDashboard();
    await refreshDashboardData();
    dashboardMessage = '';
    renderDashboard();
    setTimeout(bindMediaUploadAreaEvents, 0);
    if (dashboardTab === 'media') setTimeout(bindMediaLibraryEvents, 0);
    if (dashboardTab === 'visual') setTimeout(bindVisualControlEvents, 0);
    if (dashboardTab === 'sections') setTimeout(bindSectionManagerEvents, 0);
    if (dashboardTab === 'builder') setTimeout(bindSectionBuilderEvents, 0);
    logCmsDebug('dashboard-opened');
  }

  function closeDashboard() {
    if (!dashboard) return;
    dashboard.hidden = true;
    document.body.classList.remove('admin-dashboard-open');
  }

  function switchDashboardTab(tab) {
    dashboardTab = tab || 'overview';
    renderDashboard();
    if (dashboardTab === 'media') {
      setTimeout(bindMediaUploadAreaEvents, 0);
      setTimeout(bindMediaLibraryEvents, 0);
    }
    if (dashboardTab === 'visual') setTimeout(bindVisualControlEvents, 0);
    if (dashboardTab === 'sections') setTimeout(bindSectionManagerEvents, 0);
    if (dashboardTab === 'builder') setTimeout(bindSectionBuilderEvents, 0);
    // Phase 19/21/26/27: load leads, notifications, activity, and tasks on CRM tabs
    if (dashboardTab === 'leads' && leadsData.length === 0 && !leadsLoading) {
      Promise.all([loadLeads(), loadNotificationLogs(), loadLeadActivities(), loadLeadTasks()]).then(() => renderDashboard());
    }
    if (dashboardTab === 'leads' && leadsData.length && !leadActivitiesLoading && !leadActivities.length && !leadActivitiesUnavailable) {
      loadLeadActivities().then(() => renderDashboard());
    }
    if (dashboardTab === 'leads' && leadsData.length && !leadTasksLoading && !leadTasks.length && !leadTasksUnavailable) {
      loadLeadTasks().then(() => renderDashboard());
    }
    if (dashboardTab === 'pipeline' && leadsData.length === 0 && !leadsLoading) {
      Promise.all([loadLeads(), loadLeadActivities(), loadLeadTasks()]).then(() => renderDashboard());
    }
    if (dashboardTab === 'pipeline' && leadsData.length && !leadActivitiesLoading && !leadActivities.length && !leadActivitiesUnavailable) {
      loadLeadActivities().then(() => renderDashboard());
    }
    if (dashboardTab === 'pipeline' && leadsData.length && !leadTasksLoading && !leadTasks.length && !leadTasksUnavailable) {
      loadLeadTasks().then(() => renderDashboard());
    }
    if (dashboardTab === 'tasks' && leadsData.length === 0 && !leadsLoading) {
      Promise.all([loadLeads(), loadLeadTasks(), loadLeadActivities()]).then(() => renderDashboard());
    }
    if (dashboardTab === 'tasks' && leadsData.length && !leadTasksLoading && !leadTasks.length && !leadTasksUnavailable) {
      loadLeadTasks().then(() => renderDashboard());
    }
    if (dashboardTab === 'lead-insights' && leadsData.length === 0 && !leadsLoading) {
      loadLeads().then(() => renderDashboard());
    }
    if (dashboardTab === 'notifications' && !notificationLogsLoading) {
      loadNotificationLogs().then(() => renderDashboard());
    }
  }

  async function refreshDashboardData() {
    await loadDraftEdits();
    await loadPublishedEdits();
    dashboardDraftRows = Object.values(draftRows);
    dashboardPublishedRows = Object.values(publishedRows);
    dashboardAuditRows = await loadAuditRows();
    dashboardPublishRows = await loadPublishRows();
    await loadMediaAssets();
    await loadDesignTokens();
    await loadSectionSettings();
    await loadElementStyles();
    await loadCustomSections();
    logCmsDebug('dashboard-data-loaded');
  }

  async function loadAuditRows() {
    if (mockAdminEnabled && !supabaseClient) return [];
    if (!supabaseClient || !currentUser || !adminProfile) return [];
    try {
      const { data, error } = await supabaseClient
        .from('cms_audit_log')
        .select('action,page_path,edit_key,old_value,new_value,user_id,created_at')
        .eq('page_path', pagePath)
        .lt('created_at', cmsFreshReadCutoff());
      if (error || !Array.isArray(data)) return [];
      return data.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 30);
    } catch (error) {
      return [];
    }
  }

  async function loadPublishRows() {
    if (mockAdminEnabled && !supabaseClient) return [];
    if (!supabaseClient || !currentUser || !adminProfile) return [];
    try {
      const { data, error } = await supabaseClient
        .from('cms_publish_log')
        .select('page_path,published_by,published_count,created_at')
        .eq('page_path', pagePath)
        .lt('created_at', cmsFreshReadCutoff());
      if (error || !Array.isArray(data)) return [];
      return data.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  function renderDashboard() {
    if (!dashboard || dashboard.hidden) return;
    const tabs = [
      ['overview', 'Overview'],
      ['compare', 'Draft Compare'],
      ['drafts', 'Current Page Drafts'],
      ['published', 'Published Content'],
      ['audit', 'Revision / Audit Log'],
      ['session', 'Role & Session'],
      ['health', 'System Health'],
      ['media', 'Media Library'],
      ['visual', 'Visual Control'],
      ['sections', 'Section Manager'],
      ['builder', 'Section Builder'],
      ['leads', 'Leads'],
      ['pipeline', 'Pipeline'],
      ['tasks', 'Tasks'],
      ['lead-insights', 'Lead Insights'],
      ['notifications', 'Notifications'],
    ];
    $('[data-dashboard-tabs]', dashboard).innerHTML = tabs.map(([id, label]) => `
      <button type="button" role="tab" aria-selected="${dashboardTab === id ? 'true' : 'false'}" class="${dashboardTab === id ? 'is-active' : ''}" data-admin-action="dashboard-tab" data-dashboard-tab="${id}">${escapeHtml(label)}</button>
    `).join('');
    $('[data-dashboard-body]', dashboard).innerHTML = `
      ${dashboardMessage ? `<div class="gv-admin-dashboard-message">${escapeHtml(dashboardMessage)}</div>` : ''}
      ${renderDashboardTab()}
    `;
  }

  function renderDashboardTab() {
    if (dashboardTab === 'compare') return renderDraftCompareTab();
    if (dashboardTab === 'drafts') return renderDraftRows();
    if (dashboardTab === 'published') return renderPublishedRows();
    if (dashboardTab === 'audit') return renderAuditRows();
    if (dashboardTab === 'session') return renderSessionTab();
    if (dashboardTab === 'health') return renderHealthTab();
    if (dashboardTab === 'media') return renderMediaLibraryTab();
    if (dashboardTab === 'visual') return renderVisualControlTab();
    if (dashboardTab === 'sections') return renderSectionManagerTab();
    if (dashboardTab === 'builder') return renderSectionBuilderTab();
    if (dashboardTab === 'leads') return renderLeadsTab();
    if (dashboardTab === 'pipeline') return renderPipelineTab();
    if (dashboardTab === 'tasks') return renderTasksTab();
    if (dashboardTab === 'lead-insights') return renderLeadInsightsTab();
    if (dashboardTab === 'notifications') return renderNotificationsTab();
    return renderOverviewTab();
  }

  function renderOverviewTab() {
    const registry = getRegistry();
    const lastPublish = dashboardPublishRows[0]?.created_at || 'No publish log yet';
    const staleCount = getStaleDraftCount();
    const taskSummary = leadTasks.length ? getTaskSummary(leadTasks) : null;
    return `
      <div class="gv-admin-dashboard-grid">
        ${renderMetricCard('Page path', pagePath)}
        ${renderMetricCard('Role', adminProfile?.role || (mockAdminEnabled ? 'owner' : 'logged out'))}
        ${renderMetricCard('Editable fields', registry.keys().length)}
        ${renderMetricCard('Drafts on page', dashboardDraftRows.length)}
        ${renderMetricCard('Published overrides', dashboardPublishedRows.length)}
        ${renderMetricCard('Custom sections', Object.keys(customSectionPublished).length + Object.keys(customSectionDrafts).length)}
        ${renderMetricCard('Last publish', formatDate(lastPublish))}
        ${renderMetricCard('Supabase', getConnectionLabel())}
        ${renderMetricCard('Unsafe key', supabaseState.unsafeKey ? 'Yes' : 'No')}
        ${renderMetricCard('Leads (new)', leadsData.filter(l => l.status === 'new' && !l.is_archived).length)}
        ${renderMetricCard('Leads last 7 days', leadsData.length ? getLeadInsights().last7 : '-')}
        ${renderMetricCard('Top source', leadsData.length ? getLeadInsights().topSource : '-')}
        ${renderMetricCard('Notification health', notificationLogs.length ? getNotificationAnalytics().healthLabel : '—')}
        ${renderMetricCard('Failed notifications', notificationLogs.length ? getNotificationAnalytics().problemTotal : '—')}
        ${renderMetricCard('Overdue tasks', taskSummary ? taskSummary.overdue : '-')}
        ${renderMetricCard('Tasks due today', taskSummary ? taskSummary.today : '-')}
      </div>
      ${staleCount > 0 ? `<div class="gv-admin-stale-warning">⚠ ${staleCount} draft(s) are older than 7 days. Review carefully before publishing. <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="dashboard-tab" data-dashboard-tab="compare">View Draft Compare</button></div>` : ''}
      ${isLocalFileMode() ? '<div class="gv-admin-warning">For best CMS behavior, use Live Server or a deployed URL.</div>' : ''}
    `;
  }

  function renderMetricCard(label, value) {
    return `
      <div class="gv-admin-metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderDraftRows() {
    if (!dashboardDraftRows.length) return '<p class="gv-admin-empty">No draft changes for this page.</p>';
    return `
      <div class="gv-admin-row-list">
        ${dashboardDraftRows.map(row => renderContentRow(row, 'draft')).join('')}
      </div>
    `;
  }

  function renderPublishedRows() {
    if (!dashboardPublishedRows.length) return '<p class="gv-admin-empty">No published overrides for this page.</p>';
    return `
      <div class="gv-admin-row-list">
        ${dashboardPublishedRows.map(row => renderContentRow(row, 'published')).join('')}
      </div>
    `;
  }

  function renderContentRow(row, status) {
    const value = row.value_text || '';
    const key = row.edit_key || '';
    const isDraft = status === 'draft';
    const isImage = row.edit_type === 'image' || row.edit_type === 'background-image';
    const imgVal = isImage ? getImageValueFromRow(row) : null;
    const thumbUrl = (imgVal && imgVal.url) ? imgVal.url : (isImage ? value : '');
    const thumbHtml = isImage && thumbUrl && isSafeImageUrl(thumbUrl)
      ? `<img class="gv-admin-row-thumb-img" src="${escapeHtml(thumbUrl)}" alt="" loading="lazy">`
      : '';
    return `
      <article class="gv-admin-content-row">
        <div>
          ${thumbHtml}
          <strong>${escapeHtml(key)}</strong>
          <span>${escapeHtml(row.section_id || 'No section')} / ${escapeHtml(row.edit_type || 'text')} / ${escapeHtml(formatDate(row.updated_at || ''))}</span>
          <p>${escapeHtml(isImage ? (thumbUrl.slice(0, 120) || 'No URL') : value.slice(0, 180) || 'Empty value')}</p>
        </div>
        <div class="gv-admin-row-actions">
          <button class="gv-admin-action" type="button" data-admin-action="dashboard-focus" data-edit-key="${escapeHtml(key)}">Focus</button>
          ${isDraft ? `<button class="gv-admin-action" type="button" data-admin-action="dashboard-apply-draft" data-edit-key="${escapeHtml(key)}">Apply</button>` : ''}
          ${isDraft ? `<button class="gv-admin-action" type="button" data-admin-action="dashboard-open-inspector" data-edit-key="${escapeHtml(key)}">Inspector</button>` : ''}
          ${isDraft ? `<button class="gv-admin-action" type="button" data-admin-action="dashboard-delete-draft" data-edit-key="${escapeHtml(key)}">Delete Draft</button>` : ''}
          ${!isDraft ? `<button class="gv-admin-action" type="button" data-admin-action="dashboard-compare" data-edit-key="${escapeHtml(key)}">Compare</button>` : ''}
          ${!isDraft ? `<button class="gv-admin-action" type="button" data-admin-action="dashboard-copy" data-row-status="published" data-edit-key="${escapeHtml(key)}">Copy</button>` : ''}
        </div>
      </article>
    `;
  }

  function renderAuditRows() {
    const filters = ['all', 'page', 'content', 'media', 'visual', 'builder', 'publish'];
    const actionGroupMap = {
      page: ['page-load', 'enter-admin-mode', 'exit-admin-mode'],
      content: ['save-draft', 'reset-draft', 'undo-draft'],
      media: ['upload-media', 'update-media', 'archive-media', 'delete-media'],
      visual: ['save-token-draft', 'publish-visuals', 'save-element-style-draft', 'save-section-draft'],
      builder: ['add-section', 'edit-section', 'delete-section', 'duplicate-section', 'save-section'],
      publish: ['publish', 'publish-page'],
    };
    const filterBtns = filters.map(f => `
      <button class="gv-admin-audit-filter-btn${auditFilter === f ? ' is-active' : ''}" type="button" data-admin-action="audit-filter" data-filter="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</button>
    `).join('');
    let rows = dashboardAuditRows;
    if (auditFilter !== 'all') {
      const group = actionGroupMap[auditFilter] || [];
      rows = rows.filter(row => {
        const action = (row.action || '').toLowerCase();
        return group.some(g => action.includes(g));
      });
    }
    const rowsHtml = rows.length
      ? rows.map(row => {
          const actionLabel = (row.action || 'audit').replace(/-/g, ' ');
          const badgeClass = (row.action || '').includes('publish') ? 'gv-admin-badge--ok'
            : (row.action || '').includes('delete') || (row.action || '').includes('archive') ? 'gv-admin-badge--danger'
            : 'gv-admin-badge';
          return `
            <article class="gv-admin-content-row">
              <div>
                <strong><span class="${badgeClass}">${escapeHtml(actionLabel)}</span> ${escapeHtml(row.edit_key || 'page')}</strong>
                <span>${escapeHtml(formatDate(row.created_at || ''))}</span>
                ${row.old_value ? `<p><b>Old:</b> ${escapeHtml((row.old_value || '').slice(0, 90))}</p>` : ''}
                ${row.new_value ? `<p><b>New:</b> ${escapeHtml((row.new_value || '').slice(0, 120))}</p>` : ''}
                <small>${escapeHtml(row.email || row.user_id || 'unknown user')}</small>
              </div>
            </article>
          `;
        }).join('')
      : `<p class="gv-admin-empty">No audit entries match this filter.</p>`;
    if (!dashboardAuditRows.length) return '<p class="gv-admin-empty">No audit history yet.</p>';
    return `
      <div class="gv-admin-audit-filters">${filterBtns}</div>
      <div class="gv-admin-row-list">${rowsHtml}</div>
    `;
  }

  function renderSessionTab() {
    const role = adminProfile?.role || (mockAdminEnabled ? 'owner' : 'logged out');
    const roleMatrix = [
      { action: 'View dashboard / drafts / published', viewer: true, editor: true, owner: true },
      { action: 'Inspect element metadata', viewer: true, editor: true, owner: true },
      { action: 'Save text / content drafts', viewer: false, editor: true, owner: true },
      { action: 'Save image drafts', viewer: false, editor: true, owner: true },
      { action: 'Save element style drafts', viewer: false, editor: true, owner: true },
      { action: 'Save section style drafts', viewer: false, editor: true, owner: true },
      { action: 'Save visual control (token) drafts', viewer: false, editor: true, owner: true },
      { action: 'Reset drafts', viewer: false, editor: true, owner: true },
      { action: 'Reorder / hide sections (draft)', viewer: false, editor: true, owner: true },
      { action: 'Add / edit Section Builder sections (draft)', viewer: false, editor: true, owner: true },
      { action: 'Upload to Media Library', viewer: false, editor: true, owner: true },
      { action: 'Edit media metadata (alt, caption)', viewer: false, editor: true, owner: true },
      { action: 'Publish current page', viewer: false, editor: false, owner: true },
      { action: 'Publish visual tokens (global)', viewer: false, editor: false, owner: true },
      { action: 'Archive media assets', viewer: false, editor: false, owner: true },
      { action: 'Delete media assets', viewer: false, editor: false, owner: true },
    ];
    const tick = (v) => v
      ? '<span class="gv-admin-perm-yes" aria-label="allowed">✓</span>'
      : '<span class="gv-admin-perm-no" aria-label="denied">✗</span>';
    const roleClass = { owner: 'gv-admin-badge--ok', editor: 'gv-admin-badge--editor', viewer: 'gv-admin-badge--viewer' }[role] || '';
    return `
      <div class="gv-admin-dashboard-grid">
        ${renderMetricCard('Email', currentUser?.email || adminProfile?.email || (mockAdminEnabled ? MOCK_EMAIL : 'Logged out'))}
        ${renderMetricCard('User ID', (currentUser?.id || adminProfile?.id || 'None').slice(0, 18) + '…')}
        ${renderMetricCard('Role', role)}
        ${renderMetricCard('Security', 'RLS is authoritative')}
      </div>
      <div class="gv-admin-role-banner gv-admin-role-banner--${role}" role="status" style="margin-bottom:12px">
        ${{
          owner: 'Owner: full edit, draft, and publish access.',
          editor: 'Editor access: you can prepare drafts, but publishing requires owner approval.',
          viewer: 'Viewer access: editing is disabled. You can inspect drafts and published content.'
        }[role] || 'Sign in to view permissions.'}
      </div>
      <div class="gv-admin-role-matrix">
        <table>
          <thead>
            <tr><th>Action</th><th>Viewer</th><th>Editor</th><th>Owner</th></tr>
          </thead>
          <tbody>
            ${roleMatrix.map(r => `
              <tr class="${role === 'owner' && r.owner ? 'is-allowed' : role === 'editor' && r.editor ? 'is-allowed' : role === 'viewer' && r.viewer ? 'is-allowed' : 'is-denied'}">
                <td>${escapeHtml(r.action)}</td>
                <td>${tick(r.viewer)}</td>
                <td>${tick(r.editor)}</td>
                <td>${tick(r.owner)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p class="gv-admin-note" style="margin-top:10px">RLS policies in Supabase are the authoritative security gate. UI role checks are for clarity only.</p>
    `;
  }

  function renderHealthTab() {
    const registry = getRegistry();
    return `
      <div class="gv-admin-dashboard-grid">
        ${renderMetricCard('Supabase configured', supabaseState.configured ? 'Yes' : 'No')}
        ${renderMetricCard('Unsafe key detected', supabaseState.unsafeKey ? 'Yes' : 'No')}
        ${renderMetricCard('Current page path', pagePath)}
        ${renderMetricCard('Registry available', window.GROWVA_CONTENT_REGISTRY ? 'Yes' : 'No')}
        ${renderMetricCard('Editable fields', registry.keys().length)}
        ${renderMetricCard('Sections', registry.sections.length)}
        ${renderMetricCard('Published loaded', publishedRowsLoadedCount)}
        ${renderMetricCard('Drafts loaded', draftRowsLoadedCount)}
      </div>
      <div class="gv-admin-dashboard-message">${escapeHtml(lastHealthResult)}</div>
      <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="run-health-check">Run CMS Health Check</button>
    `;
  }

  function leadAttr(lead, key) {
    if (!lead) return '';
    if (lead[key]) return String(lead[key]);
    const meta = (lead.attribution_json && typeof lead.attribution_json === 'object' && !Array.isArray(lead.attribution_json)) ? lead.attribution_json : {};
    if (meta[key]) return String(meta[key]);
    if (meta.utm && typeof meta.utm === 'object' && meta.utm[key]) return String(meta.utm[key]);
    return '';
  }

  function leadAttributionSource(lead) {
    return leadAttr(lead, 'utm_source') || lead.source || leadAttr(lead, 'referrer_host') || 'direct';
  }

  function leadAttributionPage(lead) {
    return lead.page_path || leadAttr(lead, 'landing_page') || 'not captured';
  }

  function leadDaysAgo(lead) {
    const time = new Date(lead.created_at || '').getTime();
    return Number.isNaN(time) ? Infinity : Date.now() - time;
  }

  function topLeadCounts(leads, getter, limit = 6) {
    const counts = new Map();
    leads.forEach(lead => {
      const raw = getter(lead);
      const value = String(raw || '').trim();
      if (!value || value === 'not captured') return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([label, count]) => ({ label, count }));
  }

  function getLeadInsights() {
    const leads = leadsData || [];
    const active = leads.filter(lead => !lead.is_archived);
    const dayMs = 24 * 60 * 60 * 1000;
    const last24 = leads.filter(lead => leadDaysAgo(lead) <= dayMs).length;
    const last7 = leads.filter(lead => leadDaysAgo(lead) <= 7 * dayMs).length;
    const last30 = leads.filter(lead => leadDaysAgo(lead) <= 30 * dayMs).length;
    const sources = topLeadCounts(leads, leadAttributionSource);
    const pages = topLeadCounts(leads, leadAttributionPage);
    const projects = topLeadCounts(leads, lead => lead.project_type || '');
    const campaigns = topLeadCounts(leads, lead => leadAttr(lead, 'utm_campaign'));
    return {
      total: leads.length,
      active: active.length,
      newCount: leads.filter(lead => lead.status === 'new' && !lead.is_archived).length,
      archived: leads.filter(lead => lead.is_archived).length,
      last24,
      last7,
      last30,
      topSource: sources[0]?.label || '-',
      topPage: pages[0]?.label || '-',
      topProject: projects[0]?.label || '-',
      topCampaign: campaigns[0]?.label || '-',
      sources,
      pages,
      projects,
      campaigns,
    };
  }

  function renderLeadBarList(title, rows, total, emptyText) {
    const body = rows.length ? rows.map(row => {
      const pct = total ? Math.round((row.count / total) * 100) : 0;
      return `
        <div class="gv-lead-insight-bar-row">
          <span>${escapeHtml(row.label)}</span>
          <div class="gv-lead-insight-track"><i style="width:${pct}%"></i></div>
          <strong>${escapeHtml(row.count)}</strong>
          <small>${escapeHtml(total ? `${pct}%` : '-')}</small>
        </div>
      `;
    }).join('') : `<p class="gv-admin-empty">${escapeHtml(emptyText)}</p>`;
    return `
      <section class="gv-lead-insight-panel">
        <h3>${escapeHtml(title)}</h3>
        ${body}
      </section>
    `;
  }

  function renderLeadInsightsTab() {
    if (leadsLoading) {
      return '<p class="gv-admin-empty">Loading lead insights...</p>';
    }
    if (!leadsData.length) {
      return `
        <div class="gv-lead-insights-head">
          <button type="button" class="gv-admin-action gv-admin-action--mint" data-admin-action="lead-insights-refresh">Refresh Leads</button>
        </div>
        <p class="gv-admin-empty">No leads yet. Attribution insights will appear after contact form submissions are captured.</p>
      `;
    }

    const insights = getLeadInsights();
    const metrics = [
      ['Total leads', insights.total],
      ['New leads', insights.newCount],
      ['Archived leads', insights.archived],
      ['Leads last 7 days', insights.last7],
      ['Leads last 30 days', insights.last30],
      ['Top source', insights.topSource],
      ['Top page', insights.topPage],
      ['Top project type', insights.topProject],
      ['Top campaign', insights.topCampaign],
    ].map(([label, value]) => renderMetricCard(label, value)).join('');

    return `
      <div class="gv-lead-insights-head">
        <div>
          <span class="gv-admin-pill">Lead Attribution</span>
          <strong>${escapeHtml(insights.total)} captured lead${insights.total === 1 ? '' : 's'}</strong>
          <small>Computed from latest ${escapeHtml(leadsData.length)} lead rows.</small>
        </div>
        <button type="button" class="gv-admin-action gv-admin-action--mint" data-admin-action="lead-insights-refresh">Refresh Leads</button>
      </div>
      <div class="gv-admin-dashboard-grid gv-lead-insight-metrics">${metrics}</div>
      <section class="gv-lead-insight-panel">
        <h3>Leads over time</h3>
        <div class="gv-lead-insight-timeline">
          <div><strong>${escapeHtml(insights.last24)}</strong><span>Last 24 hours</span></div>
          <div><strong>${escapeHtml(insights.last7)}</strong><span>Last 7 days</span></div>
          <div><strong>${escapeHtml(insights.last30)}</strong><span>Last 30 days</span></div>
        </div>
      </section>
      ${renderLeadBarList('Top sources', insights.sources, insights.total, 'No source attribution captured yet.')}
      ${renderLeadBarList('Top pages', insights.pages, insights.total, 'No page attribution captured yet.')}
      ${renderLeadBarList('Top project types', insights.projects, insights.total, 'No project type data yet.')}
      ${renderLeadBarList('Campaign performance', insights.campaigns, insights.total, 'No UTM campaigns captured yet.')}
    `;
  }

  function renderLeadAttributionHtml(lead) {
    const fields = [
      ['Source', leadAttributionSource(lead)],
      ['Landing page', leadAttr(lead, 'landing_page')],
      ['Page path', lead.page_path],
      ['Referrer', leadAttr(lead, 'referrer')],
      ['UTM source', leadAttr(lead, 'utm_source')],
      ['UTM medium', leadAttr(lead, 'utm_medium')],
      ['UTM campaign', leadAttr(lead, 'utm_campaign')],
      ['UTM term', leadAttr(lead, 'utm_term')],
      ['UTM content', leadAttr(lead, 'utm_content')],
    ];
    return `
      <div class="gv-lead-attribution">
        <div class="gv-lead-attribution-title">Attribution</div>
        <div class="gv-lead-attribution-grid">
          ${fields.map(([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value || 'Not captured')}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function normalizeNotificationStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    return value || 'unknown';
  }

  function notificationStatusInfo(status) {
    const st = normalizeNotificationStatus(status);
    const map = {
      sent: { label: 'sent', className: 'sent' },
      failed: { label: 'failed', className: 'failed' },
      test: { label: 'test', className: 'test' },
      skipped: { label: 'skipped', className: 'skip' },
      delivered: { label: 'delivered', className: 'delivered' },
      bounced: { label: 'bounced', className: 'bounced' },
      complained: { label: 'complained', className: 'complained' },
      opened: { label: 'opened', className: 'opened' },
      clicked: { label: 'clicked', className: 'clicked' },
      unknown: { label: 'unknown', className: 'unknown' },
    };
    return map[st] || map.unknown;
  }

  function notifBadgeHtml(status) {
    const info = notificationStatusInfo(status);
    return `<span class="gv-notif-badge gv-notif-badge--${info.className}">${escapeHtml(info.label)}</span>`;
  }

  function notifMeta(log) {
    return (log && log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)) ? log.metadata : {};
  }

  function notifReason(log) {
    const meta = notifMeta(log);
    const latest = (meta.latest_resend_event && typeof meta.latest_resend_event === 'object') ? meta.latest_resend_event : {};
    const details = (latest.details && typeof latest.details === 'object') ? latest.details : ((meta.provider_details && typeof meta.provider_details === 'object') ? meta.provider_details : {});
    return log.error_message || latest.reason || details.reason || details.bounce_type || details.complaint_type || meta.reason || '';
  }

  function notifTime(log) {
    return (
      log.last_event_at ||
      log.delivered_at ||
      log.bounced_at ||
      log.complained_at ||
      log.opened_at ||
      log.clicked_at ||
      log.created_at
    );
  }

  function notifNeedsReason(status) {
    return ['failed', 'bounced', 'complained', 'unknown'].includes(normalizeNotificationStatus(status));
  }

  function notifProviderShort(id) {
    const value = String(id || '');
    return value.length > 14 ? `...${value.slice(-12)}` : value;
  }

  function formatRate(numerator, denominator) {
    if (!denominator) return '—';
    const value = Math.max(0, Math.min(100, (numerator / denominator) * 100));
    return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
  }

  function getNotificationAnalytics() {
    const statuses = ['sent', 'delivered', 'failed', 'bounced', 'complained', 'opened', 'clicked', 'unknown', 'test', 'skipped'];
    const counts = statuses.reduce((acc, st) => ({ ...acc, [st]: 0 }), {});
    const now = Date.now();
    const timeline = {
      day: { total: 0, delivered: 0, problems: 0 },
      week: { total: 0, delivered: 0, problems: 0 },
      month: { total: 0, delivered: 0, problems: 0 },
    };
    const problemStatuses = new Set(['failed', 'bounced', 'complained', 'unknown']);
    const deliveredStatuses = new Set(['delivered', 'opened', 'clicked']);
    const countedLogs = notificationLogs.filter(log => log && normalizeNotificationStatus(log.status) !== 'test');

    countedLogs.forEach(log => {
      const st = normalizeNotificationStatus(log.status);
      counts[st] = (counts[st] || 0) + 1;
      const date = new Date(notifTime(log) || log.created_at || '');
      const time = date.getTime();
      if (!Number.isNaN(time)) {
        const age = now - time;
        const buckets = [
          ['day', 24 * 60 * 60 * 1000],
          ['week', 7 * 24 * 60 * 60 * 1000],
          ['month', 30 * 24 * 60 * 60 * 1000],
        ];
        buckets.forEach(([key, span]) => {
          if (age >= 0 && age <= span) {
            timeline[key].total += 1;
            if (deliveredStatuses.has(st)) timeline[key].delivered += 1;
            if (problemStatuses.has(st)) timeline[key].problems += 1;
          }
        });
      }
    });

    const total = countedLogs.length;
    const deliveredTotal = (counts.delivered || 0) + (counts.opened || 0) + (counts.clicked || 0);
    const problemTotal = (counts.failed || 0) + (counts.bounced || 0) + (counts.complained || 0) + (counts.unknown || 0);
    const deliveryDenominator = (counts.sent || 0) + deliveredTotal + problemTotal;
    const engagementTotal = (counts.opened || 0) + (counts.clicked || 0);
    const deliveryRate = formatRate(deliveredTotal, deliveryDenominator);
    const failureRate = formatRate(problemTotal, total);
    const engagementRate = formatRate(engagementTotal, deliveredTotal);
    const healthLabel = !total ? '—'
      : problemTotal === 0 ? 'Healthy'
      : (problemTotal / total) <= 0.05 ? 'Watch'
      : 'Needs attention';

    return {
      counts,
      total,
      deliveredTotal,
      problemTotal,
      deliveryDenominator,
      engagementTotal,
      deliveryRate,
      failureRate,
      engagementRate,
      healthLabel,
      timeline,
    };
  }

  function renderNotificationsTab() {
    if (notificationLogsLoading) {
      return '<p class="gv-admin-empty">Loading notification analytics...</p>';
    }
    if (notificationLogsError) {
      return `
        <div class="gv-admin-dashboard-message">${escapeHtml(notificationLogsError)}</div>
        <button type="button" class="gv-admin-action gv-admin-action--mint" data-admin-action="notifications-refresh">Refresh Notifications</button>
      `;
    }
    if (!notificationLogs.length) {
      return `
        <div class="gv-notif-analytics-head">
          <button type="button" class="gv-admin-action gv-admin-action--mint" data-admin-action="notifications-refresh">Refresh Notifications</button>
        </div>
        <p class="gv-admin-empty">No notification logs yet. Sent emails will appear here after Phase 21 logging is active.</p>
      `;
    }

    const analytics = getNotificationAnalytics();
    const statusOrder = ['sent', 'delivered', 'failed', 'bounced', 'complained', 'opened', 'clicked', 'unknown'];
    const issueStatuses = new Set(['failed', 'bounced', 'complained', 'unknown']);
    const recentIssues = notificationLogs
      .filter(log => issueStatuses.has(normalizeNotificationStatus(log.status)))
      .slice(0, 8);

    const metricCards = [
      ['Total notifications', analytics.total],
      ['Sent', analytics.counts.sent || 0],
      ['Delivered', analytics.deliveredTotal],
      ['Failed', analytics.counts.failed || 0],
      ['Bounced', analytics.counts.bounced || 0],
      ['Complained', analytics.counts.complained || 0],
      ['Opened', analytics.counts.opened || 0],
      ['Clicked', analytics.counts.clicked || 0],
      ['Unknown', analytics.counts.unknown || 0],
    ].map(([label, value]) => renderMetricCard(label, value)).join('');

    const rates = [
      ['Delivery rate', analytics.deliveryRate, `${analytics.deliveredTotal} delivered / ${analytics.deliveryDenominator} tracked`],
      ['Failure rate', analytics.failureRate, `${analytics.problemTotal} issue${analytics.problemTotal === 1 ? '' : 's'} / ${analytics.total} total`],
      ['Engagement rate', analytics.engagementRate, `${analytics.engagementTotal} open/click / ${analytics.deliveredTotal} delivered`],
    ].map(([label, value, note]) => `
      <div class="gv-notif-rate-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(note)}</small>
      </div>
    `).join('');

    const breakdown = statusOrder.map(st => {
      const count = analytics.counts[st] || 0;
      const pct = analytics.total ? Math.round((count / analytics.total) * 100) : 0;
      return `
        <div class="gv-notif-breakdown-row">
          ${notifBadgeHtml(st)}
          <div class="gv-notif-breakdown-track"><span style="width:${pct}%"></span></div>
          <strong>${escapeHtml(count)}</strong>
          <small>${escapeHtml(analytics.total ? `${pct}%` : '—')}</small>
        </div>
      `;
    }).join('');

    const leadNameById = new Map(leadsData.map(lead => [lead.id, lead.name || lead.email || 'Lead']));
    const issueHtml = recentIssues.length ? recentIssues.map(log => {
      const issueTime = notifTime(log);
      const reason = notifReason(log);
      const leadLabel = log.lead_id && leadNameById.has(log.lead_id) ? leadNameById.get(log.lead_id) : '';
      return `
        <article class="gv-notif-issue-row">
          <div>
            <div class="gv-notif-issue-head">
              ${notifBadgeHtml(log.status)}
              <strong>${escapeHtml(log.recipient_email || 'No recipient')}</strong>
            </div>
            <span>${escapeHtml(log.event_type || 'notification')} ${leadLabel ? `// ${escapeHtml(leadLabel)}` : ''}</span>
            ${reason ? `<p>${escapeHtml(String(reason).slice(0, 180))}</p>` : ''}
          </div>
          <time>${escapeHtml(issueTime ? new Date(issueTime).toLocaleString() : '—')}</time>
        </article>
      `;
    }).join('') : '<p class="gv-admin-empty">No recent delivery issues.</p>';

    const timelineRows = [
      ['Last 24 hours', analytics.timeline.day],
      ['Last 7 days', analytics.timeline.week],
      ['Last 30 days', analytics.timeline.month],
    ].map(([label, row]) => `
      <div class="gv-notif-timeline-row">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(row.total)} total</span>
        <span>${escapeHtml(row.delivered)} delivered</span>
        <span class="${row.problems ? 'is-warning' : ''}">${escapeHtml(row.problems)} issues</span>
      </div>
    `).join('');

    return `
      <div class="gv-notif-analytics-head">
        <div>
          <span class="gv-admin-pill">Delivery Health</span>
          <strong>${escapeHtml(analytics.healthLabel)}</strong>
          <small>Computed from latest ${escapeHtml(notificationLogs.length)} notification log rows.</small>
        </div>
        <button type="button" class="gv-admin-action gv-admin-action--mint" data-admin-action="notifications-refresh">Refresh Notifications</button>
      </div>
      <div class="gv-admin-dashboard-grid gv-notif-metric-grid">${metricCards}</div>
      <div class="gv-notif-rate-grid">${rates}</div>
      <section class="gv-notif-panel">
        <h3>Status breakdown</h3>
        <div class="gv-notif-breakdown">${breakdown}</div>
      </section>
      <section class="gv-notif-panel">
        <h3>Recent delivery issues</h3>
        <div class="gv-notif-issues">${issueHtml}</div>
      </section>
      <section class="gv-notif-panel">
        <h3>Recent activity</h3>
        <div class="gv-notif-timeline">${timelineRows}</div>
      </section>
    `;
  }

  function formatDate(value) {
    if (!value) return 'None';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function cmsFreshReadCutoff() {
    return new Date(Date.now() + 86400000).toISOString();
  }

  function getElementByEditKey(key) {
    if (!key) return null;
    return document.querySelector(`[data-edit-key="${cssEscape(key)}"]`);
  }

  function focusEditableByKey(key) {
    const element = getElementByEditKey(key);
    if (!element) {
      dashboardMessage = 'This field is not present in the current DOM.';
      renderDashboard();
      return;
    }
    if (window._lenis && typeof window._lenis.scrollTo === 'function') {
      window._lenis.scrollTo(element, { offset: -120 });
    } else {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    element.classList.add('gv-admin-selected');
    setTimeout(() => {
      if (element !== selectedElement) element.classList.remove('gv-admin-selected');
    }, 1200);
  }

  function applyDashboardDraft(key) {
    const row = dashboardDraftRows.find(item => item.edit_key === key) || draftRows[key];
    if (!row) return;
    applyRowToElement(row);
    dashboardMessage = `Draft applied to DOM: ${key}`;
    renderDashboard();
  }

  async function deleteDashboardDraft(key) {
    if (!key) return;
    if (!window.confirm('Delete this draft row? Published content will not be deleted.')) return;
    if (isMockAdminSession()) {
      delete mockDraft[key];
      saveMockDraft();
      delete draftRows[key];
    } else if (supabaseClient && currentUser && adminProfile && ['owner', 'editor'].includes(adminProfile.role)) {
      const { error } = await supabaseClient
        .from('cms_content')
        .delete()
        .eq('page_path', pagePath)
        .eq('edit_key', key)
        .eq('status', 'draft');
      if (error) {
        dashboardMessage = 'Delete failed. Check Supabase policies and role.';
        renderDashboard();
        return;
      }
      await insertAuditLog('delete_draft', key, draftRows[key]?.value_text || '', '');
      delete draftRows[key];
    } else {
      dashboardMessage = 'Delete failed. Your role cannot delete drafts.';
      renderDashboard();
      return;
    }
    await refreshDashboardData();
    dashboardMessage = 'Draft deleted. Published content was not changed.';
    renderDashboard();
  }

  function openDashboardInspector(key) {
    const element = getElementByEditKey(key);
    if (!element) {
      dashboardMessage = 'This field is not present in the current DOM.';
      renderDashboard();
      return;
    }
    closeDashboard();
    setMode('edit');
    selectElement(element);
    focusEditableByKey(key);
  }

  function comparePublishedRow(key) {
    const row = dashboardPublishedRows.find(item => item.edit_key === key) || publishedRows[key];
    if (!row) return;
    dashboardMessage = `Published: "${(row.value_text || '').slice(0, 120)}" / Hardcoded: "${(originalValues[key] || '').slice(0, 120)}"`;
    renderDashboard();
  }

  async function copyDashboardValue(key, status) {
    const rowMap = status === 'draft' ? draftRows : publishedRows;
    const row = rowMap[key];
    const value = row?.value_text || '';
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      dashboardMessage = 'Copy is not available in this browser context.';
      renderDashboard();
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      dashboardMessage = 'Value copied.';
    } catch (error) {
      dashboardMessage = 'Copy failed. Browser clipboard permission was denied.';
    }
    renderDashboard();
  }

  async function runCmsHealthCheck() {
    dashboardMessage = 'Running CMS health check...';
    renderDashboard();
    if (supabaseClient && currentUser) {
      await hasActiveAdminSession();
    }
    await refreshDashboardData();
    const registry = getRegistry();
    lastHealthResult = `Checked ${registry.keys().length} fields, ${dashboardDraftRows.length} drafts, ${dashboardPublishedRows.length} published overrides, ${dashboardAuditRows.length} audit entries.`;
    dashboardMessage = 'Health check complete.';
    renderDashboard();
    logCmsDebug('dashboard-health-check');
  }

  function handleAdminClick(event) {
    const actionElement = event.target.closest('[data-admin-action]');
    if (!actionElement) return;
    const action = actionElement.dataset.adminAction;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();

    if (action === 'open-admin') openAdminEntry(actionElement, event);
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
    if (action === 'open-dashboard') openDashboard();
    if (action === 'close-dashboard') closeDashboard();
    if (action === 'dashboard-tab') switchDashboardTab(actionElement.dataset.dashboardTab);
    if (action === 'dashboard-focus') focusEditableByKey(actionElement.dataset.editKey);
    if (action === 'dashboard-apply-draft') applyDashboardDraft(actionElement.dataset.editKey);
    if (action === 'dashboard-delete-draft') deleteDashboardDraft(actionElement.dataset.editKey);
    if (action === 'dashboard-open-inspector') openDashboardInspector(actionElement.dataset.editKey);
    if (action === 'dashboard-compare') comparePublishedRow(actionElement.dataset.editKey);
    if (action === 'dashboard-copy') copyDashboardValue(actionElement.dataset.editKey, actionElement.dataset.rowStatus);
    if (action === 'run-health-check') runCmsHealthCheck();
    if (action === 'cancel-publish') closePublishDialog();
    if (action === 'confirm-publish-page') executePublishCurrentPage();
    if (action === 'media-upload-trigger') { const fi = $('[data-admin-media-input]', dashboard); if (fi) fi.click(); }
    if (action === 'media-refresh') { loadMediaAssets().then(() => { renderDashboard(); setTimeout(bindMediaUploadAreaEvents, 0); setTimeout(bindMediaLibraryEvents, 0); }); }
    if (action === 'media-select-asset') selectMediaAsset(actionElement.dataset.assetId);
    if (action === 'media-copy-url') copyMediaUrl(actionElement.dataset.assetUrl);
    if (action === 'media-detail') openMediaDetail(actionElement.dataset.assetId);
    if (action === 'media-close-detail') closeMediaDetail();
    if (action === 'media-save-metadata') saveMediaMetadata(actionElement.dataset.assetId);
    if (action === 'media-archive-asset') archiveMediaAsset(actionElement.dataset.assetId);
    if (action === 'media-delete-asset') deleteMediaAsset(actionElement.dataset.assetId);
    if (action === 'media-toggle-archived') { mediaShowArchived = !mediaShowArchived; renderDashboard(); setTimeout(bindMediaLibraryEvents, 0); }
    if (action === 'image-save-draft') saveImageDraft();
    if (action === 'image-reset-draft') resetImageDraft();
    if (action === 'image-choose-media') { switchDashboardTab('media'); openDashboard(); }
    if (action === 'image-upload-new') { const fi = $('#gvImageFileInput', panel); if (fi) fi.click(); }

    // Phase 7 actions
    if (action === 'toggle-safe-mode') {
      setEditorSafeMode(!editorSafeMode);
      updateTopbar();
    }
    if (action === 'visual-subtab') {
      visualControlTab = actionElement.dataset.visualTab || 'tokens';
      renderDashboard();
      setTimeout(bindVisualControlEvents, 0);
    }
    if (action === 'inspector-tab') {
      inspectorTab = actionElement.dataset.inspectorTab || 'content';
      if (customSectionEditorId && dashboard && !dashboard.hidden) {
        renderDashboard();
        setTimeout(bindSectionBuilderEvents, 0);
        return;
      }
      if (selectedElement) renderInspector(selectedElement);
    }
    if (action === 'save-token-drafts') saveAllTokenDrafts();
    if (action === 'publish-tokens-page') publishCurrentPageVisuals();
    if (action === 'publish-tokens-global') initiateGlobalTokenPublish();
    if (action === 'confirm-global-token-publish') executeGlobalTokenPublish();
    if (action === 'cancel-global-token-publish') {
      globalTokenPublishPending = false;
      renderDashboard();
      setTimeout(bindVisualControlEvents, 0);
    }
    if (action === 'reset-token-drafts') resetTokenDrafts();
    if (action === 'section-toggle-visibility') toggleSectionVisibility(actionElement.dataset.sectionId);
    if (action === 'section-move-up') moveSectionRelative(actionElement.dataset.sectionId, -1);
    if (action === 'section-move-down') moveSectionRelative(actionElement.dataset.sectionId, 1);
    if (action === 'section-scroll') {
      const sid = actionElement.dataset.sectionId;
      const el = $(`[data-section-id="${sid}"]`);
      if (el) {
        if (window._lenis) { window._lenis.scrollTo(el, { offset: -80 }); }
        else { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }
    }
    if (action === 'section-expand') {
      const sid = actionElement.dataset.sectionId;
      sectionManagerExpanded = sectionManagerExpanded === sid ? null : sid;
      renderDashboard();
      setTimeout(bindSectionManagerEvents, 0);
    }
    if (action === 'save-section-draft') saveSectionDraftFromUI(actionElement.dataset.sectionId);
    if (action === 'reset-section-draft') resetSectionDraft(actionElement.dataset.sectionId);
    if (action === 'save-element-style-draft') saveInspectorStyleDraft();
    if (action === 'reset-element-style-draft') resetElementStyleFromInspector();

    // Phase 8 actions
    if (action === 'builder-add-template') addCustomSectionFromTemplate(actionElement.dataset.templateId);
    if (action === 'builder-edit-section') openCustomSectionEditor(actionElement.dataset.sectionId);
    if (action === 'builder-delete-section') deleteCustomSection(actionElement.dataset.sectionId);
    if (action === 'builder-duplicate-section') duplicateSection(actionElement.dataset.sectionId);
    if (action === 'builder-save-section') saveCustomSectionFromEditor(actionElement.dataset.sectionId);
    if (action === 'builder-style-section') saveCustomSectionStyleFromEditor(actionElement.dataset.sectionId);
    if (action === 'builder-add-item') addCustomSectionItem(actionElement.dataset.sectionId, actionElement.dataset.arrayKey);
    if (action === 'builder-remove-item') removeCustomSectionItem(actionElement.dataset.sectionId, actionElement.dataset.arrayKey, Number(actionElement.dataset.itemIndex || 0));
    if (action === 'builder-move-item') moveCustomSectionItem(actionElement.dataset.sectionId, actionElement.dataset.arrayKey, Number(actionElement.dataset.itemIndex || 0), Number(actionElement.dataset.direction || 0));
    if (action === 'builder-open-media-picker') openCustomMediaPicker(actionElement);
    if (action === 'builder-refresh-media') refreshCustomMediaPicker();
    if (action === 'builder-select-media') selectCustomSectionMedia(actionElement);
    if (action === 'builder-remove-image') removeCustomSectionImage(actionElement);

    // Phase 13 actions
    if (action === 'enter-visitor-preview') enterVisitorPreview(actionElement.dataset.previewType || 'published');
    if (action === 'exit-visitor-preview') exitVisitorPreview();
    if (action === 'visitor-preview-type') {
      visitorPreviewType = actionElement.dataset.previewType || 'published';
      exitVisitorPreview();
      enterVisitorPreview(visitorPreviewType);
    }
    if (action === 'compare-reset-draft') resetDraftToPublished(actionElement.dataset.editKey);
    if (action === 'compare-expand') {
      const ek = actionElement.dataset.editKey;
      draftCompareExpanded = draftCompareExpanded === ek ? null : ek;
      renderDashboard();
    }
    if (action === 'audit-filter') {
      auditFilter = actionElement.dataset.filter || 'all';
      renderDashboard();
    }

    // Phase 16 Visual Properties Panel actions
    if (action === 'vd-bp-switch') {
      const bp = actionElement.dataset.vdBp;
      if (VD_BREAKPOINTS.includes(bp)) {
        window.GV_ADMIN_VISUAL.setBreakpoint(bp);
        if (selectedElement && inspectorTab === 'visual') renderInspector(selectedElement);
      }
    }
    if (action === 'vd-undo') {
      vdHistoryUndo();
      if (selectedElement && inspectorTab === 'visual') renderInspector(selectedElement);
    }
    if (action === 'vd-redo') {
      vdHistoryRedo();
      if (selectedElement && inspectorTab === 'visual') renderInspector(selectedElement);
    }
    if (action === 'vd-copy') {
      if (selectedElement) window.GV_ADMIN_VISUAL.copyStyles(selectedElement);
    }
    if (action === 'vd-paste') {
      if (selectedElement && canAdminEdit()) {
        window.GV_ADMIN_VISUAL.pasteStyles(selectedElement);
        vdVisualDirty = true;
        if (inspectorTab === 'visual') renderInspector(selectedElement);
      }
    }
    if (action === 'vd-reset') {
      if (selectedElement && canAdminEdit()) resetVisualStyleDraft(selectedElement);
    }
    if (action === 'vd-save') {
      if (selectedElement && canAdminEdit()) saveVisualStyleDraft(selectedElement);
    }
    // Phase 19: Leads tab actions
    if (action === 'leads-refresh') { Promise.all([loadLeads(), loadNotificationLogs(), loadLeadActivities(), loadLeadTasks()]).then(() => renderDashboard()); }
    if (action === 'leads-filter') {
      leadsFilter = actionElement.dataset.leadsFilter || 'all';
      renderDashboard();
    }
    if (action === 'lead-pipeline-filter-apply') {
      applyLeadPipelineFiltersFromDom();
      renderDashboard();
    }
    if (action === 'lead-pipeline-filter-reset') {
      resetLeadPipelineFilters();
      renderDashboard();
    }
    if (action === 'lead-expand') {
      const lid = actionElement.dataset.leadId;
      leadsExpanded = leadsExpanded === lid ? null : lid;
      renderDashboard();
    }
    if (action === 'lead-pipeline-save') {
      updateLeadPipeline(actionElement.dataset.leadId, actionElement.closest('[data-lead-pipeline-form]'));
    }
    if (action === 'pipeline-board-filter-apply') {
      applyLeadBoardFiltersFromDom();
      renderDashboard();
    }
    if (action === 'pipeline-board-filter-reset') {
      resetLeadBoardFilters();
      renderDashboard();
    }
    if (action === 'pipeline-open-lead') {
      const lid = actionElement.dataset.leadId;
      if (lid) {
        dashboardTab = 'leads';
        leadsExpanded = lid;
        Promise.all([loadLeadActivities(), loadNotificationLogs(), loadLeadTasks()]).then(() => renderDashboard());
        renderDashboard();
      }
    }
    if (action === 'lead-task-create') {
      createLeadTask(actionElement.dataset.leadId, actionElement.closest('[data-lead-task-form]'));
    }
    if (action === 'lead-task-complete') completeLeadTask(actionElement.dataset.taskId);
    if (action === 'lead-task-cancel') cancelLeadTask(actionElement.dataset.taskId);
    if (action === 'lead-task-reopen') reopenLeadTask(actionElement.dataset.taskId);
    if (action === 'lead-task-reminder') sendLeadTaskReminder(actionElement.dataset.taskId);
    if (action === 'tasks-filter-apply') {
      applyLeadTaskFiltersFromDom();
      renderDashboard();
    }
    if (action === 'tasks-filter-reset') {
      resetLeadTaskFilters();
      renderDashboard();
    }
    if (action === 'task-open-lead') {
      const lid = actionElement.dataset.leadId;
      if (lid) {
        dashboardTab = 'leads';
        leadsExpanded = lid;
        Promise.all([loadLeadActivities(), loadNotificationLogs(), loadLeadTasks()]).then(() => renderDashboard());
        renderDashboard();
      }
    }
    if (action === 'lead-mark-read')   updateLeadStatus(actionElement.dataset.leadId, 'read');
    if (action === 'lead-mark-new')    updateLeadStatus(actionElement.dataset.leadId, 'new');
    if (action === 'lead-archive')     updateLeadArchived(actionElement.dataset.leadId, true);
    if (action === 'lead-unarchive')   updateLeadArchived(actionElement.dataset.leadId, false);
    if (action === 'lead-test-notify')  sendTestNotification();
    if (action === 'lead-retry-notify') retryNotification(actionElement.dataset.leadId);
    if (action === 'notifications-refresh') { loadNotificationLogs().then(() => renderDashboard()); }
    if (action === 'lead-insights-refresh') { loadLeads().then(() => renderDashboard()); }

    // Phase 18: Responsive preview frame
    if (action === 'vd18-resp-preview') {
      const vd18Bp = actionElement.dataset.vd18Bp;
      if (vd18Bp) {
        vd18ShowResponsiveFrame(vd18Bp === 'reset' ? '' : vd18Bp);
        if (selectedElement && inspectorTab === 'visual') renderInspector(selectedElement);
      }
    }
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
    await loadMediaAssets();
    await loadDesignTokens();
    await loadSectionSettings();
    await loadElementStyles();
    await loadCustomSections();
    applyDraftRows();
    renderCustomSectionsForAdmin();
    setEditorSafeMode(true);
    updateTopbar();
    renderPanelEmpty();
    vdActivate();
    refreshScrollLayout();
    logCmsDebug('enter-admin-mode');
  }

  function exitAdminMode() {
    if (inspectorDirty && !window.confirm('You have unsaved inspector changes. Exit Admin Mode anyway?')) return;
    inspectorDirty = false;
    unsavedCount = 0;
    clearSelection();
    vdDeactivate();
    document.body.classList.remove('admin-mode', 'admin-edit-mode', 'admin-preview-mode', 'editor-safe-mode');
    setAdminInteractionIsolation(false);
    editorSafeMode = true;
    mode = 'preview';
    // Phase 17: remove draft CSS so logged-out visitors never see draft styles
    vd17RemoveDraftCSS();
    // Phase 18: remove responsive preview frame on exit
    vd18RemoveResponsiveFrame();
    refreshScrollLayout();
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
    const previousMode = mode;
    mode = nextMode === 'edit' ? 'edit' : 'preview';
    document.body.classList.toggle('admin-edit-mode', mode === 'edit');
    document.body.classList.toggle('admin-preview-mode', mode !== 'edit');
    if (mode !== 'edit') {
      hideHoverBadge();
      if (!clearSelection(false)) {
        mode = previousMode;
        document.body.classList.toggle('admin-edit-mode', mode === 'edit');
        document.body.classList.toggle('admin-preview-mode', mode !== 'edit');
        updateTopbar();
        return;
      }
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
    const role = getAdminRole();
    if (counts) counts.textContent = `Unsaved ${unsavedCount} / Drafts ${Object.keys(draftRows).length}`;
    if (connection) {
      const online = (supabaseClient && !supabaseState.unsafeKey && !supabaseState.failed) || (mockAdminEnabled && currentUser);
      const connLabel = mockAdminEnabled && !supabaseClient && currentUser ? 'Mock admin - owner' : getConnectionLabel();
      const roleTag = role ? ` [${role}]` : '';
      connection.innerHTML = `<span class="gv-admin-status-dot ${online ? 'is-online' : ''}"></span>${escapeHtml(connLabel + roleTag)}`;
    }
    $all('[data-admin-action="mode-preview"], [data-admin-action="mode-edit"]', adminRoot).forEach(button => {
      const isPreview = button.dataset.adminAction === 'mode-preview';
      button.classList.toggle('is-active', (mode === 'preview' && isPreview) || (mode === 'edit' && !isPreview));
    });
    const safeModeBtn = $('[data-admin-safe-mode-btn]', adminRoot);
    if (safeModeBtn) {
      safeModeBtn.textContent = 'Safe Mode: ' + (editorSafeMode ? 'ON' : 'OFF');
      safeModeBtn.classList.toggle('is-safe-mode-on', editorSafeMode);
    }
    const liveStatus = $('[data-admin-live-status]', adminRoot);
    if (liveStatus) liveStatus.textContent = statusMessage || '';
  }

  function renderPanelEmpty() {
    if (!panel) return;
    const registry = getRegistry();
    const fileWarning = isLocalFileMode()
      ? '<div class="gv-admin-warning">For best CMS behavior, use Live Server or a deployed URL.</div>'
      : '';
    $('[data-admin-panel-title]', panel).textContent = 'Select an editable element';
    $('[data-admin-panel-body]', panel).innerHTML = `
      ${getRoleAccessBanner('inspector')}
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

  function bindInspectorDirtyTracker(initialValue) {
    inspectorBaselineValue = initialValue || '';
    inspectorDirty = false;
    const input = $('#gvAdminFieldValue', panel);
    if (!input) return;
    input.addEventListener('input', () => {
      inspectorDirty = input.value !== inspectorBaselineValue;
      unsavedCount = inspectorDirty ? 1 : 0;
      updateTopbar();
    });
  }

  function selectElement(element) {
    if (selectedElement) selectedElement.classList.remove('gv-admin-selected');
    selectedElement = element;
    selectedElement.classList.add('gv-admin-selected');
    vdSelect(element);
    renderInspector(element);
  }

  function clearSelection(renderEmpty = true) {
    if (inspectorDirty && !window.confirm('You have unsaved inspector changes. Close the inspector anyway?')) return false;
    if (selectedElement) selectedElement.classList.remove('gv-admin-selected');
    vdDeselect();
    selectedElement = null;
    inspectorDirty = false;
    vdVisualDirty = false;
    inspectorBaselineValue = '';
    unsavedCount = 0;
    hideHoverBadge();
    updateTopbar();
    if (renderEmpty && document.body.classList.contains('admin-mode')) renderPanelEmpty();
    return true;
  }

  function renderInspector(element) {
    const customSection = element.closest('[data-custom-section="true"]');
    if (customSection) {
      renderCustomSectionInspector(customSection.dataset.sectionId);
      return;
    }
    const type = element.dataset.editType || 'text';
    if (type === 'image' || type === 'background-image') { renderImageInspector(element); return; }
    const registry = getRegistry();
    const key = element.dataset.editKey || '';
    const sectionId = element.dataset.sectionId || '';
    const currentValue = getEditableValue(element);
    const draftValue = draftRows[key] ? draftRows[key].value_text || '' : '';
    const publishedValue = publishedRows[key] ? publishedRows[key].value_text || '' : '';
    const originalValue = originalValues[key] || '';
    const fieldTag = currentValue.length > 90 || type === 'card' || type === 'richtext' ? 'textarea' : 'input';
    $('[data-admin-panel-title]', panel).textContent = draftRows[key] ? 'Editing draft override' : 'Editing field';
    const tabsHtml = `
      <div class="gv-inspector-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${inspectorTab === 'content' ? 'true' : 'false'}" class="${inspectorTab === 'content' ? 'is-active' : ''}" data-admin-action="inspector-tab" data-inspector-tab="content">Content</button>
        <button type="button" role="tab" aria-selected="${inspectorTab === 'style' ? 'true' : 'false'}" class="${inspectorTab === 'style' ? 'is-active' : ''}" data-admin-action="inspector-tab" data-inspector-tab="style">Style</button>
        <button type="button" role="tab" aria-selected="${inspectorTab === 'visual' ? 'true' : 'false'}" class="${inspectorTab === 'visual' ? 'is-active' : ''}" data-admin-action="inspector-tab" data-inspector-tab="visual">Visual</button>
      </div>
    `;
    if (inspectorTab === 'style') {
      $('[data-admin-panel-body]', panel).innerHTML = tabsHtml + getRoleAccessBanner('inspector') + renderInspectorStyleTabHTML(element);
      setTimeout(bindInspectorStyleEvents, 0);
      return;
    }
    if (inspectorTab === 'visual') {
      $('[data-admin-panel-body]', panel).innerHTML = tabsHtml + getRoleAccessBanner('inspector') + renderVisualTabHTML(element);
      setTimeout(bindVisualTabEvents, 0);
      return;
    }
    $('[data-admin-panel-body]', panel).innerHTML = tabsHtml + getRoleAccessBanner('inspector') + `
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
    bindInspectorDirtyTracker(currentValue);
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
    return href.startsWith('#') || href.startsWith('https://') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../') || /^[a-z0-9/_-]+\.html(?:[#?].*)?$/i.test(href) || /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(href);
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

    if (isMockAdminSession()) {
      mockDraft[key] = value;
      saveMockDraft();
      draftRows[key] = makeLocalDraftRow(selectedElement, value);
      unsavedCount = 0;
      setSaveState(note, 'Draft saved locally in mock mode.');
      updateTopbar();
      if (dashboard && !dashboard.hidden) await refreshDashboardData();
      renderInspector(selectedElement);
      finishSave();
      return;
    }

    if (!supabaseClient || !currentUser || !adminProfile || !['owner', 'editor'].includes(adminProfile.role)) {
      unsavedCount = inspectorDirty ? 1 : 0;
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
      inspectorDirty = true;
      unsavedCount = 1;
      const friendly = classifySupabaseError(error);
      setSaveState(note, `Save failed: ${friendly}`);
      if (cmsDebug) console.warn('[GROWVA CMS] save-draft-error', error);
      updateTopbar();
      finishSave();
      return;
    }
    draftRows[key] = data || payload;
    await insertAuditLog('save_draft', key, originalValues[key] || '', value);
    setSaveState(note, 'Draft saved.');
    updateTopbar();
    if (dashboard && !dashboard.hidden) await refreshDashboardData();
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

    if (isMockAdminSession()) {
      delete mockDraft[key];
      delete draftRows[key];
      saveMockDraft();
      restoreSelectedFromPublishedOrOriginal(key);
      if (dashboard && !dashboard.hidden) await refreshDashboardData();
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
    if (dashboard && !dashboard.hidden) await refreshDashboardData();
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
        .eq('status', 'published')
        .lt('created_at', cmsFreshReadCutoff());
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
    if (isMockAdminSession()) {
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
        .eq('status', 'draft')
        .lt('created_at', cmsFreshReadCutoff());
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
      dashboard_open: Boolean(dashboard && !dashboard.hidden),
      dashboard_tab: dashboardTab,
      dashboard_draft_rows: dashboardDraftRows.length,
      dashboard_published_rows: dashboardPublishedRows.length,
      dashboard_audit_rows: dashboardAuditRows.length,
      health_check_result: lastHealthResult,
      file_protocol: isLocalFileMode(),
      media_assets_count: mediaAssets.length,
      media_library_loaded: mediaLibraryLoaded,
      selected_asset_id: mediaSelectedAssetId,
      custom_sections_draft_count: Object.keys(customSectionDrafts).length,
      custom_sections_published_count: Object.keys(customSectionPublished).length
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

  function getVisualDraftCount() {
    return Object.keys(sectionSettingsDrafts).length + Object.keys(elementStyleDrafts).length + Object.keys(designTokenDrafts).length;
  }

  async function publishCurrentPage() {
    if (isMockAdminSession()) {
      mockCustomSections = readMockCustomSections();
      await loadCustomSections();
      pendingPublishRows = Object.values(draftRows);
      pendingCustomPublishRows = Object.values(customSectionDrafts);
      pendingVisualPublishCount = getVisualDraftCount();
      if (!pendingPublishRows.length && !pendingCustomPublishRows.length && !pendingVisualPublishCount) {
        statusMessage = 'No draft changes to publish.';
        renderPanelEmpty();
        return;
      }
      openPublishDialog();
      return;
    }
    if (!supabaseClient || !currentUser || !adminProfile) {
      statusMessage = 'Publish failed. Supabase admin access is required.';
      renderPanelEmpty();
      return;
    }
    if (adminProfile.role !== 'owner') {
      statusMessage = adminProfile.role === 'editor' ? 'Publish failed. Editors can save drafts, but only owners can publish.' : 'Publish failed. Only owners can publish.';
      renderPanelEmpty();
      return;
    }
    let drafts = null;
    let error = null;
    try {
      ({ data: drafts, error } = await supabaseClient
        .from('cms_content')
        .select('*')
        .eq('page_path', pagePath)
        .eq('status', 'draft')
        .lt('created_at', cmsFreshReadCutoff()));
    } catch (caught) {
      error = caught;
    }
    if (error || !Array.isArray(drafts)) {
      statusMessage = 'Publish failed while loading drafts.';
      renderPanelEmpty();
      return;
    }
    let customDrafts = [];
    try {
      const { data: customData, error: customError } = await supabaseClient
        .from('cms_custom_sections')
        .select('*')
        .eq('page_path', pagePath)
        .eq('status', 'draft');
      if (customError) {
        statusMessage = getCustomSectionsTableMessage(customError);
        renderPanelEmpty();
        logCmsCustomDebug('custom-section-publish-load-failed', { error: getSupabaseErrorMessage(customError) });
        return;
      }
      if (Array.isArray(customData)) customDrafts = customData.map(row => normalizeCustomSectionRow(row, 'draft')).filter(Boolean);
    } catch (caught) {
      customDrafts = Object.values(customSectionDrafts);
    }
    pendingVisualPublishCount = getVisualDraftCount();
    if (!drafts.length && !customDrafts.length && !pendingVisualPublishCount) {
      statusMessage = 'No draft changes to publish.';
      renderPanelEmpty();
      return;
    }
    pendingPublishRows = drafts;
    pendingCustomPublishRows = customDrafts;
    openPublishDialog();
  }

  function openPublishDialog() {
    ensureRoot();
    const body = $('[data-publish-confirm-body]', publishDialog);
    const imageRows = pendingPublishRows.filter(r => r.edit_type === 'image' || r.edit_type === 'background-image');
    const textRows = pendingPublishRows.filter(r => r.edit_type !== 'image' && r.edit_type !== 'background-image');
    const tokenCount = Object.keys(designTokenDrafts).length;
    const sectionOrderCount = Object.keys(sectionSettingsDrafts).length;
    const elementStyleCount = Object.keys(elementStyleDrafts).length;
    // Phase 18: compute total VD prop count and affected breakpoints for publish summary
    let vd18TotalProps = 0;
    const vd18AffectedBps = new Set();
    Object.values(elementStyleDrafts).forEach(sj => {
      if (vd17HasBreakpointFormat(sj)) {
        ['desktop','tablet','mobile'].forEach(bp => {
          const cnt = Object.keys(sj[bp] || {}).length;
          if (cnt > 0) { vd18TotalProps += cnt; vd18AffectedBps.add(bp); }
        });
      } else if (sj && sj.styles) {
        vd18TotalProps += Object.keys(sj.styles).length;
      }
    });
    const vd18BpList = vd18AffectedBps.size ? [...vd18AffectedBps].join(', ') : 'none';
    body.innerHTML = `
      <div class="gv-admin-publish-summary">
        <div class="gv-admin-meta">
          <div>Page path: <code>${escapeHtml(pagePath)}</code></div>
          <div>Scope: <code>Current page only</code></div>
        </div>
        <div class="gv-admin-publish-groups">
          <div class="gv-admin-publish-group${textRows.length ? '' : ' is-empty'}">
            <span class="gv-admin-publish-group-label">Text / content</span>
            <span class="gv-admin-publish-group-count">${textRows.length}</span>
          </div>
          <div class="gv-admin-publish-group${imageRows.length ? '' : ' is-empty'}">
            <span class="gv-admin-publish-group-label">Image / media references</span>
            <span class="gv-admin-publish-group-count">${imageRows.length}</span>
          </div>
          <div class="gv-admin-publish-group${pendingCustomPublishRows.length ? '' : ' is-empty'}">
            <span class="gv-admin-publish-group-label">Custom sections</span>
            <span class="gv-admin-publish-group-count">${pendingCustomPublishRows.length}</span>
          </div>
          <div class="gv-admin-publish-group${tokenCount ? '' : ' is-empty'}">
            <span class="gv-admin-publish-group-label">Visual / design tokens</span>
            <span class="gv-admin-publish-group-count">${tokenCount}</span>
          </div>
          <div class="gv-admin-publish-group${sectionOrderCount ? '' : ' is-empty'}">
            <span class="gv-admin-publish-group-label">Section order / visibility</span>
            <span class="gv-admin-publish-group-count">${sectionOrderCount}</span>
          </div>
          <div class="gv-admin-publish-group${elementStyleCount ? '' : ' is-empty'}">
            <span class="gv-admin-publish-group-label">Element style overrides</span>
            <span class="gv-admin-publish-group-count">${elementStyleCount}</span>
            ${elementStyleCount ? `<span class="gv-admin-publish-detail">${vd18TotalProps} prop${vd18TotalProps !== 1 ? 's' : ''} &middot; Breakpoints: ${escapeHtml(vd18BpList)}</span>` : ''}
          </div>
        </div>
        <div class="gv-admin-warning">Publishing affects only this page. Global token publish is separate.</div>
        ${elementStyleCount ? '<div class="gv-admin-warning gv-admin-warning--vd">Specificity note: published element styles use <code>html body [data-edit-key]</code> selectors. Verify overrides in browser if site selectors are more specific.</div>' : ''}
        ${getStaleDraftCount() > 0 ? `<div class="gv-admin-stale-warning">⚠ ${getStaleDraftCount()} draft(s) are older than 7 days. <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="dashboard-tab" data-dashboard-tab="compare">View Draft Compare</button></div>` : ''}
      </div>
      <div class="gv-admin-row-list gv-admin-row-list--compact">
        ${pendingPublishRows.map(row => `
          <article class="gv-admin-content-row">
            <div>
              <strong>${escapeHtml(row.edit_key || '')}</strong>
              <span>${escapeHtml(row.section_id || 'No section')} / ${escapeHtml(row.edit_type || 'text')}</span>
              <p>${escapeHtml((row.value_text || '').slice(0, 140))}</p>
            </div>
          </article>
        `).join('') || '<p class="gv-admin-empty">No draft content rows to publish.</p>'}
        ${pendingCustomPublishRows.map(row => `
          <article class="gv-admin-content-row">
            <div>
              <strong>${escapeHtml(row.title || row.section_id || '')}</strong>
              <span>${escapeHtml(row.template_id || 'custom section')}</span>
              <p>${escapeHtml((row.content_json?.heading || row.content_json?.body || row.section_id || '').slice(0, 140))}</p>
            </div>
          </article>
        `).join('')}
      </div>
    `;
    publishDialog.hidden = false;
  }

  function closePublishDialog() {
    if (!publishDialog) return;
    publishDialog.hidden = true;
    if (!publishInFlight) {
      pendingPublishRows = [];
      pendingCustomPublishRows = [];
      pendingVisualPublishCount = 0;
    }
  }

  async function executePublishCurrentPage() {
    if (publishInFlight) return;
    if (!pendingPublishRows.length && !pendingCustomPublishRows.length && !pendingVisualPublishCount) {
      statusMessage = 'No draft changes to publish.';
      closePublishDialog();
      renderPanelEmpty();
      return;
    }
    publishInFlight = true;
    const publishButton = adminRoot ? $('[data-admin-action="publish-page"]', adminRoot) : null;
    const confirmButton = publishDialog ? $('[data-admin-action="confirm-publish-page"]', publishDialog) : null;
    if (publishButton) {
      publishButton.disabled = true;
      publishButton.textContent = 'Publishing...';
    }
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = 'Publishing...';
    }
    const finishPublish = () => {
      publishInFlight = false;
      if (publishButton) {
        publishButton.disabled = false;
        publishButton.textContent = 'Publish';
      }
      if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Publish Current Page';
      }
    };
    if (isMockAdminSession()) {
      publishedRows = Object.assign({}, publishedRows, draftRows);
      pendingPublishRows.forEach(applyRowToElement);
      const customResult = await publishCustomSectionDrafts();
      if (pendingVisualPublishCount) await publishCurrentPageVisuals();
      renderCustomSections(getCustomSectionRowsForRender(false));
      statusMessage = `Published ${pendingPublishRows.length} mock changes, ${customResult.count} custom sections, and ${pendingVisualPublishCount} visual changes.`;
      closePublishDialog();
      renderPanelEmpty();
      if (dashboard && !dashboard.hidden) {
        await refreshDashboardData();
        renderDashboard();
      }
      pendingPublishRows = [];
      pendingCustomPublishRows = [];
      pendingVisualPublishCount = 0;
      finishPublish();
      return;
    }
    if (!supabaseClient || !currentUser || !adminProfile || adminProfile.role !== 'owner') {
      statusMessage = 'Publish failed. Only owners can publish current-page drafts.';
      closePublishDialog();
      renderPanelEmpty();
      finishPublish();
      return;
    }
    const publishedPayload = pendingPublishRows.map(row => ({
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
    let published = [];
    if (publishedPayload.length) {
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
        statusMessage = `Publish failed: ${classifySupabaseError(publishError)}`;
        if (cmsDebug) console.warn('[GROWVA CMS] publish-error', publishError);
        renderPanelEmpty();
        finishPublish();
        return;
      }
    }
    const customPublish = await publishCustomSectionDrafts();
    if (customPublish.error) {
      statusMessage = `Publish failed on custom sections: ${classifySupabaseError(customPublish.error)}`;
      if (cmsDebug) console.warn('[GROWVA CMS] custom-section-publish-error', customPublish.error);
      renderPanelEmpty();
      finishPublish();
      return;
    }
    if (pendingVisualPublishCount) await publishCurrentPageVisuals();
    try {
      await supabaseClient.from('cms_publish_log').insert({
        page_path: pagePath,
        published_by: currentUser.id,
        published_count: publishedPayload.length + customPublish.count + pendingVisualPublishCount
      });
    } catch (error) {
      // Publishing succeeded; log write is best-effort and also protected by RLS.
    }
    await insertAuditLog('publish_page', 'page', '', `Published ${publishedPayload.length} content changes, ${customPublish.count} custom sections, and ${pendingVisualPublishCount} visual changes on ${pagePath}`);
    publishedRows = Object.assign({}, publishedRows, indexRows(published || publishedPayload));
    publishedPayload.forEach(applyRowToElement);
    renderCustomSections(getCustomSectionRowsForRender(false));
    statusMessage = `Published ${publishedPayload.length} changes, ${customPublish.count} custom sections, and ${pendingVisualPublishCount} visual changes.`;
    updateTopbar();
    closePublishDialog();
    renderPanelEmpty();
    if (dashboard && !dashboard.hidden) {
      await refreshDashboardData();
      renderDashboard();
    }
    pendingPublishRows = [];
    pendingCustomPublishRows = [];
    pendingVisualPublishCount = 0;
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
    return String(value == null ? '' : value)
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
    $all('[data-admin-entry], [data-admin-action="open-admin"]').forEach(trigger => {
      if (trigger.tagName === 'BUTTON') trigger.type = 'button';
      if (trigger.tagName === 'A' && trigger.hasAttribute('href')) trigger.dataset.adminHref = trigger.getAttribute('href') || '';
      trigger.removeAttribute('href');
      trigger.dataset.adminAction = 'open-admin';
      trigger.dataset.adminUi = 'true';
      trigger.setAttribute('role', trigger.tagName === 'A' ? 'button' : trigger.getAttribute('role') || 'button');
      trigger.setAttribute('tabindex', trigger.getAttribute('tabindex') || '0');
      trigger.classList.remove('is-admin-loading');
      trigger.removeAttribute('aria-busy');
    });
  }

  // ─── Phase 6: Media Library ───────────────────────────────────────────────

  function sanitizeFileName(name) {
    const parts = String(name || 'file').split('.');
    const ext = parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
    const base = parts.join('.').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return (base || 'file') + ext;
  }

  function detectImageDimensions(file) {
    return new Promise(resolve => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve({ width: null, height: null }); };
      img.src = objectUrl;
    });
  }

  function isSafeImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const v = url.trim().toLowerCase();
    if (v.startsWith('javascript:')) return false;
    if (v.startsWith('data:')) return false;
    const supabaseHost = (getSupabaseConfig().url || '').replace(/\/$/, '').toLowerCase();
    if (supabaseHost && url.toLowerCase().startsWith(supabaseHost + '/storage/')) return true;
    if (url.startsWith('https://')) return true;
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return true;
    return false;
  }

  function setAdminImagePreview(wrap, url, alt) {
    if (!wrap || !url || !isSafeImageUrl(url)) return;
    wrap.textContent = '';
    const img = document.createElement('img');
    img.className = 'gv-admin-image-preview';
    img.src = url;
    img.alt = sanitizeText(alt || '');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.imagePreview = 'true';
    wrap.appendChild(img);
  }

  function getImageValueFromRow(row) {
    if (!row) return null;
    if (row.value_json && typeof row.value_json === 'object' && !Array.isArray(row.value_json)) return row.value_json;
    if (row.value_json && typeof row.value_json === 'string') {
      try { return JSON.parse(row.value_json); } catch (e) { return null; }
    }
    return null;
  }

  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  async function loadMediaAssets() {
    if (!supabaseClient || !currentUser || !adminProfile) { mediaAssets = []; return; }
    try {
      let { data, error } = await supabaseClient
        .from('cms_media_assets')
        .select('id,storage_path,public_url,file_name,file_type,file_size,width,height,alt_text,caption,title,description,metadata_json,is_archived,folder,uploaded_by,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(200);
      mediaSchemaSupportsManagement = !error;
      mediaSchemaWarning = '';
      if (error) {
        mediaSchemaSupportsManagement = false;
        mediaSchemaWarning = 'Phase 11 metadata columns are not applied yet. Alt text and caption remain editable; title, description, and archive controls require supabase/phase-11-media-asset-management.sql.';
        const fallback = await supabaseClient
          .from('cms_media_assets')
          .select('id,storage_path,public_url,file_name,file_type,file_size,width,height,alt_text,caption,folder,uploaded_by,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(200);
        data = fallback.data;
        error = fallback.error;
      }
      if (error || !Array.isArray(data)) { mediaAssets = []; logCmsMediaDebug('load-assets-error', { error: error ? error.message : 'unknown' }); return; }
      mediaAssets = data.map(asset => Object.assign({
        title: '',
        description: '',
        metadata_json: {},
        is_archived: false
      }, asset));
      mediaLibraryLoaded = true;
      await loadMediaUsage();
      logCmsMediaDebug('load-assets-ok', { count: data.length });
    } catch (e) {
      mediaAssets = [];
    }
  }

  async function loadMediaUsage() {
    mediaAssetUsage = {};
    mediaUsageLoaded = false;
    if (!supabaseClient || !currentUser || !adminProfile || !mediaAssets.length) return;
    try {
      const { data, error } = await supabaseClient
        .from('cms_custom_sections')
        .select('page_path,section_id,template_id,status,is_visible,content_json')
        .limit(500);
      if (error || !Array.isArray(data)) {
        mediaLibraryMessage = 'Usage lookup is unavailable. Media actions remain conservative.';
        return;
      }
      data.forEach(row => {
        const refs = collectMediaRefs(row.content_json);
        mediaAssets.forEach(asset => {
          const usedById = asset.id && refs.assetIds.has(asset.id);
          const usedByUrl = asset.public_url && refs.urls.has(asset.public_url);
          if (!usedById && !usedByUrl) return;
          if (!mediaAssetUsage[asset.id]) mediaAssetUsage[asset.id] = [];
          mediaAssetUsage[asset.id].push({
            page_path: row.page_path || '',
            section_id: row.section_id || '',
            template_id: row.template_id || '',
            status: row.status || '',
            is_visible: row.is_visible !== false
          });
        });
      });
      mediaUsageLoaded = true;
    } catch (error) {
      mediaLibraryMessage = 'Usage lookup failed. Cleanup actions are restricted until usage can be checked.';
    }
  }

  function collectMediaRefs(value, refs = { assetIds: new Set(), urls: new Set() }) {
    if (!value || typeof value !== 'object') return refs;
    if (Array.isArray(value)) {
      value.forEach(item => collectMediaRefs(item, refs));
      return refs;
    }
    Object.entries(value).forEach(([key, val]) => {
      if ((key === 'image_asset_id' || key === 'media_asset_id') && val) refs.assetIds.add(String(val));
      else if ((key === 'image_url' || key === 'url') && val && isSafeImageUrl(String(val))) refs.urls.add(String(val));
      else if (val && typeof val === 'object') collectMediaRefs(val, refs);
    });
    return refs;
  }

  async function uploadMediaFile(file) {
    if (!supabaseClient || !currentUser || !adminProfile) return { error: 'Not authenticated.' };
    if (!['owner', 'editor'].includes(adminProfile.role)) return { error: 'Upload requires owner or editor role.' };
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) return { error: 'File type not allowed. Use JPEG, PNG, or WebP. (SVG is disabled for security.)' };
    if (file.size > 5 * 1024 * 1024) return { error: 'File too large. Max 5 MB. Your file: ' + (file.size / 1024 / 1024).toFixed(1) + ' MB.' };
    const safeName = sanitizeFileName(file.name);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const ts = now.getTime();
    const storagePath = 'cms/' + yyyy + '/' + mm + '/' + ts + '-' + safeName;
    const dims = await detectImageDimensions(file);
    let uploadError = null;
    try {
      const up = await supabaseClient.storage.from('cms-media').upload(storagePath, file, { upsert: false, contentType: file.type });
      uploadError = up.error;
    } catch (e) { return { error: 'Storage upload failed: ' + (e.message || String(e)) }; }
    if (uploadError) return { error: 'Storage upload failed: ' + (uploadError.message || String(uploadError)) };
    const urlResult = supabaseClient.storage.from('cms-media').getPublicUrl(storagePath);
    const publicUrl = (urlResult.data && urlResult.data.publicUrl) ? urlResult.data.publicUrl : '';
    let assetData = null, insertError = null;
    try {
      const ins = await supabaseClient.from('cms_media_assets').insert({
        storage_path: storagePath, public_url: publicUrl,
        file_name: safeName, file_type: file.type, file_size: file.size,
        width: dims.width || null, height: dims.height || null,
        alt_text: '', caption: '', folder: 'cms', uploaded_by: currentUser.id
      }).select().single();
      assetData = ins.data; insertError = ins.error;
    } catch (e) { return { error: 'Asset record insert failed: ' + (e.message || String(e)) }; }
    if (insertError) return { error: 'Asset record insert failed: ' + (insertError.message || String(insertError)) };
    await insertMediaAuditLog('media_upload', assetData ? assetData.id : storagePath, { file_name: safeName, file_size: file.size });
    logCmsMediaDebug('upload-ok', { storagePath, publicUrl, width: dims.width, height: dims.height });
    return { data: assetData };
  }

  async function insertMediaAuditLog(action, key, details) {
    if (!supabaseClient || !currentUser) return;
    try {
      await supabaseClient.from('cms_audit_log').insert({
        action, page_path: pagePath, edit_key: String(key || ''),
        old_value: '', new_value: typeof details === 'string' ? details : JSON.stringify(details || {}),
        user_id: currentUser.id
      });
    } catch (e) { /* best-effort */ }
  }

  function renderMediaLibraryTab() {
    const canUpload = adminProfile && ['owner', 'editor'].includes(adminProfile.role);
    const fileWarning = isLocalFileMode()
      ? '<div class="gv-admin-warning">Media upload requires Live Server or a deployed URL. The <code>file://</code> protocol cannot reach Supabase Storage.</div>'
      : '';
    if (!supabaseClient || !currentUser || !adminProfile) {
      return '<p class="gv-admin-empty">Sign in to access the Media Library.</p>';
    }
    const uploadArea = canUpload ? `
      <div class="gv-admin-media-upload-area" data-admin-action="media-upload-area">
        <input type="file" id="gvMediaFileInput" accept="image/jpeg,image/png,image/webp" style="position:absolute;opacity:0;width:0;height:0;pointer-events:none;" multiple data-admin-media-input>
        <div class="gv-admin-media-upload-icon">&#8593;</div>
        <p>Drag &amp; drop images here, or <button class="gv-admin-media-upload-link" type="button" data-admin-action="media-upload-trigger">browse files</button></p>
        <p class="gv-admin-media-upload-hint">JPEG, PNG, WebP &mdash; max 5 MB &mdash; SVG disabled</p>
      </div>
      <div class="gv-admin-media-upload-status" data-media-upload-status hidden></div>
    ` : '<div class="gv-admin-warning">Browsing only. Upload requires owner or editor role.</div>';
    return `
      <div class="gv-admin-media-library">
        ${fileWarning}
        ${mediaSchemaWarning ? `<div class="gv-admin-warning">${escapeHtml(mediaSchemaWarning)}</div>` : ''}
        ${mediaLibraryMessage ? `<div class="gv-admin-dashboard-message">${escapeHtml(mediaLibraryMessage)}</div>` : ''}
        ${uploadArea}
        <div class="gv-admin-media-toolbar">
          <span class="gv-admin-pill">Media Library</span>
          <span class="gv-admin-media-count">${mediaAssets.length} asset${mediaAssets.length !== 1 ? 's' : ''}</span>
          <input class="gv-admin-media-search" type="search" data-media-search placeholder="Search assets" value="${escapeHtml(mediaLibrarySearch)}">
          <button class="gv-admin-action" type="button" data-admin-action="media-toggle-archived">${mediaShowArchived ? 'Hide Archived' : 'Show Archived'}</button>
          <button class="gv-admin-action" type="button" data-admin-action="media-refresh">Refresh</button>
        </div>
        ${renderMediaGrid()}
        ${renderMediaDetailPanel()}
      </div>
    `;
  }

  function renderMediaGrid() {
    if (!mediaLibraryLoaded) return '<p class="gv-admin-empty">Loading media assets&hellip;</p>';
    const visibleAssets = getVisibleMediaAssets();
    if (!mediaAssets.length) return `
      <div class="gv-admin-media-empty">
        <p class="gv-admin-empty">No images uploaded yet.</p>
        <p class="gv-admin-note">Upload your first image above and it will appear here.</p>
      </div>
    `;
    if (!visibleAssets.length) return '<p class="gv-admin-empty">No assets match this filter.</p>';
    return `
      <div class="gv-admin-media-grid">
        ${visibleAssets.map(asset => {
          const usage = getMediaUsage(asset);
          return `
          <div class="gv-admin-media-item${mediaSelectedAssetId === asset.id ? ' is-selected' : ''}${asset.is_archived ? ' is-archived' : ''}${usage.length ? ' is-used' : ' is-unused'}" data-admin-action="media-detail" data-asset-id="${escapeHtml(asset.id)}" title="${escapeHtml(asset.file_name)}">
            <div class="gv-admin-media-thumb" style="background-image:url(${escapeHtml(asset.public_url)})"></div>
            <div class="gv-admin-media-info">
              <strong>${escapeHtml(getMediaDisplayName(asset))}</strong>
              <span>${escapeHtml(asset.file_type || 'image')} ${escapeHtml(asset.width && asset.height ? ' / ' + asset.width + 'x' + asset.height : '')} ${escapeHtml(asset.file_size ? ' / ' + formatFileSize(asset.file_size) : '')}</span>
              <span>${escapeHtml(asset.created_at ? new Date(asset.created_at).toLocaleDateString() : 'No date')}</span>
              ${asset.alt_text ? '<span>' + escapeHtml(asset.alt_text.slice(0, 60)) + '</span>' : '<span>No alt text</span>'}
              <span class="gv-admin-media-badges">
                <em class="${usage.length ? 'is-used' : 'is-unused'}">${usage.length ? 'Used' : 'Unused'}</em>
                ${asset.is_archived ? '<em>Archived</em>' : ''}
                ${isQaMediaAsset(asset) ? '<em>QA/Test</em>' : ''}
              </span>
            </div>
            <div class="gv-admin-media-item-actions">
              <button class="gv-admin-action" type="button" data-admin-action="media-detail" data-asset-id="${escapeHtml(asset.id)}">Details</button>
              <button class="gv-admin-action" type="button" data-admin-action="media-copy-url" data-asset-id="${escapeHtml(asset.id)}" data-asset-url="${escapeHtml(asset.public_url)}">Copy URL</button>
            </div>
          </div>
        `; }).join('')}
      </div>
    `;
  }

  function getVisibleMediaAssets() {
    const query = mediaLibrarySearch.trim().toLowerCase();
    return mediaAssets.filter(asset => {
      if (asset.is_archived && !mediaShowArchived) return false;
      if (!query) return true;
      return [asset.file_name, asset.title, asset.alt_text, asset.caption, asset.description, asset.file_type]
        .some(value => String(value || '').toLowerCase().includes(query));
    });
  }

  function getMediaDisplayName(asset) {
    return asset.title || asset.file_name || 'Untitled asset';
  }

  function getMediaUsage(asset) {
    return mediaAssetUsage[asset?.id] || [];
  }

  function isQaMediaAsset(asset) {
    return /phase-10-probe\.png/i.test(asset?.file_name || '') || /phase-10-probe/i.test(asset?.storage_path || '');
  }

  function renderMediaDetailPanel() {
    const asset = mediaAssets.find(item => item.id === mediaDetailAssetId);
    if (!asset) return '';
    const usage = getMediaUsage(asset);
    const canEdit = ['owner', 'editor'].includes(adminProfile?.role || '');
    const isOwner = adminProfile?.role === 'owner';
    const usedInVisiblePublished = usage.some(item => item.status === 'published' && item.is_visible !== false);
    const canArchive = isOwner && mediaSchemaSupportsManagement && !usedInVisiblePublished;
    const canDelete = isOwner && usage.length === 0;
    return `
      <aside class="gv-admin-media-detail" data-media-detail="${escapeHtml(asset.id)}">
        <div class="gv-admin-builder-editor-head">
          <div>
            <span class="gv-admin-pill">${isQaMediaAsset(asset) ? 'QA/Test Asset' : 'Asset Detail'}</span>
            <h3>${escapeHtml(getMediaDisplayName(asset))}</h3>
          </div>
          <button class="gv-admin-action" type="button" data-admin-action="media-close-detail">Close</button>
        </div>
        <div class="gv-admin-media-detail-grid">
          <div class="gv-admin-media-detail-preview">
            ${asset.public_url && isSafeImageUrl(asset.public_url) ? `<img src="${escapeHtml(asset.public_url)}" alt="${escapeHtml(asset.alt_text || '')}" loading="lazy" decoding="async">` : '<span>Preview unavailable</span>'}
          </div>
          <div class="gv-admin-media-detail-fields">
            ${renderMediaMetaField('title', 'Title', asset.title || '', canEdit && mediaSchemaSupportsManagement)}
            ${renderMediaMetaField('alt_text', 'Alt text', asset.alt_text || '', canEdit)}
            ${renderMediaMetaField('caption', 'Caption', asset.caption || '', canEdit, true)}
            ${renderMediaMetaField('description', 'Description', asset.description || '', canEdit && mediaSchemaSupportsManagement, true)}
            <div class="gv-admin-meta">
              <div>Filename: <code>${escapeHtml(asset.file_name || '')}</code></div>
              <div>Type: <code>${escapeHtml(asset.file_type || '')}</code></div>
              <div>Size: <code>${escapeHtml(formatFileSize(asset.file_size))}</code></div>
              <div>Storage: <code>${escapeHtml(asset.storage_path || '')}</code></div>
              <div>Updated: <code>${escapeHtml(asset.updated_at ? new Date(asset.updated_at).toLocaleString() : 'Unknown')}</code></div>
            </div>
            ${renderMediaUsageList(asset)}
            <div class="gv-admin-panel-actions">
              <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="media-save-metadata" data-asset-id="${escapeHtml(asset.id)}" ${canEdit ? '' : 'disabled'}>Save Metadata</button>
              <button class="gv-admin-action" type="button" data-admin-action="media-archive-asset" data-asset-id="${escapeHtml(asset.id)}" ${canArchive ? '' : 'disabled'}>${asset.is_archived ? 'Unarchive' : 'Archive'}</button>
              <button class="gv-admin-action gv-admin-action--danger" type="button" data-admin-action="media-delete-asset" data-asset-id="${escapeHtml(asset.id)}" ${canDelete ? '' : 'disabled'}>Delete Permanently</button>
            </div>
            ${usedInVisiblePublished ? '<p class="gv-admin-note">Cleanup is blocked because this asset is used by visible published content.</p>' : ''}
            ${usage.length && !usedInVisiblePublished ? '<p class="gv-admin-note">Deletion is blocked while historical draft or hidden published references exist. Archive is preferred after the Phase 11 SQL patch is applied.</p>' : ''}
          </div>
        </div>
      </aside>
    `;
  }

  function renderMediaMetaField(key, label, value, canEdit, multiline = false) {
    return `
      <div class="gv-admin-field">
        <label>${escapeHtml(label)}</label>
        ${multiline
          ? `<textarea data-media-meta="${escapeHtml(key)}" ${canEdit ? '' : 'disabled'}>${escapeHtml(value || '')}</textarea>`
          : `<input type="text" data-media-meta="${escapeHtml(key)}" value="${escapeHtml(value || '')}" ${canEdit ? '' : 'disabled'}>`}
      </div>
    `;
  }

  function renderMediaUsageList(asset) {
    const usage = getMediaUsage(asset);
    if (!mediaUsageLoaded) return '<div class="gv-admin-warning">Usage lookup has not completed.</div>';
    if (!usage.length) return '<div class="gv-admin-dashboard-message">Not used in custom sections.</div>';
    return `
      <div class="gv-admin-media-usage">
        <strong>Usage</strong>
        ${usage.slice(0, 12).map(item => `
          <div>
            <span>${escapeHtml(item.page_path || 'unknown page')}</span>
            <code>${escapeHtml(item.section_id || '')}</code>
            <em>${escapeHtml(item.template_id || '')} / ${escapeHtml(item.status || '')}${item.is_visible === false ? ' / hidden' : ''}</em>
          </div>
        `).join('')}
      </div>
    `;
  }
  function bindMediaUploadAreaEvents() {
    const area = $('[data-admin-action="media-upload-area"]', dashboard);
    if (!area || area._mediaBound) return;
    area._mediaBound = true;
    const fileInput = $('[data-admin-media-input]', dashboard);
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('is-drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('is-drag-over'));
    area.addEventListener('drop', e => {
      e.preventDefault();
      area.classList.remove('is-drag-over');
      if (e.dataTransfer && e.dataTransfer.files) handleMediaFileInput(e.dataTransfer.files);
    });
    if (fileInput) {
      fileInput.addEventListener('change', () => { if (fileInput.files) handleMediaFileInput(fileInput.files); });
    }
  }

  async function handleMediaFileInput(files) {
    if (!files || !files.length) return;
    mediaUploadInFlight = true;
    const statusEl = $('[data-media-upload-status]', dashboard);
    if (statusEl) { statusEl.hidden = false; statusEl.textContent = 'Uploading ' + files.length + ' file' + (files.length !== 1 ? 's' : '') + '…'; }
    let success = 0, fail = 0;
    const errors = [];
    for (const file of Array.from(files)) {
      const result = await uploadMediaFile(file);
      if (result.error) { fail++; errors.push(file.name + ': ' + result.error); }
      else { success++; if (result.data) mediaAssets.unshift(result.data); }
    }
    mediaUploadInFlight = false;
    if (statusEl) {
      statusEl.textContent = [
        success ? success + ' file' + (success !== 1 ? 's' : '') + ' uploaded.' : '',
        fail ? fail + ' failed — ' + errors.slice(0, 2).join('; ') : ''
      ].filter(Boolean).join(' ');
    }
    renderDashboard();
    setTimeout(bindMediaUploadAreaEvents, 0);
    setTimeout(bindMediaLibraryEvents, 0);
  }

  function selectMediaAsset(assetId) {
    mediaSelectedAssetId = assetId;
    const asset = mediaAssets.find(a => a.id === assetId);
    logCmsMediaDebug('asset-selected', { assetId: assetId, url: asset ? asset.public_url : null });
    if (selectedElement && (selectedElement.dataset.editType === 'image' || selectedElement.dataset.editType === 'background-image')) {
      const urlInput = $('#gvImageUrl', panel);
      if (urlInput && asset) urlInput.value = asset.public_url;
      const previewWrap = $('.gv-admin-image-preview-wrap', panel);
      if (previewWrap && asset && isSafeImageUrl(asset.public_url)) {
        setAdminImagePreview(previewWrap, asset.public_url, asset.alt_text || '');
      }
      const note = $('[data-image-save-state]', panel);
      if (note && asset) note.textContent = 'Selected: ' + asset.file_name + '. Click Save Draft Image to apply.';
    }
    renderDashboard();
    setTimeout(bindMediaUploadAreaEvents, 0);
    setTimeout(bindMediaLibraryEvents, 0);
  }

  function bindMediaLibraryEvents() {
    if (!dashboard) return;
    const search = $('[data-media-search]', dashboard);
    if (search && !search._mediaSearchBound) {
      search._mediaSearchBound = true;
      search.addEventListener('input', () => {
        mediaLibrarySearch = search.value || '';
        renderDashboard();
        setTimeout(bindMediaUploadAreaEvents, 0);
        setTimeout(bindMediaLibraryEvents, 0);
      });
    }
  }

  function openMediaDetail(assetId) {
    mediaDetailAssetId = assetId || null;
    mediaSelectedAssetId = assetId || mediaSelectedAssetId;
    renderDashboard();
    setTimeout(bindMediaUploadAreaEvents, 0);
    setTimeout(bindMediaLibraryEvents, 0);
  }

  function closeMediaDetail() {
    mediaDetailAssetId = null;
    renderDashboard();
    setTimeout(bindMediaUploadAreaEvents, 0);
    setTimeout(bindMediaLibraryEvents, 0);
  }

  function readMediaMetadataPayload(asset) {
    const detail = dashboard ? $(`[data-media-detail="${cssEscape(asset.id)}"]`, dashboard) : null;
    const get = key => {
      const input = detail ? $(`[data-media-meta="${key}"]`, detail) : null;
      return sanitizeText(input ? input.value : asset[key] || '').slice(0, key === 'alt_text' ? 240 : 1200);
    };
    const payload = {
      alt_text: get('alt_text'),
      caption: get('caption'),
      updated_at: new Date().toISOString()
    };
    if (mediaSchemaSupportsManagement) {
      payload.title = get('title').slice(0, 180);
      payload.description = get('description');
    }
    return payload;
  }

  async function saveMediaMetadata(assetId) {
    const asset = mediaAssets.find(item => item.id === assetId);
    if (!asset) return;
    if (!supabaseClient || !currentUser || !['owner', 'editor'].includes(adminProfile?.role || '')) {
      mediaLibraryMessage = 'Metadata save requires owner or editor role.';
      renderDashboard();
      return;
    }
    const payload = readMediaMetadataPayload(asset);
    try {
      const { data, error } = await supabaseClient
        .from('cms_media_assets')
        .update(payload)
        .eq('id', asset.id)
        .select()
        .single();
      if (error) {
        mediaLibraryMessage = 'Metadata save failed. Check RLS and Phase 11 schema.';
      } else {
        Object.assign(asset, data || payload);
        mediaLibraryMessage = 'Metadata saved.';
        await insertMediaAuditLog('media_metadata_update', asset.id, payload);
      }
    } catch (error) {
      mediaLibraryMessage = 'Metadata save failed. Supabase connection error.';
    }
    renderDashboard();
    setTimeout(bindMediaUploadAreaEvents, 0);
    setTimeout(bindMediaLibraryEvents, 0);
  }

  async function archiveMediaAsset(assetId) {
    const asset = mediaAssets.find(item => item.id === assetId);
    if (!asset || adminProfile?.role !== 'owner') return;
    const usage = getMediaUsage(asset);
    if (usage.some(item => item.status === 'published' && item.is_visible !== false)) {
      mediaLibraryMessage = 'Archive blocked: asset is used by visible published content.';
      renderDashboard();
      return;
    }
    if (!mediaSchemaSupportsManagement) {
      mediaLibraryMessage = 'Archive requires supabase/phase-11-media-asset-management.sql.';
      renderDashboard();
      return;
    }
    const nextArchived = !asset.is_archived;
    if (!window.confirm(`${nextArchived ? 'Archive' : 'Unarchive'} this media asset? Existing published URLs will not be removed.`)) return;
    const { error } = await supabaseClient
      .from('cms_media_assets')
      .update({ is_archived: nextArchived, updated_at: new Date().toISOString() })
      .eq('id', asset.id);
    if (error) mediaLibraryMessage = 'Archive update failed. Check RLS.';
    else {
      asset.is_archived = nextArchived;
      mediaLibraryMessage = nextArchived ? 'Asset archived.' : 'Asset unarchived.';
      await insertMediaAuditLog(nextArchived ? 'media_archive' : 'media_unarchive', asset.id, { storage_path: asset.storage_path });
    }
    renderDashboard();
    setTimeout(bindMediaLibraryEvents, 0);
  }

  async function deleteMediaAsset(assetId) {
    const asset = mediaAssets.find(item => item.id === assetId);
    if (!asset || adminProfile?.role !== 'owner') return;
    const usage = getMediaUsage(asset);
    if (usage.length) {
      mediaLibraryMessage = 'Delete blocked: this asset is referenced by custom sections.';
      renderDashboard();
      return;
    }
    const phrase = `DELETE ${asset.file_name || asset.id}`;
    const answer = window.prompt(`Permanent delete removes the database record and Storage object. Type "${phrase}" to continue.`);
    if (answer !== phrase) return;
    let storageError = null;
    if (asset.storage_path) {
      const storageResult = await supabaseClient.storage.from('cms-media').remove([asset.storage_path]);
      storageError = storageResult.error;
    }
    if (storageError) {
      mediaLibraryMessage = 'Storage delete failed. Database record was not removed.';
      renderDashboard();
      return;
    }
    const { error } = await supabaseClient.from('cms_media_assets').delete().eq('id', asset.id);
    if (error) mediaLibraryMessage = 'Asset delete failed. Check owner role and RLS.';
    else {
      mediaAssets = mediaAssets.filter(item => item.id !== asset.id);
      delete mediaAssetUsage[asset.id];
      if (mediaDetailAssetId === asset.id) mediaDetailAssetId = null;
      mediaLibraryMessage = 'Unused asset permanently deleted.';
      await insertMediaAuditLog('media_delete', asset.id, { storage_path: asset.storage_path });
    }
    renderDashboard();
    setTimeout(bindMediaLibraryEvents, 0);
  }

  async function copyMediaUrl(url) {
    if (!url) return;
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      dashboardMessage = 'Copy not available in this browser context.';
      renderDashboard();
      setTimeout(bindMediaUploadAreaEvents, 0);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      dashboardMessage = 'URL copied to clipboard.';
    } catch (e) {
      dashboardMessage = 'Copy failed. Check browser clipboard permission.';
    }
    renderDashboard();
    setTimeout(bindMediaUploadAreaEvents, 0);
  }

  function renderImageInspector(element) {
    const key = element.dataset.editKey || '';
    const type = element.dataset.editType || 'image';
    const sectionId = element.dataset.sectionId || '';
    const draftRow = draftRows[key];
    const publishedRow = publishedRows[key];
    const draftVal = getImageValueFromRow(draftRow) || {};
    const publishedVal = getImageValueFromRow(publishedRow) || {};
    const currentSrc = type === 'background-image'
      ? (element.dataset.mediaCurrentUrl || element.style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, ''))
      : (element.getAttribute('src') || '');
    const currentAlt = element.getAttribute ? (element.getAttribute('alt') || '') : '';
    const previewUrl = draftVal.url || currentSrc || '';
    $('[data-admin-panel-title]', panel).textContent = draftRow ? 'Editing image draft' : 'Editing image field';
    $('[data-admin-panel-body]', panel).innerHTML = `
      <div class="gv-admin-meta">
        <div>Edit key: <code>${escapeHtml(key)}</code></div>
        <div>Edit type: <code>${escapeHtml(type)}</code></div>
        <div>Section: <code>${escapeHtml(sectionId || 'none')}</code></div>
        <div>Draft override: <code>${draftRow ? 'yes' : 'no'}</code></div>
      </div>
      <div class="gv-admin-image-preview-wrap">
        ${previewUrl && isSafeImageUrl(previewUrl)
          ? `<img class="gv-admin-image-preview" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(currentAlt)}" data-image-preview>`
          : '<div class="gv-admin-image-placeholder">No image set</div>'}
      </div>
      <div class="gv-admin-value-stack">
        <div><strong>Published URL</strong><span>${escapeHtml(publishedVal.url || 'No published override')}</span></div>
        <div><strong>Draft URL</strong><span>${escapeHtml(draftVal.url || 'No draft override')}</span></div>
      </div>
      <div class="gv-admin-field">
        <label for="gvImageUrl">Image URL</label>
        <input id="gvImageUrl" type="text" value="${escapeHtml(draftVal.url || currentSrc || '')}" placeholder="https://&hellip;">
      </div>
      <div class="gv-admin-field">
        <label for="gvImageAlt">Alt text</label>
        <input id="gvImageAlt" type="text" value="${escapeHtml(draftVal.alt !== undefined ? draftVal.alt : currentAlt)}" placeholder="Describe the image">
      </div>
      <input type="file" id="gvImageFileInput" accept="image/jpeg,image/png,image/webp" style="position:absolute;opacity:0;width:0;height:0;pointer-events:none;" data-admin-image-file-input>
      <p class="gv-admin-note" data-image-save-state>Select from library or paste a URL, then Save Draft Image.</p>
      <div class="gv-admin-panel-actions" style="grid-template-columns:1fr 1fr;">
        <button class="gv-admin-action" type="button" data-admin-action="image-choose-media">Media Library</button>
        <button class="gv-admin-action" type="button" data-admin-action="image-upload-new">Upload New</button>
      </div>
      <div class="gv-admin-panel-actions">
        <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="image-save-draft">Save Draft</button>
        <button class="gv-admin-action" type="button" data-admin-action="image-reset-draft">Reset</button>
        <button class="gv-admin-action" type="button" data-admin-action="close-panel">Close</button>
      </div>
      <div class="gv-admin-divider"></div>
      ${renderSectionNavigator(getRegistry())}
    `;
    bindImageInspectorFileInput();
    bindImageUrlLivePreview();
  }

  function bindImageUrlLivePreview() {
    const urlInput = $('#gvImageUrl', panel);
    if (!urlInput) return;
    urlInput.addEventListener('input', () => {
      const url = urlInput.value.trim();
      if (!isSafeImageUrl(url)) return;
      const existing = $('[data-image-preview]', panel);
      const wrap = $('.gv-admin-image-preview-wrap', panel);
      if (existing) { existing.src = url; }
      else if (wrap) { setAdminImagePreview(wrap, url, ''); }
    });
  }

  function bindImageInspectorFileInput() {
    const fi = $('#gvImageFileInput', panel);
    if (!fi || fi._bound) return;
    fi._bound = true;
    fi.addEventListener('change', () => { if (fi.files && fi.files[0]) handleInspectorImageUpload(fi.files[0]); });
  }

  async function handleInspectorImageUpload(file) {
    const note = $('[data-image-save-state]', panel);
    if (note) note.textContent = 'Uploading…';
    const result = await uploadMediaFile(file);
    if (result.error) { if (note) note.textContent = 'Upload failed: ' + result.error; return; }
    const asset = result.data;
    if (asset && asset.public_url) {
      const urlInput = $('#gvImageUrl', panel);
      if (urlInput) urlInput.value = asset.public_url;
      mediaSelectedAssetId = asset.id;
      mediaAssets.unshift(asset);
      const wrap = $('.gv-admin-image-preview-wrap', panel);
      if (wrap && isSafeImageUrl(asset.public_url)) {
        setAdminImagePreview(wrap, asset.public_url, '');
      }
      if (note) note.textContent = 'Uploaded: ' + asset.file_name + '. Click Save Draft Image to apply.';
    }
  }

  async function saveImageDraft() {
    if (!selectedElement) return;
    const key = selectedElement.dataset.editKey;
    const type = selectedElement.dataset.editType || 'image';
    const urlInput = $('#gvImageUrl', panel);
    const altInput = $('#gvImageAlt', panel);
    const note = $('[data-image-save-state]', panel);
    const url = urlInput ? urlInput.value.trim() : '';
    const alt = altInput ? altInput.value.trim() : '';
    if (url && !isSafeImageUrl(url)) {
      if (note) note.textContent = 'Invalid URL. Only Supabase storage, https://, or relative paths allowed.';
      return;
    }
    const valueJson = { url: url, alt: alt, media_asset_id: mediaSelectedAssetId || null, field: type === 'background-image' ? 'background-image' : 'src' };
    applyImageValueToElement(selectedElement, valueJson);
    if (note) note.textContent = 'Saving…';
    if (isMockAdminSession()) {
      mockDraft[key] = url;
      saveMockDraft();
      draftRows[key] = { page_path: pagePath, page_id: getRegistry().pageId || '', edit_key: key, edit_type: type, section_id: selectedElement.dataset.sectionId || '', value_text: url, value_json: valueJson, status: 'draft' };
      if (note) note.textContent = 'Image draft saved (mock mode).';
      logCmsMediaDebug('image-draft-save-mock', { key: key, url: url });
      renderImageInspector(selectedElement);
      return;
    }
    if (!supabaseClient || !currentUser || !adminProfile || !['owner', 'editor'].includes(adminProfile.role)) {
      if (note) note.textContent = adminProfile && adminProfile.role === 'viewer' ? 'Viewers cannot save image drafts.' : 'Image draft save requires owner or editor role.';
      return;
    }
    const payload = {
      page_path: pagePath, page_id: getRegistry().pageId || '',
      edit_key: key, edit_type: type,
      section_id: selectedElement.dataset.sectionId || '',
      section_type: (selectedElement.closest('[data-section-type]') || {}).dataset && (selectedElement.closest('[data-section-type]')).dataset.sectionType || '',
      value_text: url, value_json: valueJson, status: 'draft',
      updated_by: currentUser.id, updated_at: new Date().toISOString()
    };
    let data = null, error = null;
    try {
      const res = await supabaseClient.from('cms_content').upsert(payload, { onConflict: 'page_path,edit_key,status' }).select().single();
      data = res.data; error = res.error;
    } catch (e) { error = e; }
    if (error) { if (note) note.textContent = 'Image draft save failed. Check Supabase policies.'; return; }
    draftRows[key] = data || payload;
    await insertMediaAuditLog('image_draft_save', key, { url: url, alt: alt, media_asset_id: valueJson.media_asset_id });
    logCmsMediaDebug('image-draft-save-ok', { key: key, url: url });
    if (note) note.textContent = 'Image draft saved.';
    updateTopbar();
    renderImageInspector(selectedElement);
  }

  async function resetImageDraft() {
    if (!selectedElement) return;
    const key = selectedElement.dataset.editKey;
    const note = $('[data-image-save-state]', panel);
    if (!window.confirm('Reset this image draft? Published image will not be deleted.')) return;
    if (mockAdminEnabled && !supabaseClient) {
      delete mockDraft[key]; delete draftRows[key]; saveMockDraft();
      restoreImageFromPublishedOrOriginal(key);
      renderImageInspector(selectedElement);
      return;
    }
    if (supabaseClient && currentUser && adminProfile && ['owner', 'editor'].includes(adminProfile.role)) {
      try {
        const res = await supabaseClient.from('cms_content').delete().eq('page_path', pagePath).eq('edit_key', key).eq('status', 'draft');
        if (res.error) { if (note) note.textContent = 'Reset failed. Check Supabase policies.'; return; }
        await insertMediaAuditLog('image_reset', key, { previous_url: draftRows[key] ? draftRows[key].value_text || '' : '' });
      } catch (e) { if (note) note.textContent = 'Reset failed. Supabase connection error.'; return; }
    } else if (adminProfile && adminProfile.role === 'viewer') {
      if (note) note.textContent = 'Viewers cannot reset image drafts.';
      return;
    }
    delete draftRows[key];
    restoreImageFromPublishedOrOriginal(key);
    updateTopbar();
    renderImageInspector(selectedElement);
  }

  function restoreImageFromPublishedOrOriginal(key) {
    if (!selectedElement) return;
    const publishedRow = publishedRows[key];
    const publishedVal = getImageValueFromRow(publishedRow);
    if (publishedVal && publishedVal.url && isSafeImageUrl(publishedVal.url)) {
      applyImageValueToElement(selectedElement, publishedVal);
    } else {
      const origSrc = selectedElement.dataset.adminOriginalSrc || '';
      const origAlt = selectedElement.dataset.adminOriginalAlt || '';
      if (selectedElement.tagName === 'IMG') {
        if (origSrc) selectedElement.setAttribute('src', origSrc);
        selectedElement.setAttribute('alt', origAlt);
      } else if (selectedElement.dataset.editType === 'background-image' && origSrc) {
        selectedElement.style.backgroundImage = 'url("' + origSrc.replace(/"/g, '%22') + '")';
      }
    }
  }

  function applyImageValueToElement(element, valueJson) {
    if (!element || !valueJson) return;
    const url = valueJson.url || '';
    const alt = typeof valueJson.alt === 'string' ? valueJson.alt : '';
    const type = element.dataset.editType || 'image';
    if (url && !isSafeImageUrl(url)) return;
    if (type === 'background-image') {
      if (!element.dataset.mediaCurrentUrl) element.dataset.mediaCurrentUrl = element.style.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '');
      if (url) element.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
      element.dataset.mediaCurrentUrl = url;
    } else {
      if (!element.dataset.adminOriginalSrc) element.dataset.adminOriginalSrc = element.getAttribute('src') || '';
      if (!element.dataset.adminOriginalAlt) element.dataset.adminOriginalAlt = element.getAttribute('alt') || '';
      if (url) element.setAttribute('src', url);
      element.setAttribute('alt', alt);
    }
  }

  async function applyPublishedImageEdits() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('cms_content')
        .select('edit_key,edit_type,value_text,value_json,status')
        .eq('page_path', pagePath)
        .eq('status', 'published')
        .in('edit_type', ['image', 'background-image'])
        .lt('created_at', cmsFreshReadCutoff());
      if (error || !Array.isArray(data)) return;
      let count = 0;
      data.forEach(row => {
        const element = document.querySelector('[data-edit-key="' + cssEscape(row.edit_key) + '"]');
        if (!element) return;
        const val = getImageValueFromRow(row) || (row.value_text ? { url: row.value_text, alt: '' } : null);
        if (val && val.url && isSafeImageUrl(val.url)) {
          applyImageValueToElement(element, val);
          publishedRows[row.edit_key] = row;
          count++;
        }
      });
      logCmsMediaDebug('hydration-ok', { count: count });
    } catch (e) { /* best-effort */ }
  }

  function logCmsMediaDebug(context, extra) {
    if (!cmsDebug) return;
    console.info('[GROWVA CMS Media Debug]', Object.assign({
      context: context,
      supabase_configured: supabaseState.configured,
      media_assets_count: mediaAssets.length,
      media_library_loaded: mediaLibraryLoaded,
      selected_asset_id: mediaSelectedAssetId
    }, extra || {}));
  }

  // ── Phase 7: Safety + sanitization ──────────────────────────────────────

  function sanitizeColorValue(v) {
    if (typeof v !== 'string') return null;
    v = v.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
    if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*[\d.]+)?\s*\)$/.test(v)) return v;
    if (/^hsl/.test(v)) return null;
    return null;
  }

  function sanitizeSizeValue(v) {
    if (typeof v !== 'string') return null;
    v = v.trim();
    if (/^-?\d+(\.\d+)?(px|rem|em|%|vw|vh)$/.test(v)) return v;
    if (/^\d+$/.test(v)) return v + 'px';
    return null;
  }

  function sanitizeStyleValue(prop, v) {
    if (typeof v !== 'string') return null;
    v = v.trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) return null;
    if (prop === 'fontFamily') {
      const clean = v.replace(/['"]/g, '').trim();
      return SAFE_FONTS.includes(clean) ? clean : null;
    }
    if (prop === 'fontWeight') return SAFE_FONT_WEIGHTS.has(v) ? v : null;
    if (prop === 'textAlign') return SAFE_TEXT_ALIGNS.has(v) ? v : null;
    if (['color','backgroundColor','borderColor'].includes(prop)) return sanitizeColorValue(v);
    if (['opacity'].includes(prop)) {
      const n = parseFloat(v);
      return (!isNaN(n) && n >= 0 && n <= 1) ? String(n) : null;
    }
    return sanitizeSizeValue(v);
  }

  function sanitizeCssVarValue(v) {
    if (typeof v !== 'string') return null;
    v = v.trim();
    const asColor = sanitizeColorValue(v);
    if (asColor) return asColor;
    const asSize = sanitizeSizeValue(v);
    if (asSize) return asSize;
    const clean = v.replace(/['"]/g, '').trim();
    if (SAFE_FONTS.includes(clean)) return clean;
    return null;
  }

  // ── Phase 7: CSS token application ───────────────────────────────────────

  function applyTokenToRoot(tokenKey, valueJson) {
    if (!tokenKey || !valueJson) return;
    const v = valueJson.value !== undefined ? valueJson.value : valueJson;
    if (typeof v !== 'string') return;
    const safe = sanitizeCssVarValue(String(v));
    if (safe !== null) {
      document.documentElement.style.setProperty('--' + tokenKey, safe);
    }
  }

  function applyAllDraftTokensPreview() {
    Object.entries(designTokenDrafts).forEach(([key, val]) => applyTokenToRoot(key, val));
  }

  async function applyPublishedDesignTokens() {
    if (!supabaseClient) return;
    try {
      const now = cmsFreshReadCutoff();
      const { data } = await supabaseClient
        .from('cms_design_tokens')
        .select('token_key,value_json,scope,page_path')
        .eq('status', 'published')
        .lt('created_at', now);
      if (!data) return;
      const globalRows = data.filter(r => r.scope === 'global');
      const pageRows = data.filter(r => r.scope === 'page' && r.page_path === pagePath);
      [...globalRows, ...pageRows].forEach(r => applyTokenToRoot(r.token_key, r.value_json));
      designTokenPublished = {};
      data.forEach(r => { designTokenPublished[r.token_key] = r.value_json; });
      logCmsVisualDebug('tokens-hydrated', { count: data.length });
    } catch (e) { logCmsVisualDebug('tokens-hydrate-error', { error: String(e) }); }
  }

  async function applyPublishedSectionSettings() {
    if (!supabaseClient) return;
    try {
      const now = cmsFreshReadCutoff();
      const { data } = await supabaseClient
        .from('cms_section_settings')
        .select('section_id,is_visible,order_index,style_json')
        .eq('status', 'published')
        .eq('page_path', pagePath)
        .lt('created_at', now);
      if (!data) return;
      sectionSettingsPublished = {};
      data.forEach(r => { sectionSettingsPublished[r.section_id] = r; });
      applySectionOrder(data);
      data.forEach(r => {
        const el = $(`[data-section-id="${r.section_id}"]`);
        if (!el) return;
        el.style.display = r.is_visible === false ? 'none' : '';
        if (r.style_json) applySectionStyleJson(el, r.style_json);
      });
      logCmsVisualDebug('sections-hydrated', { count: data.length });
    } catch (e) { logCmsVisualDebug('sections-hydrate-error', { error: String(e) }); }
  }

  async function applyPublishedElementStyles() {
    if (!supabaseClient) return;
    try {
      const now = cmsFreshReadCutoff();
      const { data } = await supabaseClient
        .from('cms_element_styles')
        .select('edit_key,style_json')
        .eq('status', 'published')
        .eq('page_path', pagePath)
        .lt('created_at', now);
      if (!data) return;
      elementStylesPublished = {};
      data.forEach(r => {
        elementStylesPublished[r.edit_key] = r.style_json;
        // Phase 17: VD breakpoint rows are handled via CSS injection (see below).
        // Legacy-only rows (no breakpoint keys) still use inline application for
        // backward compatibility and single-breakpoint correctness.
        if (r.style_json && !vd17HasBreakpointFormat(r.style_json)) {
          const el = $(`[data-edit-key="${r.edit_key}"]`);
          if (el) applyElementStyleJson(el, r.style_json);
        }
      });
      // Phase 17: inject responsive CSS rules for VD-format published rows
      vd17InjectPublishedCSS();
      logCmsVisualDebug('element-styles-hydrated', { count: data.length });
    } catch (e) { logCmsVisualDebug('element-styles-hydrate-error', { error: String(e) }); }
  }

  function applySectionStyleJson(el, styleJson) {
    if (!el || typeof styleJson !== 'object') return;
    Object.entries(styleJson).forEach(([prop, val]) => {
      const safe = sanitizeStyleValue(prop, String(val));
      if (safe !== null) el.style[prop] = safe;
    });
  }

  function applyElementStyleJson(el, styleJson) {
    if (!el || typeof styleJson !== 'object') return;
    // Legacy format: { styles: { prop: val } }
    if (styleJson.styles && typeof styleJson.styles === 'object') {
      Object.entries(styleJson.styles).forEach(([prop, val]) => {
        const safe = sanitizeStyleValue(prop, String(val));
        if (safe !== null && safe !== '') el.style[prop] = safe;
      });
    }
    // Phase 16 VD format: { desktop: {}, tablet: {}, mobile: {} }
    // Apply desktop styles as the base (tablet/mobile require admin breakpoint switching)
    if (styleJson.desktop && typeof styleJson.desktop === 'object') {
      Object.entries(styleJson.desktop).forEach(([prop, val]) => {
        const safe = vdSanitizeStyleValue(prop, String(val));
        if (safe !== null && safe !== '') el.style[prop] = safe;
      });
    }
  }

  // Phase 8: safe custom section rendering

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function getTemplate(templateId) {
    return CUSTOM_SECTION_TEMPLATES[templateId] || null;
  }

  function makeCustomSectionId(templateId) {
    const safe = String(templateId || 'section').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return `custom.${safe}.${Date.now()}`;
  }

  function normalizeCustomSectionRow(row, statusFallback) {
    if (!row || !getTemplate(row.template_id)) return null;
    const template = getTemplate(row.template_id);
    return {
      page_path: row.page_path || pagePath,
      section_id: row.section_id || makeCustomSectionId(row.template_id),
      section_type: row.section_type || template.sectionType,
      template_id: row.template_id,
      title: sanitizeText(row.title || template.label),
      content_json: sanitizeCustomContent(row.template_id, row.content_json || template.defaults),
      style_json: sanitizeCustomStyle(row.style_json || {}),
      order_index: Number.isFinite(Number(row.order_index)) ? Number(row.order_index) : getSections().length,
      is_visible: row.is_visible !== false,
      status: row.status || statusFallback || 'draft',
      updated_by: row.updated_by || (currentUser ? currentUser.id : null)
    };
  }

  function sanitizeCustomContent(templateId, content) {
    const defaults = cloneJson(getTemplate(templateId)?.defaults || {});
    const source = Object.assign(defaults, content && typeof content === 'object' ? content : {});
    const cleanText = value => sanitizeText(value).slice(0, 800);
    const cleanUrl = value => {
      const url = sanitizeText(value).slice(0, 240);
      return isSafeCustomLink(url) ? url : '';
    };
    const cleanImageUrl = value => {
      const url = sanitizeText(value).slice(0, 600);
      return url && isSafeImageUrl(url) ? url : '';
    };
    const cleanAssetId = value => sanitizeText(value).slice(0, 80);
    const cleanAlt = value => sanitizeText(value).slice(0, 180);
    const cleanImageFields = value => ({
      image_asset_id: cleanAssetId(value?.image_asset_id),
      image_url: cleanImageUrl(value?.image_url),
      image_alt: cleanAlt(value?.image_alt)
    });
    const cleanItemText = value => cleanText(value).slice(0, 180);
    if (templateId === 'simple_text') {
      return { eyebrow: cleanText(source.eyebrow), heading: cleanText(source.heading), body: cleanText(source.body), buttonLabel: cleanText(source.buttonLabel), buttonLink: cleanUrl(source.buttonLink), ...cleanImageFields(source), image_position: CUSTOM_SECTION_IMAGE_POSITIONS.has(source.image_position) ? source.image_position : 'right' };
    }
    if (templateId === 'cta') {
      const overlay = Number(source.overlay_strength);
      return { heading: cleanText(source.heading), body: cleanText(source.body), primaryLabel: cleanText(source.primaryLabel), primaryLink: cleanUrl(source.primaryLink), secondaryLabel: cleanText(source.secondaryLabel), secondaryLink: cleanUrl(source.secondaryLink), ...cleanImageFields(source), overlay_strength: Number.isFinite(overlay) ? String(Math.max(0, Math.min(0.85, overlay))) : '0.45' };
    }
    if (templateId === 'feature_cards') {
      return { eyebrow: cleanText(source.eyebrow), heading: cleanText(source.heading), cards: sanitizeArray(source.cards, 6).map(item => ({ title: cleanItemText(item.title), description: cleanText(item.description), iconLabel: cleanItemText(item.iconLabel), ...cleanImageFields(item) })) };
    }
    if (templateId === 'stats') {
      return { heading: cleanText(source.heading), stats: sanitizeArray(source.stats, 6).map(item => ({ value: cleanItemText(item.value), label: cleanItemText(item.label) })) };
    }
    if (templateId === 'faq') {
      return { heading: cleanText(source.heading), questions: sanitizeArray(source.questions, 8).map(item => ({ question: cleanText(item.question), answer: cleanText(item.answer) })) };
    }
    if (templateId === 'project_highlight') {
      return { eyebrow: cleanText(source.eyebrow), heading: cleanText(source.heading), description: cleanText(source.description), projectTitle: cleanText(source.projectTitle), category: cleanText(source.category), metric: cleanText(source.metric), ctaLabel: cleanText(source.ctaLabel), ctaLink: cleanUrl(source.ctaLink), ...cleanImageFields(source) };
    }
    if (templateId === 'logo_strip') {
      return { heading: cleanText(source.heading), items: sanitizeArray(source.items, 12).map(item => typeof item === 'string' ? { label: cleanItemText(item), image_asset_id: '', image_url: '', image_alt: '' } : ({ label: cleanItemText(item.label), ...cleanImageFields(item) })) };
    }
    return defaults;
  }

  function sanitizeArray(value, limit) {
    return Array.isArray(value) ? value.slice(0, limit) : [];
  }

  function sanitizeCustomStyle(styleJson) {
    const clean = {};
    if (!styleJson || typeof styleJson !== 'object') return clean;
    Object.entries(styleJson).forEach(([prop, value]) => {
      if (!CUSTOM_SECTION_STYLE_PROPS.has(prop)) return;
      const safe = sanitizeStyleValue(prop === 'cardBackground' ? 'backgroundColor' : prop === 'cardRadius' ? 'borderRadius' : prop, String(value));
      if (safe !== null) clean[prop] = safe;
    });
    return clean;
  }

  function isSafeCustomLink(value) {
    const href = String(value || '').trim();
    if (!href) return true;
    if (/^javascript:/i.test(href) || /^data:/i.test(href)) return false;
    if (href.startsWith('#') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) return true;
    if (/^[a-z0-9/_-]+\.html(?:[#?].*)?$/i.test(href)) return true;
    if (/^https:\/\/[^\s]+$/i.test(href)) return true;
    if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(href)) return true;
    return false;
  }

  function getCustomSectionRowsForRender(includeDrafts) {
    const rows = {};
    Object.values(customSectionPublished).forEach(row => { rows[row.section_id] = row; });
    if (includeDrafts) Object.values(customSectionDrafts).forEach(row => { rows[row.section_id] = row; });
    return Object.values(rows)
      .filter(row => row && row.is_visible !== false && getTemplate(row.template_id))
      .sort((a, b) => (a.order_index ?? 9999) - (b.order_index ?? 9999));
  }

  function getCustomSectionHost() {
    return document.querySelector('main') || document.body;
  }

  function renderCustomSections(rows) {
    const host = getCustomSectionHost();
    if (!host) return 0;
    $all('[data-custom-section="true"]', host).forEach(section => section.remove());
    let rendered = 0;
    rows.forEach(row => {
      const normalized = normalizeCustomSectionRow(row, row.status);
      if (!normalized || normalized.is_visible === false) {
        logCmsCustomDebug('custom-section-skipped', { sectionId: row?.section_id || '', templateId: row?.template_id || '' });
        return;
      }
      host.appendChild(buildCustomSectionElement(normalized));
      rendered++;
    });
    refreshContentRegistry();
    applyCurrentSectionOrder();
    refreshScrollLayout();
    logCmsCustomDebug('custom-sections-rendered', { count: rendered });
    return rendered;
  }

  function renderCustomSectionsForAdmin() {
    renderCustomSections(getCustomSectionRowsForRender(true));
  }

  function buildCustomSectionElement(row) {
    const section = document.createElement('section');
    section.className = `gv-custom-section gv-custom-section--${row.template_id.replace(/_/g, '-')}`;
    section.dataset.customSection = 'true';
    section.dataset.sectionId = row.section_id;
    section.dataset.sectionType = row.section_type;
    section.dataset.templateId = row.template_id;
    section.dataset.pageId = getRegistry().pageId || '';
    applyCustomSectionStyle(section, row.style_json || {});
    const inner = document.createElement('div');
    inner.className = 'gv-custom-section__inner';
    section.appendChild(inner);
    appendCustomTemplateContent(inner, row);
    return section;
  }

  function applyCustomSectionStyle(section, styleJson) {
    const clean = sanitizeCustomStyle(styleJson);
    Object.entries(clean).forEach(([prop, value]) => {
      if (prop === 'cardBackground') section.style.setProperty('--gv-custom-card-bg', value);
      else if (prop === 'cardRadius') section.style.setProperty('--gv-custom-card-radius', value);
      else section.style[prop] = value;
    });
  }

  function customField(section, tagName, className, fieldName, value, editType = 'text') {
    const el = document.createElement(tagName);
    el.className = className;
    el.textContent = sanitizeText(value);
    el.dataset.editKey = `${section.section_id}.${fieldName}`;
    el.dataset.editType = editType;
    el.dataset.sectionId = section.section_id;
    el.dataset.pageId = getRegistry().pageId || '';
    return el;
  }

  function customLink(section, label, href, className) {
    const a = document.createElement('a');
    a.className = className;
    a.textContent = sanitizeText(label);
    a.href = isSafeCustomLink(href) && href ? href : '#';
    a.dataset.editKey = `${section.section_id}.${className.replace(/[^a-z0-9]+/gi, '_')}`;
    a.dataset.editType = 'link';
    a.dataset.sectionId = section.section_id;
    return a;
  }

  function createCustomImage(url, alt, className) {
    if (!url || !isSafeImageUrl(url)) return null;
    const img = document.createElement('img');
    img.className = className;
    img.src = url;
    img.alt = sanitizeText(alt || '');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      const wrap = img.closest('.gv-custom-image-wrap, .gv-custom-card-media, .gv-custom-logo-media');
      if (wrap) wrap.classList.add('is-broken');
      img.remove();
    }, { once: true });
    return img;
  }

  function appendCustomImage(parent, url, alt, wrapClass, imageClass) {
    const img = createCustomImage(url, alt, imageClass || 'gv-custom-image');
    if (!img) return null;
    const wrap = document.createElement('div');
    wrap.className = wrapClass || 'gv-custom-image-wrap';
    wrap.appendChild(img);
    parent.appendChild(wrap);
    return wrap;
  }

  function appendCustomTemplateContent(root, section) {
    const c = sanitizeCustomContent(section.template_id, section.content_json);
    if (section.template_id === 'simple_text') {
      root.classList.add(`gv-custom-section__inner--image-${c.image_position || 'right'}`);
      const copy = document.createElement('div');
      copy.className = 'gv-custom-copy';
      copy.append(customField(section, 'p', 'gv-custom-eyebrow', 'eyebrow', c.eyebrow));
      copy.append(customField(section, 'h2', 'gv-custom-heading', 'heading', c.heading));
      copy.append(customField(section, 'p', 'gv-custom-body', 'body', c.body, 'richtext'));
      copy.append(customLink(section, c.buttonLabel, c.buttonLink, 'gv-custom-button'));
      const image = appendCustomImage(document.createElement('div'), c.image_url, c.image_alt, 'gv-custom-image-wrap', 'gv-custom-image');
      if (image && c.image_position !== 'background') {
        if (c.image_position === 'left' || c.image_position === 'top') root.append(image, copy);
        else root.append(copy, image);
      } else {
        root.append(copy);
        if (image && c.image_position === 'background') {
          image.classList.add('gv-custom-image-wrap--background');
          root.prepend(image);
        }
      }
    } else if (section.template_id === 'cta') {
      if (c.image_url && isSafeImageUrl(c.image_url)) {
        const bg = appendCustomImage(root, c.image_url, c.image_alt, 'gv-custom-image-wrap gv-custom-image-wrap--background', 'gv-custom-image');
        if (bg) {
          const overlay = document.createElement('span');
          overlay.className = 'gv-custom-image-overlay';
          overlay.style.opacity = String(Math.max(0, Math.min(0.85, Number(c.overlay_strength) || 0.45)));
          bg.appendChild(overlay);
        }
      }
      root.append(customField(section, 'h2', 'gv-custom-heading', 'heading', c.heading));
      root.append(customField(section, 'p', 'gv-custom-body', 'body', c.body, 'richtext'));
      const actions = document.createElement('div');
      actions.className = 'gv-custom-actions';
      actions.append(customLink(section, c.primaryLabel, c.primaryLink, 'gv-custom-button'));
      actions.append(customLink(section, c.secondaryLabel, c.secondaryLink, 'gv-custom-link'));
      root.append(actions);
    } else if (section.template_id === 'feature_cards') {
      root.append(customField(section, 'p', 'gv-custom-eyebrow', 'eyebrow', c.eyebrow));
      root.append(customField(section, 'h2', 'gv-custom-heading', 'heading', c.heading));
      const grid = document.createElement('div');
      grid.className = 'gv-custom-card-grid';
      c.cards.forEach((card, index) => {
        const article = document.createElement('article');
        article.className = 'gv-custom-card';
        appendCustomImage(article, card.image_url, card.image_alt, 'gv-custom-card-media', 'gv-custom-card-image');
        article.append(customField(section, 'span', 'gv-custom-card-icon', `cards.${index}.iconLabel`, card.iconLabel));
        article.append(customField(section, 'h3', 'gv-custom-card-title', `cards.${index}.title`, card.title));
        article.append(customField(section, 'p', 'gv-custom-card-text', `cards.${index}.description`, card.description));
        grid.append(article);
      });
      root.append(grid);
    } else if (section.template_id === 'stats') {
      root.append(customField(section, 'h2', 'gv-custom-heading', 'heading', c.heading));
      const grid = document.createElement('div');
      grid.className = 'gv-custom-stats';
      c.stats.forEach((stat, index) => {
        const item = document.createElement('div');
        item.className = 'gv-custom-stat';
        item.append(customField(section, 'strong', 'gv-custom-stat-value', `stats.${index}.value`, stat.value));
        item.append(customField(section, 'span', 'gv-custom-stat-label', `stats.${index}.label`, stat.label));
        grid.append(item);
      });
      root.append(grid);
    } else if (section.template_id === 'faq') {
      root.append(customField(section, 'h2', 'gv-custom-heading', 'heading', c.heading));
      const list = document.createElement('div');
      list.className = 'gv-custom-faq-list';
      c.questions.forEach((item, index) => {
        const faq = document.createElement('article');
        faq.className = 'gv-custom-faq';
        faq.append(customField(section, 'h3', 'gv-custom-faq-question', `questions.${index}.question`, item.question));
        faq.append(customField(section, 'p', 'gv-custom-faq-answer', `questions.${index}.answer`, item.answer));
        list.append(faq);
      });
      root.append(list);
    } else if (section.template_id === 'project_highlight') {
      root.append(customField(section, 'p', 'gv-custom-eyebrow', 'eyebrow', c.eyebrow));
      root.append(customField(section, 'h2', 'gv-custom-heading', 'heading', c.heading));
      root.append(customField(section, 'p', 'gv-custom-body', 'description', c.description, 'richtext'));
      appendCustomImage(root, c.image_url, c.image_alt, 'gv-custom-project-image-wrap', 'gv-custom-project-image');
      const meta = document.createElement('div');
      meta.className = 'gv-custom-project-meta';
      meta.append(customField(section, 'strong', 'gv-custom-project-title', 'projectTitle', c.projectTitle));
      meta.append(customField(section, 'span', 'gv-custom-project-category', 'category', c.category));
      meta.append(customField(section, 'span', 'gv-custom-project-metric', 'metric', c.metric));
      root.append(meta);
      root.append(customLink(section, c.ctaLabel, c.ctaLink, 'gv-custom-button'));
    } else if (section.template_id === 'logo_strip') {
      root.append(customField(section, 'h2', 'gv-custom-heading', 'heading', c.heading));
      const strip = document.createElement('div');
      strip.className = 'gv-custom-logo-strip';
      c.items.forEach((item, index) => {
        const label = typeof item === 'string' ? item : item.label;
        const logo = document.createElement('span');
        logo.className = 'gv-custom-logo-item';
        logo.dataset.editKey = `${section.section_id}.items.${index}`;
        logo.dataset.editType = 'text';
        logo.dataset.sectionId = section.section_id;
        if (item && typeof item === 'object' && item.image_url) {
          appendCustomImage(logo, item.image_url, item.image_alt || label, 'gv-custom-logo-media', 'gv-custom-logo-image');
        }
        const fallback = document.createElement('span');
        fallback.className = 'gv-custom-logo-label';
        fallback.textContent = sanitizeText(label);
        logo.appendChild(fallback);
        strip.append(logo);
      });
      root.append(strip);
    }
  }

  function logCmsCustomDebug(context, extra = {}) {
    if (!cmsDebug) return;
    console.info('[GROWVA CMS Section Builder]', { context, page_path: pagePath, ...extra });
  }

  function applySectionOrder(rows) {
    const ordered = rows.slice().sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999));
    ordered.forEach(r => {
      const el = $(`[data-section-id="${r.section_id}"]`);
      if (el && el.parentElement) el.parentElement.appendChild(el);
    });
  }

  async function loadPublishedCustomSections() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('cms_custom_sections')
        .select('*')
        .eq('page_path', pagePath)
        .eq('status', 'published')
        .lt('created_at', cmsFreshReadCutoff());
      if (error || !Array.isArray(data)) {
        logCmsCustomDebug('custom-sections-fetch-failed', { status: 'published', error: getSupabaseErrorMessage(error) });
        return;
      }
      customSectionPublished = {};
      data.forEach(row => {
        const normalized = normalizeCustomSectionRow(row, 'published');
        if (normalized) customSectionPublished[normalized.section_id] = normalized;
        else logCmsCustomDebug('invalid-template-skipped', { templateId: row.template_id });
      });
      renderCustomSections(getCustomSectionRowsForRender(false));
      logCmsCustomDebug('custom-sections-loaded', { status: 'published', count: data.length });
    } catch (error) {
      logCmsCustomDebug('custom-sections-load-error', { status: 'published', error: String(error) });
    }
  }

  async function loadCustomSections() {
    if (isMockAdminSession()) {
      const rows = mockCustomSections[pagePath] || [];
      customSectionDrafts = {};
      customSectionPublished = {};
      rows.forEach(row => {
        const normalized = normalizeCustomSectionRow(row, row.status || 'draft');
        if (!normalized) return;
        if (normalized.status === 'published') customSectionPublished[normalized.section_id] = normalized;
        else customSectionDrafts[normalized.section_id] = normalized;
      });
      renderCustomSectionsForAdmin();
      return;
    }
    if (!supabaseClient || !currentUser || !adminProfile) return;
    try {
      const { data, error } = await supabaseClient
        .from('cms_custom_sections')
        .select('*')
        .eq('page_path', pagePath)
        .in('status', ['draft', 'published']);
      if (error || !Array.isArray(data)) {
        dashboardMessage = getCustomSectionsTableMessage(error);
        logCmsCustomDebug('custom-sections-fetch-failed', { status: 'all', error: getSupabaseErrorMessage(error) });
        return;
      }
      customSectionDrafts = {};
      customSectionPublished = {};
      data.forEach(row => {
        const normalized = normalizeCustomSectionRow(row, row.status);
        if (!normalized) {
          logCmsCustomDebug('invalid-template-skipped', { templateId: row.template_id });
          return;
        }
        if (normalized.status === 'draft') customSectionDrafts[normalized.section_id] = normalized;
        else customSectionPublished[normalized.section_id] = normalized;
      });
      renderCustomSectionsForAdmin();
      logCmsCustomDebug('custom-sections-loaded', { status: 'all', count: data.length });
    } catch (error) {
      logCmsCustomDebug('custom-sections-load-error', { status: 'all', error: String(error) });
    }
  }

  async function saveCustomSectionDraft(row) {
    const normalized = normalizeCustomSectionRow(Object.assign({}, row, { status: 'draft' }), 'draft');
    if (!normalized) return new Error('Invalid section template.');
    if (!['owner', 'editor'].includes(adminProfile?.role || (isMockAdminSession() ? 'owner' : ''))) return new Error('Only owners and editors can save section drafts.');
    if (isMockAdminSession()) {
      const rows = (mockCustomSections[pagePath] || []).filter(item => !(item.section_id === normalized.section_id && item.status === 'draft'));
      rows.push(normalized);
      mockCustomSections[pagePath] = rows;
      saveMockCustomSections();
      customSectionDrafts[normalized.section_id] = normalized;
      renderCustomSectionsForAdmin();
      return null;
    }
    if (!supabaseClient || !currentUser) return new Error('Supabase admin access is required.');
    const { error } = await supabaseClient
      .from('cms_custom_sections')
      .upsert(Object.assign({}, normalized, { updated_by: currentUser.id }), { onConflict: 'page_path,section_id,status' })
      .select()
      .single();
    if (!error) {
      customSectionDrafts[normalized.section_id] = normalized;
      renderCustomSectionsForAdmin();
    }
    return error || null;
  }

  function getSupabaseErrorMessage(error) {
    if (!error) return '';
    return String(error.message || error.details || error.code || error).slice(0, 240);
  }

  function getCustomSectionsTableMessage(error) {
    const message = getSupabaseErrorMessage(error);
    if (/not found|404|schema cache|cms_custom_sections/i.test(message)) {
      return 'Section Builder table is unavailable. Run supabase/phase-8-section-builder.sql, then refresh.';
    }
    if (/permission|policy|rls|denied/i.test(message)) {
      return 'Section Builder access was denied by Supabase RLS. Check admin role policies.';
    }
    return message ? `Section Builder load failed: ${message}` : 'Section Builder data could not be loaded.';
  }

  async function deleteCustomSectionDraft(sectionId) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!row) return;
    if (!['owner', 'editor'].includes(adminProfile?.role || (isMockAdminSession() ? 'owner' : ''))) {
      window.alert('Viewers can inspect sections but cannot delete drafts.');
      return;
    }
    if (!window.confirm('Delete this custom section draft? Published content is not removed.')) return;
    if (isMockAdminSession()) {
      mockCustomSections[pagePath] = (mockCustomSections[pagePath] || []).filter(item => !(item.section_id === sectionId && item.status === 'draft'));
      saveMockCustomSections();
      delete customSectionDrafts[sectionId];
      renderCustomSectionsForAdmin();
      logCmsCustomDebug('custom-section-deleted', { sectionId });
      return;
    }
    if (supabaseClient && currentUser) {
      await supabaseClient.from('cms_custom_sections')
        .delete()
        .eq('page_path', pagePath)
        .eq('section_id', sectionId)
        .eq('status', 'draft');
    }
    delete customSectionDrafts[sectionId];
    renderCustomSectionsForAdmin();
    logCmsCustomDebug('custom-section-deleted', { sectionId });
  }

  async function publishCustomSectionDrafts() {
    const drafts = Object.values(customSectionDrafts);
    if (!drafts.length) return { count: 0, error: null };
    if (isMockAdminSession()) {
      drafts.forEach(draft => {
        customSectionPublished[draft.section_id] = Object.assign({}, draft, { status: 'published' });
      });
      const nonPublished = (mockCustomSections[pagePath] || []).filter(row => row.status !== 'published');
      mockCustomSections[pagePath] = nonPublished.concat(Object.values(customSectionPublished));
      saveMockCustomSections();
      return { count: drafts.length, error: null };
    }
    if (!supabaseClient || !currentUser || !adminProfile || adminProfile.role !== 'owner') {
      return { count: 0, error: new Error('Only owners can publish custom sections.') };
    }
    const payload = drafts.map(row => Object.assign({}, row, {
      status: 'published',
      updated_by: currentUser.id,
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabaseClient
      .from('cms_custom_sections')
      .upsert(payload, { onConflict: 'page_path,section_id,status' });
    if (!error) payload.forEach(row => { customSectionPublished[row.section_id] = row; });
    return { count: payload.length, error };
  }

  // ── Phase 7: Supabase data loaders ───────────────────────────────────────

  async function loadDesignTokens() {
    if (!supabaseClient || !currentUser || !adminProfile) return;
    try {
      const { data } = await supabaseClient
        .from('cms_design_tokens')
        .select('token_key,value_json,scope,page_path,status')
        .in('status', ['draft', 'published'])
        .or(`scope.eq.global,page_path.eq.${pagePath}`);
      if (!data) return;
      designTokenDrafts = {};
      designTokenPublished = {};
      data.forEach(r => {
        if (r.status === 'draft') designTokenDrafts[r.token_key] = r.value_json;
        else if (r.status === 'published') designTokenPublished[r.token_key] = r.value_json;
      });
      applyAllDraftTokensPreview();
    } catch (e) { logCmsVisualDebug('load-tokens-error', { error: String(e) }); }
  }

  async function loadSectionSettings() {
    if (!supabaseClient || !currentUser || !adminProfile) return;
    try {
      const { data } = await supabaseClient
        .from('cms_section_settings')
        .select('section_id,order_index,is_visible,style_json,status')
        .eq('page_path', pagePath)
        .in('status', ['draft', 'published']);
      if (!data) return;
      sectionSettingsDrafts = {};
      sectionSettingsPublished = {};
      data.forEach(r => {
        if (r.status === 'draft') sectionSettingsDrafts[r.section_id] = r;
        else if (r.status === 'published') sectionSettingsPublished[r.section_id] = r;
      });
    } catch (e) { logCmsVisualDebug('load-sections-error', { error: String(e) }); }
  }

  async function loadElementStyles() {
    if (!supabaseClient || !currentUser || !adminProfile) return;
    try {
      const { data } = await supabaseClient
        .from('cms_element_styles')
        .select('edit_key,style_json,status')
        .eq('page_path', pagePath)
        .in('status', ['draft', 'published']);
      if (!data) return;
      elementStyleDrafts = {};
      elementStylesPublished = {};
      data.forEach(r => {
        if (r.status === 'draft') elementStyleDrafts[r.edit_key] = r.style_json;
        else if (r.status === 'published') elementStylesPublished[r.edit_key] = r.style_json;
        // Phase 16: hydrate VD style store from breakpoint-format drafts
        if (r.status === 'draft') vd16HydrateStoreEntry(r.edit_key, r.style_json);
      });
      // Phase 17: inject draft CSS for admin (admin-mode check is inside vd17InjectDraftCSS)
      vd17InjectDraftCSS();
    } catch (e) { logCmsVisualDebug('load-element-styles-error', { error: String(e) }); }
  }

  // ── Phase 7: Save / publish / reset ──────────────────────────────────────

  async function saveDesignTokenDraft(tokenKey, valueJson, scope) {
    if (!supabaseClient || !currentUser) return;
    const scopeVal = scope || 'page';
    const payload = {
      scope: scopeVal,
      page_path: scopeVal === 'global' ? null : pagePath,
      token_key: tokenKey,
      value_json: valueJson,
      status: 'draft',
      updated_by: currentUser.id
    };
    const { error } = await supabaseClient
      .from('cms_design_tokens')
      .upsert(payload, { onConflict: 'scope,page_path,token_key,status' });
    if (!error) {
      designTokenDrafts[tokenKey] = valueJson;
      unsavedVisualCount = Object.keys(designTokenDrafts).length;
    }
    return error;
  }

  async function saveSectionSettingDraft(sectionId, fields) {
    if (!supabaseClient || !currentUser) return;
    const existing = sectionSettingsDrafts[sectionId] || {};
    const payload = {
      page_path: pagePath,
      section_id: sectionId,
      order_index: fields.order_index ?? existing.order_index ?? 0,
      is_visible: fields.is_visible ?? existing.is_visible ?? true,
      style_json: fields.style_json ?? existing.style_json ?? {},
      status: 'draft',
      updated_by: currentUser.id
    };
    const { error } = await supabaseClient
      .from('cms_section_settings')
      .upsert(payload, { onConflict: 'page_path,section_id,status' });
    if (!error) sectionSettingsDrafts[sectionId] = payload;
    return error;
  }

  async function saveElementStyleDraftData(editKey, styleJson) {
    if (!supabaseClient || !currentUser) return;
    const payload = {
      page_path: pagePath,
      edit_key: editKey,
      section_id: selectedElement ? (selectedElement.dataset.sectionId || null) : null,
      style_json: styleJson,
      status: 'draft',
      updated_by: currentUser.id
    };
    const { error } = await supabaseClient
      .from('cms_element_styles')
      .upsert(payload, { onConflict: 'page_path,edit_key,status' });
    if (!error) elementStyleDrafts[editKey] = styleJson;
    return error;
  }

  async function saveAllTokenDrafts() {
    if (!canAdminEdit()) {
      logCmsVisualDebug('save-tokens-denied', { role: getAdminRole() });
      return;
    }
    const visualTab = $('[data-admin-panel-body]', dashboard);
    const inputs = visualTab ? $all('[data-token-key]', dashboard) : [];
    let count = 0;
    for (const inp of inputs) {
      const key = inp.dataset.tokenKey;
      const scope = inp.dataset.tokenScope || 'page';
      const v = inp.value.trim();
      const safe = sanitizeCssVarValue(v);
      if (safe !== null) {
        const err = await saveDesignTokenDraft(key, { value: safe }, scope);
        if (!err) count++;
      }
    }
    unsavedVisualCount = Object.keys(designTokenDrafts).length;
    logCmsVisualDebug('tokens-saved', { count });
    renderDashboard();
    setTimeout(bindVisualControlEvents, 0);
  }

  async function publishCurrentPageVisuals() {
    if (!supabaseClient || !currentUser || !adminProfile) return;
    if (adminProfile.role !== 'owner') {
      window.alert('Only owners can publish visual settings.');
      return;
    }
    const draftTokenKeys = Object.keys(designTokenDrafts);
    for (const key of draftTokenKeys) {
      const draft = designTokenDrafts[key];
      await supabaseClient.from('cms_design_tokens')
        .upsert({ scope: 'page', page_path: pagePath, token_key: key, value_json: draft, status: 'published', updated_by: currentUser.id },
          { onConflict: 'scope,page_path,token_key,status' });
    }
    const draftSecIds = Object.keys(sectionSettingsDrafts);
    for (const sid of draftSecIds) {
      const d = sectionSettingsDrafts[sid];
      await supabaseClient.from('cms_section_settings')
        .upsert({ ...d, status: 'published', updated_by: currentUser.id },
          { onConflict: 'page_path,section_id,status' });
    }
    const draftStyleKeys = Object.keys(elementStyleDrafts);
    for (const key of draftStyleKeys) {
      const d = elementStyleDrafts[key];
      await supabaseClient.from('cms_element_styles')
        .upsert({ page_path: pagePath, edit_key: key, style_json: d, status: 'published', updated_by: currentUser.id },
          { onConflict: 'page_path,edit_key,status' });
    }
    logCmsVisualDebug('page-visuals-published', { tokenCount: draftTokenKeys.length, sectionCount: draftSecIds.length, styleCount: draftStyleKeys.length });
    await loadDesignTokens();
    await loadSectionSettings();
    await loadElementStyles();
    // Phase 17: refresh published CSS now that element styles are published
    vd17InjectPublishedCSS();
    renderDashboard();
    setTimeout(bindVisualControlEvents, 0);
  }

  function initiateGlobalTokenPublish() {
    if (!adminProfile || adminProfile.role !== 'owner') {
      window.alert('Only owners can publish global tokens.');
      return;
    }
    globalTokenPublishPending = true;
    renderDashboard();
    setTimeout(bindVisualControlEvents, 0);
  }

  async function executeGlobalTokenPublish() {
    if (!supabaseClient || !currentUser || !adminProfile) return;
    if (adminProfile.role !== 'owner') return;
    const draftTokenKeys = Object.keys(designTokenDrafts);
    for (const key of draftTokenKeys) {
      const draft = designTokenDrafts[key];
      await supabaseClient.from('cms_design_tokens')
        .upsert({ scope: 'global', page_path: null, token_key: key, value_json: draft, status: 'published', updated_by: currentUser.id },
          { onConflict: 'scope,page_path,token_key,status' });
    }
    globalTokenPublishPending = false;
    logCmsVisualDebug('global-tokens-published', { count: draftTokenKeys.length });
    await loadDesignTokens();
    renderDashboard();
    setTimeout(bindVisualControlEvents, 0);
  }

  async function resetTokenDrafts() {
    if (!supabaseClient || !currentUser) return;
    await supabaseClient.from('cms_design_tokens')
      .delete()
      .eq('status', 'draft')
      .or(`scope.eq.global,page_path.eq.${pagePath}`);
    designTokenDrafts = {};
    unsavedVisualCount = 0;
    await applyPublishedDesignTokens();
    renderDashboard();
    setTimeout(bindVisualControlEvents, 0);
  }

  async function resetSectionDraft(sectionId) {
    if (!supabaseClient || !currentUser) return;
    await supabaseClient.from('cms_section_settings')
      .delete()
      .eq('page_path', pagePath)
      .eq('section_id', sectionId)
      .eq('status', 'draft');
    delete sectionSettingsDrafts[sectionId];
    const published = sectionSettingsPublished[sectionId];
    const el = $(`[data-section-id="${sectionId}"]`);
    if (el) {
      el.style.display = published ? (published.is_visible === false ? 'none' : '') : '';
      if (published && published.style_json) applySectionStyleJson(el, published.style_json);
    }
    renderDashboard();
    setTimeout(bindSectionManagerEvents, 0);
  }

  async function resetElementStyleFromInspector() {
    if (!selectedElement) return;
    const key = selectedElement.dataset.editKey;
    if (!key) return;
    if (supabaseClient && currentUser) {
      await supabaseClient.from('cms_element_styles')
        .delete()
        .eq('page_path', pagePath)
        .eq('edit_key', key)
        .eq('status', 'draft');
    }
    delete elementStyleDrafts[key];
    const el = selectedElement;
    ALLOWED_STYLE_PROPS.forEach(prop => { el.style[prop] = ''; });
    const published = elementStylesPublished[key];
    if (published) applyElementStyleJson(el, published);
    if (selectedElement) renderInspector(selectedElement);
  }

  // ── Phase 7: Section management ──────────────────────────────────────────

  function getSections() {
    return Array.from($all('[data-section-type][data-section-id]')).filter(el => !el.closest('[data-admin-ui]'));
  }

  function getSectionOrderValue(el, fallback) {
    if (!el) return fallback;
    const sid = el.dataset.sectionId || '';
    const custom = customSectionDrafts[sid] || customSectionPublished[sid];
    const setting = sectionSettingsDrafts[sid] || sectionSettingsPublished[sid];
    const value = custom?.order_index ?? setting?.order_index ?? el.dataset.sectionOrder;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function applyCurrentSectionOrder() {
    const sections = getSections();
    const groups = new Map();
    sections.forEach((section, index) => {
      const parent = section.parentElement;
      if (!parent) return;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push({ section, index });
    });
    groups.forEach(group => {
      group
        .sort((a, b) => getSectionOrderValue(a.section, a.index) - getSectionOrderValue(b.section, b.index))
        .forEach(item => item.section.parentElement && item.section.parentElement.appendChild(item.section));
    });
  }

  async function saveSectionOrderDraft(section, orderIndex) {
    const sid = section?.dataset?.sectionId || '';
    if (!sid) return;
    if (section.dataset.customSection === 'true') {
      const row = customSectionDrafts[sid] || customSectionPublished[sid];
      if (row) await saveCustomSectionDraft(Object.assign({}, row, { order_index: orderIndex, status: 'draft' }));
      return;
    }
    await saveSectionSettingDraft(sid, { order_index: orderIndex });
  }

  function isSectionProtected(el) {
    if (!el) return false;
    if (el.tagName === 'CANVAS') return true;
    if (el.dataset.gsap || el.dataset.scrolltrigger) return true;
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed' || style.position === 'sticky') return true;
    const knownProtectedClasses = ['lenis', 'gsap', 'scrolltrigger', 'three', 'webgl', 'catv-', 'pgi-', 'mega-menu', 'mobile-menu'];
    const cls = el.className || '';
    if (knownProtectedClasses.some(c => cls.toLowerCase().includes(c))) return true;
    return false;
  }

  async function moveSectionRelative(sectionId, direction) {
    if (!canAdminEdit()) return;
    const sections = getSections();
    const idx = sections.findIndex(s => s.dataset.sectionId === sectionId);
    if (idx < 0) return;
    const el = sections[idx];
    if (isSectionProtected(el)) {
      if (!window.confirm('This section may contain animations (GSAP/ScrollTrigger). Reordering it could break them. Continue?')) return;
    }
    const parent = el.parentElement;
    if (!parent) return;
    const siblingSections = sections.filter(section => section.parentElement === parent);
    const siblingIdx = siblingSections.findIndex(s => s.dataset.sectionId === sectionId);
    const swapIdx = siblingIdx + direction;
    if (swapIdx < 0 || swapIdx >= siblingSections.length) return;
    const swapEl = siblingSections[swapIdx];
    if (direction === -1) {
      parent.insertBefore(el, swapEl);
    } else {
      parent.insertBefore(swapEl, el);
    }
    const newSections = getSections().filter(section => section.parentElement === parent);
    for (let i = 0; i < newSections.length; i++) {
      await saveSectionOrderDraft(newSections[i], i);
    }
    applyCurrentSectionOrder();
    renderDashboard();
    setTimeout(bindSectionManagerEvents, 0);
  }

  async function toggleSectionVisibility(sectionId) {
    if (!canAdminEdit()) return;
    const el = $(`[data-section-id="${sectionId}"]`);
    if (!el) return;
    if (isSectionProtected(el)) {
      if (!window.confirm('This section may contain animations. Hiding it could affect the layout. Continue?')) return;
    }
    const currentlyVisible = el.style.display !== 'none';
    const newVisible = !currentlyVisible;
    el.style.display = newVisible ? '' : 'none';
    const err = await saveSectionSettingDraft(sectionId, { is_visible: newVisible });
    if (err) { el.style.display = currentlyVisible ? '' : 'none'; }
    renderDashboard();
    setTimeout(bindSectionManagerEvents, 0);
  }

  async function saveSectionDraftFromUI(sectionId) {
    if (!canAdminEdit()) {
      logCmsVisualDebug('save-section-denied', { role: getAdminRole() });
      return;
    }
    const container = $(`[data-section-style-panel="${sectionId}"]`, dashboard);
    if (!container) return;
    const styleJson = {};
    $all('[data-style-prop]', container).forEach(inp => {
      const prop = inp.dataset.styleProp;
      const v = inp.value.trim();
      const safe = sanitizeStyleValue(prop, v);
      if (safe !== null) styleJson[prop] = safe;
    });
    await saveSectionSettingDraft(sectionId, { style_json: styleJson });
    const el = $(`[data-section-id="${sectionId}"]`);
    if (el) applySectionStyleJson(el, styleJson);
    logCmsVisualDebug('section-draft-saved', { sectionId, styleJson });
  }

  async function saveInspectorStyleDraft() {
    if (!canAdminEdit()) {
      const state = $('[data-admin-save-state]', panel);
      if (state) state.textContent = 'Viewer access: style edits are disabled.';
      return;
    }
    if (!selectedElement) return;
    const key = selectedElement.dataset.editKey;
    if (!key) return;
    const styleInputs = $all('[data-style-prop]', panel);
    const styles = {};
    styleInputs.forEach(inp => {
      const prop = inp.dataset.styleProp;
      const v = inp.value.trim();
      const safe = sanitizeStyleValue(prop, String(v));
      if (safe !== null) styles[prop] = safe;
    });
    const styleJson = { styles };
    applyElementStyleJson(selectedElement, styleJson);
    const err = await saveElementStyleDraftData(key, styleJson);
    const state = $('[data-admin-save-state]', panel);
    if (state) state.textContent = err ? 'Save failed.' : 'Style draft saved.';
    logCmsVisualDebug('element-style-saved', { key, styles });
  }

  // ── Phase 7: Rendering — Visual Control tab ───────────────────────────────

  function renderVisualControlTab() {
    const subTabs = [
      ['tokens', 'Brand Tokens'],
      ['typography', 'Typography'],
      ['buttons', 'Buttons'],
      ['cards', 'Cards'],
      ['page-theme', 'Page Theme']
    ];
    const tabsHtml = subTabs.map(([id, label]) =>
      `<button type="button" class="gv-admin-subtab${visualControlTab === id ? ' is-active' : ''}" data-admin-action="visual-subtab" data-visual-tab="${id}">${label}</button>`
    ).join('');

    const confirmHtml = globalTokenPublishPending ? `
      <div class="gv-admin-confirm-banner">
        <strong>Publish all draft tokens as global defaults?</strong> This affects every page.
        <div class="gv-admin-panel-actions" style="margin-top:8px">
          <button class="gv-admin-action gv-admin-action--danger" type="button" data-admin-action="confirm-global-token-publish">Yes, Publish Globally</button>
          <button class="gv-admin-action" type="button" data-admin-action="cancel-global-token-publish">Cancel</button>
        </div>
      </div>` : '';

    let panelHtml = '';
    if (visualControlTab === 'tokens') panelHtml = renderBrandTokensPanel();
    else if (visualControlTab === 'typography') panelHtml = renderTypographyPanel();
    else if (visualControlTab === 'buttons') panelHtml = renderButtonsPanel();
    else if (visualControlTab === 'cards') panelHtml = renderCardsPanel();
    else if (visualControlTab === 'page-theme') panelHtml = renderPageThemePanel();

    const unsavedNote = unsavedVisualCount > 0
      ? `<p class="gv-admin-note">${unsavedVisualCount} token(s) in draft.</p>` : '';

    const canEdit = canAdminEdit();
    const canPublish = canAdminPublish();
    return `
      <div class="gv-admin-visual-control">
        ${getRoleAccessBanner('visual')}
        ${confirmHtml}
        <div class="gv-admin-subtabs">${tabsHtml}</div>
        ${panelHtml}
        ${unsavedNote}
        <div class="gv-admin-panel-actions" style="margin-top:12px">
          <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="save-token-drafts" ${canEdit ? '' : 'disabled'}>Save Draft</button>
          <button class="gv-admin-action" type="button" data-admin-action="publish-tokens-page" ${canPublish ? '' : 'disabled'}>Publish (This Page)</button>
          <button class="gv-admin-action" type="button" data-admin-action="publish-tokens-global" ${canPublish ? '' : 'disabled'}>Publish (Global)</button>
          <button class="gv-admin-action gv-admin-action--danger" type="button" data-admin-action="reset-token-drafts" ${canEdit ? '' : 'disabled'}>Reset Draft</button>
        </div>
      </div>
    `;
  }

  function renderBrandTokensPanel() {
    const tokens = [
      { key: 'mint', label: 'Accent / Mint', type: 'color', scope: 'global' },
      { key: 'bg', label: 'Background', type: 'color', scope: 'global' },
      { key: 'surface', label: 'Surface', type: 'color', scope: 'global' },
      { key: 'text', label: 'Text', type: 'color', scope: 'global' },
      { key: 'muted', label: 'Muted Text', type: 'color', scope: 'global' },
      { key: 'border', label: 'Border', type: 'color', scope: 'global' }
    ];
    return `<div class="gv-admin-token-grid">${tokens.map(t => renderTokenColorRow(t)).join('')}</div>`;
  }

  function renderTypographyPanel() {
    const fontTokens = [
      { key: 'font-heading', label: 'Heading Font', scope: 'global' },
      { key: 'font-body', label: 'Body Font', scope: 'global' }
    ];
    const sizeTokens = [
      { key: 'font-size-base', label: 'Base Font Size', scope: 'global' },
      { key: 'font-size-h1', label: 'H1 Size', scope: 'global' },
      { key: 'font-size-h2', label: 'H2 Size', scope: 'global' }
    ];
    return `
      <div class="gv-admin-token-grid">
        ${fontTokens.map(t => renderTokenFontRow(t)).join('')}
        ${sizeTokens.map(t => renderTokenSizeRow(t)).join('')}
      </div>`;
  }

  function renderButtonsPanel() {
    const tokens = [
      { key: 'btn-bg', label: 'Button Background', type: 'color', scope: 'page' },
      { key: 'btn-color', label: 'Button Text Color', type: 'color', scope: 'page' },
      { key: 'btn-border', label: 'Button Border', type: 'color', scope: 'page' },
      { key: 'radius-btn', label: 'Button Radius', type: 'size', scope: 'global' },
      { key: 'btn-padding-y', label: 'Vertical Padding', type: 'size', scope: 'global' }
    ];
    return `<div class="gv-admin-token-grid">
      ${tokens.map(t => t.type === 'color' ? renderTokenColorRow(t) : renderTokenSizeRow(t)).join('')}
    </div>`;
  }

  function renderCardsPanel() {
    const tokens = [
      { key: 'card-bg', label: 'Card Background', type: 'color', scope: 'page' },
      { key: 'card-border', label: 'Card Border', type: 'color', scope: 'page' },
      { key: 'radius-card', label: 'Card Radius', type: 'size', scope: 'global' },
      { key: 'card-padding', label: 'Card Padding', type: 'size', scope: 'global' }
    ];
    return `<div class="gv-admin-token-grid">
      ${tokens.map(t => t.type === 'color' ? renderTokenColorRow(t) : renderTokenSizeRow(t)).join('')}
    </div>`;
  }

  function renderPageThemePanel() {
    const tokens = [
      { key: 'page-bg', label: 'Page Background', type: 'color', scope: 'page' },
      { key: 'page-text', label: 'Page Text', type: 'color', scope: 'page' },
      { key: 'section-max-width', label: 'Section Max Width', type: 'size', scope: 'page' }
    ];
    return `<div class="gv-admin-token-grid">
      ${tokens.map(t => t.type === 'color' ? renderTokenColorRow(t) : renderTokenSizeRow(t)).join('')}
    </div>`;
  }

  function renderTokenColorRow(t) {
    const draftVal = designTokenDrafts[t.key] ? (designTokenDrafts[t.key].value || designTokenDrafts[t.key]) : '';
    const publishedVal = designTokenPublished[t.key] ? (designTokenPublished[t.key].value || designTokenPublished[t.key]) : '';
    const cssVal = getComputedStyle(document.documentElement).getPropertyValue('--' + t.key).trim() || '';
    const current = draftVal || cssVal || '#000000';
    const safeHex = sanitizeColorValue(String(current)) || '#000000';
    return `
      <div class="gv-admin-token-row">
        <label class="gv-admin-token-label">${escapeHtml(t.label)}</label>
        <div class="gv-admin-token-color-wrap">
          <input type="color" class="gv-admin-color-swatch" data-token-key="${t.key}" data-token-scope="${t.scope}" value="${escapeHtml(safeHex)}">
          <input type="text" class="gv-admin-color-hex" data-token-key="${t.key}" data-token-scope="${t.scope}" value="${escapeHtml(safeHex)}" maxlength="9" placeholder="#000000">
        </div>
        ${publishedVal ? `<span class="gv-admin-token-published">Published: ${escapeHtml(String(publishedVal))}</span>` : ''}
      </div>`;
  }

  function renderTokenSizeRow(t) {
    const draftVal = designTokenDrafts[t.key] ? (designTokenDrafts[t.key].value || designTokenDrafts[t.key]) : '';
    const cssVal = getComputedStyle(document.documentElement).getPropertyValue('--' + t.key).trim() || '';
    const current = draftVal || cssVal || '';
    return `
      <div class="gv-admin-token-row">
        <label class="gv-admin-token-label">${escapeHtml(t.label)}</label>
        <input type="text" class="gv-admin-size-input" data-token-key="${t.key}" data-token-scope="${t.scope}" value="${escapeHtml(String(current))}" placeholder="e.g. 4px or 1rem">
      </div>`;
  }

  function renderTokenFontRow(t) {
    const draftVal = designTokenDrafts[t.key] ? (designTokenDrafts[t.key].value || designTokenDrafts[t.key]) : '';
    const cssVal = getComputedStyle(document.documentElement).getPropertyValue('--' + t.key).trim() || '';
    const current = (draftVal || cssVal || '').replace(/['"]/g, '').trim();
    const opts = SAFE_FONTS.map(f =>
      `<option value="${f}"${current === f ? ' selected' : ''}>${f}</option>`
    ).join('');
    return `
      <div class="gv-admin-token-row">
        <label class="gv-admin-token-label">${escapeHtml(t.label)}</label>
        <select class="gv-admin-font-select" data-token-key="${t.key}" data-token-scope="${t.scope}">${opts}</select>
      </div>`;
  }

  // ── Phase 7: Rendering — Section Manager tab ──────────────────────────────

  function renderSectionManagerTab() {
    const sections = getSections();
    if (sections.length === 0) {
      return `<div class="gv-admin-empty">No sections with <code>data-section-id</code> found on this page.</div>`;
    }
    return `
      <div class="gv-admin-section-manager">
        ${getRoleAccessBanner('sections')}
        <p class="gv-admin-note">Manage section visibility, order, and style. Protected sections (animations, canvas, fixed) show a warning before changes.</p>
        ${sections.map((el, i) => renderSectionItem(el, i, sections.length)).join('')}
      </div>`;
  }

  function renderSectionBuilderTab() {
    const canEdit = ['owner', 'editor'].includes(adminProfile?.role || (mockAdminEnabled ? 'owner' : ''));
    const rows = getCustomSectionRowsForRender(true);
    return `
      <div class="gv-admin-section-builder">
        ${getRoleAccessBanner('builder')}
        <div class="gv-admin-builder-head">
          <div>
            <span class="gv-admin-pill">Safe templates only</span>
            <p class="gv-admin-note">Add predefined sections to this page. No raw HTML, scripts, custom code, or arbitrary CSS.</p>
          </div>
          <div class="gv-admin-meta"><div>Role: <code>${escapeHtml(adminProfile?.role || (mockAdminEnabled ? 'owner' : 'viewer'))}</code></div></div>
        </div>
        <div class="gv-admin-template-grid">
          ${Object.entries(CUSTOM_SECTION_TEMPLATES).map(([id, template]) => `
            <article class="gv-admin-template-card">
              <strong>${escapeHtml(template.label)}</strong>
              <p>${escapeHtml(template.description)}</p>
              <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="builder-add-template" data-template-id="${escapeHtml(id)}" ${canEdit ? '' : 'disabled'}>Add to Current Page</button>
            </article>
          `).join('')}
        </div>
        <div class="gv-admin-divider"></div>
        <div class="gv-admin-builder-sections">
          <h3>Custom sections on this page</h3>
          ${rows.length ? rows.map(row => renderBuilderSectionRow(row, canEdit)).join('') : '<p class="gv-admin-empty">No custom sections yet. Add one from the template library above.</p>'}
        </div>
        ${customSectionEditorId ? renderCustomSectionEditor(customSectionEditorId, canEdit) : ''}
      </div>
    `;
  }

  function renderBuilderSectionRow(row, canEdit) {
    const template = getTemplate(row.template_id);
    const isDraft = Boolean(customSectionDrafts[row.section_id]);
    return `
      <article class="gv-admin-builder-row">
        <div>
          <strong>${escapeHtml(row.title || template?.label || row.section_id)}</strong>
          <span>${escapeHtml(row.section_id)} / ${escapeHtml(template?.label || row.template_id)} / ${isDraft ? 'Draft' : 'Published'}</span>
        </div>
        <div class="gv-admin-section-actions">
          <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="section-scroll" data-section-id="${escapeHtml(row.section_id)}">Scroll</button>
          <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="builder-edit-section" data-section-id="${escapeHtml(row.section_id)}">Edit</button>
          <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="builder-duplicate-section" data-section-id="${escapeHtml(row.section_id)}" ${canEdit ? '' : 'disabled'}>Duplicate</button>
          <button class="gv-admin-action gv-admin-action--sm gv-admin-action--danger" type="button" data-admin-action="builder-delete-section" data-section-id="${escapeHtml(row.section_id)}" ${canEdit ? '' : 'disabled'}>${customSectionPublished[row.section_id] ? 'Hide Published' : 'Delete Draft'}</button>
        </div>
      </article>
    `;
  }

  function renderCustomSectionEditor(sectionId, canEdit = true) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!row) return '<p class="gv-admin-empty">Select a custom section to edit it.</p>';
    const template = getTemplate(row.template_id);
    const content = sanitizeCustomContent(row.template_id, row.content_json);
    return `
      <div class="gv-admin-builder-editor" data-builder-editor="${escapeHtml(sectionId)}">
        <div class="gv-admin-builder-editor-head">
          <div>
            <span class="gv-admin-pill">${escapeHtml(template?.label || 'Custom Section')}</span>
            <h3>${escapeHtml(row.title || sectionId)}</h3>
          </div>
          <button class="gv-admin-action" type="button" data-admin-action="builder-edit-section" data-section-id="">Close Editor</button>
        </div>
        <div class="gv-inspector-tabs" role="tablist">
          <button type="button" role="tab" aria-selected="${inspectorTab === 'content' ? 'true' : 'false'}" class="${inspectorTab === 'content' ? 'is-active' : ''}" data-admin-action="inspector-tab" data-inspector-tab="content">Content</button>
          <button type="button" role="tab" aria-selected="${inspectorTab === 'style' ? 'true' : 'false'}" class="${inspectorTab === 'style' ? 'is-active' : ''}" data-admin-action="inspector-tab" data-inspector-tab="style">Style</button>
          <button type="button" role="tab" aria-selected="${inspectorTab === 'section' ? 'true' : 'false'}" class="${inspectorTab === 'section' ? 'is-active' : ''}" data-admin-action="inspector-tab" data-inspector-tab="section">Section</button>
        </div>
        ${inspectorTab === 'style' ? renderCustomSectionStyleEditor(row, canEdit) : inspectorTab === 'section' ? renderCustomSectionMetaEditor(row, canEdit) : renderCustomSectionContentEditor(row, content, canEdit)}
      </div>
    `;
  }

  function renderCustomSectionContentEditor(row, content, canEdit) {
    const field = (key, label, multiline = false) => `
      <div class="gv-admin-field">
        <label>${escapeHtml(label)}</label>
        ${multiline
          ? `<textarea data-custom-field="${escapeHtml(key)}">${escapeHtml(content[key] || '')}</textarea>`
          : `<input type="text" data-custom-field="${escapeHtml(key)}" value="${escapeHtml(content[key] || '')}">`}
      </div>`;
    const sectionImage = (label, opts = {}) => renderCustomImageEditor(row, content, {
      label,
      scope: 'section',
      fieldPrefix: '',
      supportsPosition: Boolean(opts.position),
      supportsOverlay: Boolean(opts.overlay),
      canEdit
    });
    let html = '';
    if (row.template_id === 'simple_text') {
      html = field('eyebrow', 'Eyebrow') + field('heading', 'Heading') + field('body', 'Body', true) + field('buttonLabel', 'Button label') + field('buttonLink', 'Button link') + sectionImage('Optional image', { position: true });
    } else if (row.template_id === 'cta') {
      html = field('heading', 'Heading') + field('body', 'Body', true) + field('primaryLabel', 'Primary label') + field('primaryLink', 'Primary link') + field('secondaryLabel', 'Secondary label') + field('secondaryLink', 'Secondary link') + sectionImage('Background image', { overlay: true });
    } else if (row.template_id === 'feature_cards') {
      html = field('eyebrow', 'Eyebrow') + field('heading', 'Heading') + renderRepeatableEditor(row, 'cards', content.cards || [], [{ key: 'iconLabel', label: 'Icon label' }, { key: 'title', label: 'Title' }, { key: 'description', label: 'Description', multiline: true }], canEdit);
    } else if (row.template_id === 'stats') {
      html = field('heading', 'Heading') + renderRepeatableEditor(row, 'stats', content.stats || [], [{ key: 'value', label: 'Value' }, { key: 'label', label: 'Label' }], canEdit);
    } else if (row.template_id === 'faq') {
      html = field('heading', 'Heading') + renderRepeatableEditor(row, 'questions', content.questions || [], [{ key: 'question', label: 'Question' }, { key: 'answer', label: 'Answer', multiline: true }], canEdit);
    } else if (row.template_id === 'project_highlight') {
      html = field('eyebrow', 'Eyebrow') + field('heading', 'Heading') + field('description', 'Description', true) + field('projectTitle', 'Project title') + field('category', 'Category') + field('metric', 'Metric') + field('ctaLabel', 'CTA label') + field('ctaLink', 'CTA link') + sectionImage('Project image');
    } else if (row.template_id === 'logo_strip') {
      html = field('heading', 'Heading') + renderRepeatableEditor(row, 'items', (content.items || []).map(item => typeof item === 'string' ? ({ label: item }) : item), [{ key: 'label', label: 'Fallback text label' }], canEdit);
    }
    return `
      ${html}
      <p class="gv-admin-note" data-admin-save-state>Plain text only. Links allow relative, anchors, https, and validated mailto URLs.</p>
      <div class="gv-admin-panel-actions">
        <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="builder-save-section" data-section-id="${escapeHtml(row.section_id)}" ${canEdit ? '' : 'disabled'}>Save Section Draft</button>
      </div>
    `;
  }

  function renderCustomImageEditor(row, source, options) {
    if (!CUSTOM_SECTION_IMAGE_TEMPLATES.has(row.template_id)) return '';
    const scope = options.scope || 'section';
    const indexAttr = options.index !== undefined ? ` data-item-index="${Number(options.index)}"` : '';
    const arrayAttr = options.arrayKey ? ` data-array-key="${escapeHtml(options.arrayKey)}"` : '';
    const url = source?.image_url || '';
    const assetId = source?.image_asset_id || '';
    const alt = source?.image_alt || '';
    const pickerOpen = customMediaPicker
      && customMediaPicker.sectionId === row.section_id
      && customMediaPicker.scope === scope
      && String(customMediaPicker.index ?? '') === String(options.index ?? '')
      && String(customMediaPicker.arrayKey || '') === String(options.arrayKey || '');
    return `
      <div class="gv-admin-section-image" data-custom-image-editor data-image-scope="${escapeHtml(scope)}"${arrayAttr}${indexAttr}>
        <div class="gv-admin-section-image-head">
          <div>
            <strong>${escapeHtml(options.label || 'Image')}</strong>
            <span>${url ? escapeHtml(assetId || 'Selected image') : 'No image selected'}</span>
          </div>
          <div class="gv-admin-section-actions">
            <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="builder-open-media-picker" data-section-id="${escapeHtml(row.section_id)}" data-image-scope="${escapeHtml(scope)}"${arrayAttr}${indexAttr} ${options.canEdit ? '' : 'disabled'}>${url ? 'Replace' : 'Choose from Media Library'}</button>
            <button class="gv-admin-action gv-admin-action--sm gv-admin-action--danger" type="button" data-admin-action="builder-remove-image" data-section-id="${escapeHtml(row.section_id)}" data-image-scope="${escapeHtml(scope)}"${arrayAttr}${indexAttr} ${url && options.canEdit ? '' : 'disabled'}>Remove</button>
          </div>
        </div>
        <div class="gv-admin-section-image-preview">
          ${url && isSafeImageUrl(url)
            ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`
            : '<span>No selected image</span>'}
        </div>
        <input type="hidden" data-custom-image-field="image_asset_id" data-image-scope="${escapeHtml(scope)}"${arrayAttr}${indexAttr} value="${escapeHtml(assetId)}">
        <input type="hidden" data-custom-image-field="image_url" data-image-scope="${escapeHtml(scope)}"${arrayAttr}${indexAttr} value="${escapeHtml(url)}">
        <div class="gv-admin-field">
          <label>Alt text</label>
          <input type="text" data-custom-image-field="image_alt" data-image-scope="${escapeHtml(scope)}"${arrayAttr}${indexAttr} value="${escapeHtml(alt)}" ${options.canEdit ? '' : 'disabled'}>
        </div>
        ${options.supportsPosition ? `
          <div class="gv-admin-field">
            <label>Image position</label>
            <select data-custom-field="image_position" ${options.canEdit ? '' : 'disabled'}>
              ${['right','left','top','bottom','background'].map(pos => `<option value="${pos}" ${source.image_position === pos ? 'selected' : ''}>${pos}</option>`).join('')}
            </select>
          </div>
        ` : ''}
        ${options.supportsOverlay ? `
          <div class="gv-admin-field">
            <label>Overlay strength</label>
            <input type="range" min="0" max="0.85" step="0.05" data-custom-field="overlay_strength" value="${escapeHtml(source.overlay_strength || '0.45')}" ${options.canEdit ? '' : 'disabled'}>
          </div>
        ` : ''}
        ${pickerOpen ? renderCustomMediaPicker(row, options) : ''}
      </div>
    `;
  }

  function renderCustomMediaPicker(row, options) {
    const search = customMediaPickerSearch.trim().toLowerCase();
    const assets = mediaAssets.filter(asset => {
      if (asset.is_archived) return false;
      if (!asset.public_url || !isSafeImageUrl(asset.public_url)) return false;
      const haystack = `${asset.file_name || ''} ${asset.alt_text || ''} ${asset.file_type || ''}`.toLowerCase();
      return !search || haystack.includes(search);
    });
    const scope = options.scope || 'section';
    const indexAttr = options.index !== undefined ? ` data-item-index="${Number(options.index)}"` : '';
    const arrayAttr = options.arrayKey ? ` data-array-key="${escapeHtml(options.arrayKey)}"` : '';
    return `
      <div class="gv-admin-media-picker" data-custom-media-picker>
        <div class="gv-admin-media-picker-toolbar">
          <input type="search" data-media-picker-search placeholder="Search filename or alt text" value="${escapeHtml(customMediaPickerSearch)}">
          <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="builder-refresh-media" data-section-id="${escapeHtml(row.section_id)}">Refresh</button>
        </div>
        ${!mediaLibraryLoaded ? '<p class="gv-admin-empty">Loading media assets...</p>' : !mediaAssets.length ? '<p class="gv-admin-empty">No media assets found. Upload images from the Media Library tab first.</p>' : !assets.length ? '<p class="gv-admin-empty">No assets match this search.</p>' : `
          <div class="gv-admin-media-picker-grid">
            ${assets.map(asset => `
              <button class="gv-admin-media-picker-item${asset.id === options.currentAssetId ? ' is-selected' : ''}" type="button" data-admin-action="builder-select-media" data-section-id="${escapeHtml(row.section_id)}" data-asset-id="${escapeHtml(asset.id)}" data-image-scope="${escapeHtml(scope)}"${arrayAttr}${indexAttr}>
                <span class="gv-admin-media-picker-thumb" style="background-image:url(${escapeHtml(asset.public_url)})"></span>
                <span class="gv-admin-media-picker-meta">
                  <strong>${escapeHtml(asset.file_name || 'Untitled asset')}</strong>
                  <em>${escapeHtml(asset.file_type || 'image')}</em>
                </span>
              </button>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderRepeatableEditor(row, arrayKey, items, fields, canEdit) {
    return `
      <div class="gv-admin-repeatable" data-repeatable-key="${escapeHtml(arrayKey)}">
        <div class="gv-admin-repeatable-head">
          <strong>${escapeHtml(arrayKey)}</strong>
          <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="builder-add-item" data-section-id="${escapeHtml(row.section_id)}" data-array-key="${escapeHtml(arrayKey)}" ${canEdit ? '' : 'disabled'}>Add Item</button>
        </div>
        ${items.map((item, index) => `
          <article class="gv-admin-repeatable-item">
            <div class="gv-admin-repeatable-controls">
              <span>#${index + 1}</span>
              <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="builder-move-item" data-section-id="${escapeHtml(row.section_id)}" data-array-key="${escapeHtml(arrayKey)}" data-item-index="${index}" data-direction="-1" ${index === 0 || !canEdit ? 'disabled' : ''}>Up</button>
              <button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="builder-move-item" data-section-id="${escapeHtml(row.section_id)}" data-array-key="${escapeHtml(arrayKey)}" data-item-index="${index}" data-direction="1" ${index === items.length - 1 || !canEdit ? 'disabled' : ''}>Down</button>
              <button class="gv-admin-action gv-admin-action--sm gv-admin-action--danger" type="button" data-admin-action="builder-remove-item" data-section-id="${escapeHtml(row.section_id)}" data-array-key="${escapeHtml(arrayKey)}" data-item-index="${index}" ${!canEdit ? 'disabled' : ''}>Remove</button>
            </div>
            ${fields.map(field => `
              <div class="gv-admin-field">
                <label>${escapeHtml(field.label)}</label>
                ${field.multiline
                  ? `<textarea data-custom-array="${escapeHtml(arrayKey)}" data-custom-index="${index}" data-custom-item-field="${escapeHtml(field.key)}">${escapeHtml(item[field.key] || '')}</textarea>`
                  : `<input type="text" data-custom-array="${escapeHtml(arrayKey)}" data-custom-index="${index}" data-custom-item-field="${escapeHtml(field.key)}" value="${escapeHtml(item[field.key] || '')}">`}
              </div>
            `).join('')}
            ${arrayKey === 'cards' || arrayKey === 'items' ? renderCustomImageEditor(row, item, {
              label: arrayKey === 'cards' ? 'Card image/icon' : 'Logo image',
              scope: 'item',
              arrayKey,
              index,
              canEdit
            }) : ''}
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderCustomSectionStyleEditor(row, canEdit) {
    const style = sanitizeCustomStyle(row.style_json || {});
    const props = [
      ['backgroundColor', 'Background color', '#080808'],
      ['color', 'Text color', '#f6f6f6'],
      ['paddingTop', 'Padding top', '96px'],
      ['paddingBottom', 'Padding bottom', '96px'],
      ['marginTop', 'Margin top', '0'],
      ['marginBottom', 'Margin bottom', '0'],
      ['maxWidth', 'Max width', '1180px'],
      ['textAlign', 'Text alignment', 'left'],
      ['borderRadius', 'Border radius', '0'],
      ['borderColor', 'Border color', '#222222'],
      ['cardBackground', 'Card background', '#121212'],
      ['cardRadius', 'Card radius', '8px']
    ];
    return `
      ${props.map(([prop, label, placeholder]) => `
        <div class="gv-admin-field">
          <label>${escapeHtml(label)}</label>
          <input type="text" data-custom-style="${escapeHtml(prop)}" value="${escapeHtml(style[prop] || '')}" placeholder="${escapeHtml(placeholder)}">
        </div>
      `).join('')}
      <p class="gv-admin-note">Whitelisted style properties only. Unsafe values are skipped.</p>
      <div class="gv-admin-panel-actions">
        <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="builder-style-section" data-section-id="${escapeHtml(row.section_id)}" ${canEdit ? '' : 'disabled'}>Save Style Draft</button>
      </div>
    `;
  }

  function renderCustomSectionMetaEditor(row, canEdit) {
    return `
      <div class="gv-admin-field">
        <label>Section title</label>
        <input type="text" data-custom-meta="title" value="${escapeHtml(row.title || '')}">
      </div>
      <div class="gv-admin-field">
        <label>Order index</label>
        <input type="number" data-custom-meta="order_index" value="${Number(row.order_index || 0)}">
      </div>
      <label class="gv-admin-checkline"><input type="checkbox" data-custom-meta="is_visible" ${row.is_visible !== false ? 'checked' : ''}> Visible</label>
      <div class="gv-admin-panel-actions">
        <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="builder-save-section" data-section-id="${escapeHtml(row.section_id)}" ${canEdit ? '' : 'disabled'}>Save Section Draft</button>
      </div>
    `;
  }

  function renderSectionItem(el, idx, total) {
    const sid = el.dataset.sectionId || '';
    const isProtected = isSectionProtected(el);
    const isCustom = el.dataset.customSection === 'true';
    const draft = sectionSettingsDrafts[sid] || {};
    const isVisible = el.style.display !== 'none';
    const isExpanded = sectionManagerExpanded === sid;
    return `
      <div class="gv-admin-section-item${isProtected ? ' is-protected' : ''}">
        <div class="gv-admin-section-row">
          <span class="gv-admin-section-id">${escapeHtml(sid)}</span>
          ${isProtected ? '<span class="gv-admin-badge gv-admin-badge--warn">Protected</span>' : ''}
          <span class="gv-admin-badge${isVisible ? ' gv-admin-badge--ok' : ' gv-admin-badge--off'}">${isVisible ? 'Visible' : 'Hidden'}</span>
          <div class="gv-admin-section-actions">
            <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="section-toggle-visibility" data-section-id="${sid}">${isVisible ? 'Hide' : 'Show'}</button>
            <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="section-move-up" data-section-id="${sid}" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="section-move-down" data-section-id="${sid}" ${idx === total - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="section-scroll" data-section-id="${sid}">Scroll To</button>
            <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="builder-duplicate-section" data-section-id="${sid}">Duplicate</button>
            ${isCustom ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="builder-edit-section" data-section-id="${sid}">Edit</button>` : ''}
            ${isCustom ? `<button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--danger" data-admin-action="builder-delete-section" data-section-id="${sid}">${customSectionPublished[sid] ? 'Hide Published' : 'Delete Draft'}</button>` : ''}
            <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="section-expand" data-section-id="${sid}">${isExpanded ? 'Close' : 'Style'}</button>
          </div>
        </div>
        ${isExpanded ? renderSectionStyleControls(sid, draft) : ''}
      </div>`;
  }

  function renderSectionStyleControls(sid, draft) {
    const styleProps = [
      { prop: 'paddingTop', label: 'Padding Top', placeholder: '80px' },
      { prop: 'paddingBottom', label: 'Padding Bottom', placeholder: '80px' },
      { prop: 'marginTop', label: 'Margin Top', placeholder: '0' },
      { prop: 'marginBottom', label: 'Margin Bottom', placeholder: '0' },
      { prop: 'backgroundColor', label: 'Background Color', placeholder: '#ffffff' },
      { prop: 'maxWidth', label: 'Max Width', placeholder: '1200px' },
      { prop: 'opacity', label: 'Opacity (0–1)', placeholder: '1' }
    ];
    const existingStyle = draft.style_json || {};
    const inputs = styleProps.map(sp => {
      const val = existingStyle[sp.prop] || '';
      return `
        <div class="gv-admin-field">
          <label>${escapeHtml(sp.label)}</label>
          <input type="text" data-style-prop="${sp.prop}" value="${escapeHtml(val)}" placeholder="${escapeHtml(sp.placeholder)}">
        </div>`;
    }).join('');
    return `
      <div class="gv-admin-section-style-panel" data-section-style-panel="${sid}">
        ${inputs}
        <div class="gv-admin-panel-actions">
          <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="save-section-draft" data-section-id="${sid}">Save Section Draft</button>
          <button class="gv-admin-action" type="button" data-admin-action="reset-section-draft" data-section-id="${sid}">Reset Section Draft</button>
        </div>
      </div>`;
  }

  // ── Phase 7: Rendering — Inspector Style tab ──────────────────────────────

  function getElementStyleType(el) {
    if (!el) return 'text';
    const t = el.dataset.editType || 'text';
    if (t === 'button') return 'button';
    if (t === 'card') return 'card';
    return 'text';
  }

  function renderInspectorStyleTabHTML(el) {
    const key = el ? (el.dataset.editKey || '') : '';
    const existingDraft = elementStyleDrafts[key] || {};
    const styles = existingDraft.styles || {};
    const styleType = getElementStyleType(el);

    let propGroups = [];
    if (styleType === 'button') {
      propGroups = [
        { prop: 'backgroundColor', label: 'Background Color', placeholder: '' },
        { prop: 'color', label: 'Text Color', placeholder: '' },
        { prop: 'borderColor', label: 'Border Color', placeholder: '' },
        { prop: 'borderRadius', label: 'Border Radius', placeholder: '4px' },
        { prop: 'paddingTop', label: 'Padding Top', placeholder: '12px' },
        { prop: 'paddingBottom', label: 'Padding Bottom', placeholder: '12px' }
      ];
    } else if (styleType === 'card') {
      propGroups = [
        { prop: 'backgroundColor', label: 'Background Color', placeholder: '' },
        { prop: 'borderColor', label: 'Border Color', placeholder: '' },
        { prop: 'borderRadius', label: 'Border Radius', placeholder: '8px' },
        { prop: 'paddingTop', label: 'Padding', placeholder: '24px' },
        { prop: 'opacity', label: 'Opacity (0–1)', placeholder: '1' }
      ];
    } else {
      propGroups = [
        { prop: 'color', label: 'Text Color', placeholder: '' },
        { prop: 'fontSize', label: 'Font Size', placeholder: '16px' },
        { prop: 'fontWeight', label: 'Font Weight', placeholder: '400' },
        { prop: 'lineHeight', label: 'Line Height', placeholder: '1.5' },
        { prop: 'letterSpacing', label: 'Letter Spacing', placeholder: '0px' },
        { prop: 'textAlign', label: 'Text Align', placeholder: 'left' },
        { prop: 'maxWidth', label: 'Max Width', placeholder: '' },
        { prop: 'marginTop', label: 'Margin Top', placeholder: '0' },
        { prop: 'marginBottom', label: 'Margin Bottom', placeholder: '0' }
      ];
    }

    const inputs = propGroups.map(sp => {
      const val = styles[sp.prop] || '';
      return `
        <div class="gv-admin-field">
          <label>${escapeHtml(sp.label)}</label>
          <input type="text" data-style-prop="${sp.prop}" value="${escapeHtml(val)}" placeholder="${escapeHtml(sp.placeholder)}">
        </div>`;
    }).join('');

    return `
      <div class="gv-admin-inspector-style-panel">
        <div class="gv-admin-meta"><div>Edit key: <code>${escapeHtml(key)}</code></div></div>
        ${inputs}
        <p class="gv-admin-note" data-admin-save-state>Only whitelisted CSS properties allowed.</p>
        <div class="gv-admin-panel-actions">
          <button class="gv-admin-action gv-admin-action--mint" type="button" data-admin-action="save-element-style-draft">Save Style Draft</button>
          <button class="gv-admin-action" type="button" data-admin-action="reset-element-style-draft">Reset Style</button>
          <button class="gv-admin-action" type="button" data-admin-action="close-panel">Close</button>
        </div>
      </div>`;
  }

  // Phase 8: Section Builder actions

  function getCustomImageContextFromAction(actionElement) {
    return {
      sectionId: actionElement.dataset.sectionId || '',
      scope: actionElement.dataset.imageScope || 'section',
      arrayKey: actionElement.dataset.arrayKey || '',
      index: actionElement.dataset.itemIndex !== undefined ? Number(actionElement.dataset.itemIndex) : null
    };
  }

  function canEditCustomSections() {
    return ['owner', 'editor'].includes(adminProfile?.role || (isMockAdminSession() ? 'owner' : ''));
  }

  async function openCustomMediaPicker(actionElement) {
    if (!canEditCustomSections()) return;
    const context = getCustomImageContextFromAction(actionElement);
    if (!context.sectionId) return;
    customMediaPicker = context;
    if (!mediaLibraryLoaded && supabaseClient && currentUser) await loadMediaAssets();
    renderDashboard();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  async function refreshCustomMediaPicker() {
    if (supabaseClient && currentUser) await loadMediaAssets();
    renderDashboard();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  function mergeCustomEditorContent(sectionId) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!row) return null;
    const collected = collectCustomSectionContent(sectionId);
    const next = Object.assign({}, row, {
      content_json: collected || sanitizeCustomContent(row.template_id, row.content_json),
      status: 'draft'
    });
    customSectionDrafts[sectionId] = next;
    return next;
  }

  function setCustomImageInContent(content, context, asset) {
    const imageData = {
      image_asset_id: asset?.id || '',
      image_url: asset?.public_url || '',
      image_alt: asset?.alt_text || ''
    };
    if (context.scope === 'item') {
      if (!Array.isArray(content[context.arrayKey])) content[context.arrayKey] = [];
      if (!content[context.arrayKey][context.index] || typeof content[context.arrayKey][context.index] !== 'object') content[context.arrayKey][context.index] = {};
      Object.assign(content[context.arrayKey][context.index], imageData);
    } else {
      Object.assign(content, imageData);
    }
  }

  function getCustomImageEditorSelector(context) {
    const array = context.arrayKey ? `[data-array-key="${cssEscape(context.arrayKey)}"]` : '';
    const index = context.index !== null && context.index !== undefined ? `[data-item-index="${Number(context.index)}"]` : '';
    return `[data-image-scope="${cssEscape(context.scope || 'section')}"]${array}${index}`;
  }

  function setCustomImageEditorDom(actionElement, context, asset) {
    const editor = actionElement.closest('[data-builder-editor]');
    if (!editor) return;
    const selector = getCustomImageEditorSelector(context);
    const values = {
      image_asset_id: asset?.id || '',
      image_url: asset?.public_url || '',
      image_alt: asset?.alt_text || ''
    };
    Object.entries(values).forEach(([field, value]) => {
      const input = $(`[data-custom-image-field="${field}"]${selector}`, editor);
      if (input) input.value = value;
    });
    const block = actionElement.closest('[data-custom-image-editor]') || $(`[data-custom-image-editor]${selector}`, editor);
    const preview = block ? $('.gv-admin-section-image-preview', block) : null;
    if (preview) {
      preview.textContent = '';
      if (asset?.public_url && isSafeImageUrl(asset.public_url)) {
        const img = document.createElement('img');
        img.src = asset.public_url;
        img.alt = sanitizeText(asset.alt_text || '');
        img.loading = 'lazy';
        img.decoding = 'async';
        preview.appendChild(img);
      } else {
        const empty = document.createElement('span');
        empty.textContent = 'No selected image';
        preview.appendChild(empty);
      }
    }
    const picker = block ? $('[data-custom-media-picker]', block) : $('[data-custom-media-picker]', editor);
    if (picker) picker.remove();
  }

  function selectCustomSectionMedia(actionElement) {
    if (!canEditCustomSections()) return;
    const context = getCustomImageContextFromAction(actionElement);
    const asset = mediaAssets.find(item => item.id === actionElement.dataset.assetId);
    if (!asset || !asset.public_url || !isSafeImageUrl(asset.public_url)) {
      dashboardMessage = 'Selected media asset has an invalid URL.';
      renderDashboard();
      return;
    }
    setCustomImageEditorDom(actionElement, context, asset);
    const row = mergeCustomEditorContent(context.sectionId);
    if (!row) return;
    customSectionDrafts[row.section_id] = row;
    customMediaPicker = null;
    dashboardMessage = 'Image selected. Save Section Draft to persist it.';
    renderCustomSectionsForAdmin();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  function removeCustomSectionImage(actionElement) {
    if (!canEditCustomSections()) return;
    const context = getCustomImageContextFromAction(actionElement);
    setCustomImageEditorDom(actionElement, context, null);
    const row = mergeCustomEditorContent(context.sectionId);
    if (!row) return;
    customSectionDrafts[row.section_id] = row;
    customMediaPicker = null;
    dashboardMessage = 'Image removed. Save Section Draft to persist it.';
    renderCustomSectionsForAdmin();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  async function addCustomSectionFromTemplate(templateId) {
    const template = getTemplate(templateId);
    if (!template) return;
    if (!['owner', 'editor'].includes(adminProfile?.role || (mockAdminEnabled ? 'owner' : ''))) {
      window.alert('Viewers can browse templates but cannot add sections.');
      return;
    }
    const row = normalizeCustomSectionRow({
      page_path: pagePath,
      section_id: makeCustomSectionId(templateId),
      section_type: template.sectionType,
      template_id: templateId,
      title: template.label,
      content_json: cloneJson(template.defaults),
      style_json: {},
      order_index: getSections().length,
      is_visible: true,
      status: 'draft'
    }, 'draft');
    const error = await saveCustomSectionDraft(row);
    if (error) {
      dashboardMessage = 'Section add failed. Check Supabase policies and schema.';
    } else {
      customSectionEditorId = row.section_id;
      inspectorTab = 'content';
      dashboardMessage = 'Section added as draft.';
      logCmsCustomDebug('custom-section-added', { sectionId: row.section_id, templateId });
    }
    renderDashboard();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  function openCustomSectionEditor(sectionId) {
    customSectionEditorId = sectionId || null;
    inspectorTab = 'content';
    if (dashboard && !dashboard.hidden) {
      renderDashboard();
      setTimeout(bindSectionBuilderEvents, 0);
    }
    if (!sectionId || !panel) return;
    const section = $(`[data-section-id="${cssEscape(sectionId)}"]`);
    if (section) {
      if (selectedElement) selectedElement.classList.remove('gv-admin-selected');
      selectedElement = section;
      selectedElement.classList.add('gv-admin-selected');
      renderCustomSectionInspector(sectionId);
    }
  }

  function getCustomSectionEditorElement(sectionId) {
    return (dashboard ? $(`[data-builder-editor="${cssEscape(sectionId)}"]`, dashboard) : null)
      || (panel ? $(`[data-builder-editor="${cssEscape(sectionId)}"]`, panel) : null);
  }

  function collectCustomSectionContent(sectionId) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!row) return null;
    const editor = getCustomSectionEditorElement(sectionId);
    const next = sanitizeCustomContent(row.template_id, row.content_json);
    if (!editor) return next;
    $all('[data-custom-field]', editor).forEach(input => {
      next[input.dataset.customField] = input.value;
    });
    $all('[data-custom-array]', editor).forEach(input => {
      const arrayKey = input.dataset.customArray;
      const index = Number(input.dataset.customIndex || 0);
      const field = input.dataset.customItemField;
      if (!Array.isArray(next[arrayKey])) next[arrayKey] = [];
      if (!next[arrayKey][index] || typeof next[arrayKey][index] !== 'object') next[arrayKey][index] = {};
      next[arrayKey][index][field] = input.value;
    });
    $all('[data-custom-image-field]', editor).forEach(input => {
      const scope = input.dataset.imageScope || 'section';
      const field = input.dataset.customImageField;
      const value = input.value || '';
      if (scope === 'item') {
        const arrayKey = input.dataset.arrayKey;
        const index = Number(input.dataset.itemIndex || 0);
        if (!Array.isArray(next[arrayKey])) next[arrayKey] = [];
        if (!next[arrayKey][index] || typeof next[arrayKey][index] !== 'object') next[arrayKey][index] = {};
        next[arrayKey][index][field] = value;
      } else {
        next[field] = value;
      }
    });
    return sanitizeCustomContent(row.template_id, next);
  }

  function collectCustomSectionMeta(sectionId, baseRow) {
    const editor = getCustomSectionEditorElement(sectionId);
    const meta = {};
    if (!editor) return meta;
    const title = $('[data-custom-meta="title"]', editor);
    const order = $('[data-custom-meta="order_index"]', editor);
    const visible = $('[data-custom-meta="is_visible"]', editor);
    if (title) meta.title = sanitizeText(title.value).slice(0, 180);
    if (order) meta.order_index = Number(order.value || baseRow.order_index || 0);
    if (visible) meta.is_visible = visible.checked;
    return meta;
  }

  async function saveCustomSectionFromEditor(sectionId) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!row) return;
    const content = collectCustomSectionContent(sectionId) || row.content_json;
    const meta = collectCustomSectionMeta(sectionId, row);
    const next = Object.assign({}, row, meta, { content_json: content, status: 'draft' });
    const error = await saveCustomSectionDraft(next);
    dashboardMessage = error ? 'Section draft save failed.' : 'Section draft saved.';
    logCmsCustomDebug('custom-section-draft-saved', { sectionId, error: error ? String(error.message || error) : null });
    renderDashboard();
    setTimeout(bindSectionBuilderEvents, 0);
    if (panel && selectedElement?.dataset?.sectionId === sectionId) renderCustomSectionInspector(sectionId);
  }

  async function saveCustomSectionStyleFromEditor(sectionId) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!row) return;
    const editor = getCustomSectionEditorElement(sectionId);
    const styleJson = {};
    if (editor) {
      $all('[data-custom-style]', editor).forEach(input => {
        const prop = input.dataset.customStyle;
        const raw = input.value.trim();
        const safe = sanitizeStyleValue(prop === 'cardBackground' ? 'backgroundColor' : prop === 'cardRadius' ? 'borderRadius' : prop, raw);
        if (raw && safe !== null) styleJson[prop] = safe;
      });
    }
    const error = await saveCustomSectionDraft(Object.assign({}, row, { style_json: styleJson, status: 'draft' }));
    dashboardMessage = error ? 'Section style save failed.' : 'Section style draft saved.';
    renderDashboard();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  function getDefaultRepeatableItem(arrayKey) {
    if (arrayKey === 'cards') return { iconLabel: 'New', title: 'New card', description: 'Describe this card.', image_asset_id: '', image_url: '', image_alt: '' };
    if (arrayKey === 'stats') return { value: '0', label: 'New stat' };
    if (arrayKey === 'questions') return { question: 'New question?', answer: 'Add a plain-text answer.' };
    if (arrayKey === 'items') return { label: 'New label', image_asset_id: '', image_url: '', image_alt: '' };
    return { label: 'New item' };
  }

  async function addCustomSectionItem(sectionId, arrayKey) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!row) return;
    const content = collectCustomSectionContent(sectionId) || sanitizeCustomContent(row.template_id, row.content_json);
    if (!Array.isArray(content[arrayKey])) content[arrayKey] = [];
    content[arrayKey].push(getDefaultRepeatableItem(arrayKey));
    await saveCustomSectionDraft(Object.assign({}, row, { content_json: content, status: 'draft' }));
    customSectionEditorId = sectionId;
    renderDashboard();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  async function removeCustomSectionItem(sectionId, arrayKey, index) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!row) return;
    const content = collectCustomSectionContent(sectionId) || sanitizeCustomContent(row.template_id, row.content_json);
    if (Array.isArray(content[arrayKey])) content[arrayKey].splice(index, 1);
    await saveCustomSectionDraft(Object.assign({}, row, { content_json: content, status: 'draft' }));
    customSectionEditorId = sectionId;
    renderDashboard();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  async function moveCustomSectionItem(sectionId, arrayKey, index, direction) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!row) return;
    const content = collectCustomSectionContent(sectionId) || sanitizeCustomContent(row.template_id, row.content_json);
    const list = content[arrayKey];
    const nextIndex = index + direction;
    if (!Array.isArray(list) || nextIndex < 0 || nextIndex >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(nextIndex, 0, item);
    await saveCustomSectionDraft(Object.assign({}, row, { content_json: content, status: 'draft' }));
    customSectionEditorId = sectionId;
    renderDashboard();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  async function duplicateSection(sectionId) {
    const el = $(`[data-section-id="${cssEscape(sectionId)}"]`);
    if (!el) return;
    if (isSectionProtected(el)) {
      window.alert('This section is protected because it may be connected to animations. Duplicate is disabled.');
      logCmsCustomDebug('protected-section-duplicate-blocked', { sectionId });
      return;
    }
    const existing = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    const source = existing || makeSectionCopyFromHardcoded(el);
    if (!source) return;
    const newId = makeCustomSectionId(source.template_id || 'simple_text');
    const copy = normalizeCustomSectionRow(Object.assign({}, source, {
      section_id: newId,
      title: `${source.title || 'Section'} Copy`,
      order_index: getSections().length,
      status: 'draft'
    }), 'draft');
    const error = await saveCustomSectionDraft(copy);
    dashboardMessage = error ? 'Duplicate failed.' : 'Section duplicated as draft.';
    customSectionEditorId = error ? customSectionEditorId : newId;
    logCmsCustomDebug('custom-section-duplicated', { sourceId: sectionId, sectionId: newId });
    renderDashboard();
    setTimeout(bindSectionBuilderEvents, 0);
  }

  function makeSectionCopyFromHardcoded(el) {
    const heading = el.querySelector('h1,h2,h3')?.textContent?.trim() || 'Duplicated section';
    const eyebrow = el.querySelector('.eyebrow,.section-eyebrow')?.textContent?.trim() || 'Custom copy';
    const body = el.querySelector('p')?.textContent?.trim() || 'Edit this duplicated safe text section.';
    return normalizeCustomSectionRow({
      page_path: pagePath,
      section_id: makeCustomSectionId('simple_text'),
      section_type: CUSTOM_SECTION_TEMPLATES.simple_text.sectionType,
      template_id: 'simple_text',
      title: heading,
      content_json: { eyebrow, heading, body, buttonLabel: 'Learn More', buttonLink: 'about.html' },
      style_json: {},
      order_index: getSections().length,
      is_visible: true,
      status: 'draft'
    }, 'draft');
  }

  async function deleteCustomSection(sectionId) {
    const published = customSectionPublished[sectionId];
    if (published) {
      if (!window.confirm('This section is published. Create a hidden draft for the current page instead?')) return;
      await saveCustomSectionDraft(Object.assign({}, published, { is_visible: false, status: 'draft' }));
      dashboardMessage = 'Published section hidden as a draft. Publish current page to hide it publicly.';
      customSectionEditorId = null;
      renderDashboard();
      setTimeout(bindSectionBuilderEvents, 0);
      return;
    }
    if (customSectionDrafts[sectionId]) {
      await deleteCustomSectionDraft(sectionId);
      customSectionEditorId = customSectionEditorId === sectionId ? null : customSectionEditorId;
      renderDashboard();
      setTimeout(bindSectionBuilderEvents, 0);
      return;
    }
    window.alert('Hardcoded sections cannot be permanently deleted. Use Hide in Section Manager instead.');
  }

  function renderCustomSectionInspector(sectionId) {
    const row = customSectionDrafts[sectionId] || customSectionPublished[sectionId];
    if (!panel || !row) return;
    customSectionEditorId = sectionId;
    const canEdit = ['owner', 'editor'].includes(adminProfile?.role || (mockAdminEnabled ? 'owner' : ''));
    $('[data-admin-panel-title]', panel).textContent = 'Editing custom section';
    $('[data-admin-panel-body]', panel).innerHTML = renderCustomSectionEditor(sectionId, canEdit);
  }

  function bindSectionBuilderEvents() {
    if (!dashboard) return;
    const editor = $('.gv-admin-builder-editor', dashboard);
    if (!editor || editor._boundBuilder) return;
    editor._boundBuilder = true;
    $all('input, textarea, select', editor).forEach(input => {
      input.addEventListener('input', () => {
        inspectorDirty = true;
        unsavedCount = 1;
        updateTopbar();
      });
    });
    const pickerSearch = $('[data-media-picker-search]', editor);
    if (pickerSearch) {
      pickerSearch.addEventListener('input', () => {
        customMediaPickerSearch = pickerSearch.value || '';
        renderDashboard();
        setTimeout(bindSectionBuilderEvents, 0);
      });
    }
    $all('[data-admin-action="builder-select-media"]', editor).forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        selectCustomSectionMedia(button);
      });
    });
  }

  // ── Phase 7: Event binding ────────────────────────────────────────────────

  function bindVisualControlEvents() {
    if (!dashboard) return;
    const container = $('.gv-admin-visual-control', dashboard);
    if (!container || container._bound7) return;
    container._bound7 = true;

    $all('[data-token-key]', container).forEach(inp => {
      if (inp.type === 'color') {
        inp.addEventListener('input', () => {
          const v = inp.value;
          const safe = sanitizeColorValue(v);
          if (safe !== null) {
            document.documentElement.style.setProperty('--' + inp.dataset.tokenKey, safe);
            const hexPair = container.querySelector(`input[type="text"][data-token-key="${inp.dataset.tokenKey}"]`);
            if (hexPair) hexPair.value = safe;
          }
        });
      } else if (inp.type === 'text' && inp.classList.contains('gv-admin-color-hex')) {
        inp.addEventListener('input', () => {
          const v = inp.value.trim();
          const safe = sanitizeColorValue(v);
          if (safe !== null) {
            document.documentElement.style.setProperty('--' + inp.dataset.tokenKey, safe);
            const swatchPair = container.querySelector(`input[type="color"][data-token-key="${inp.dataset.tokenKey}"]`);
            if (swatchPair) swatchPair.value = safe;
          }
        });
      } else if (inp.classList.contains('gv-admin-size-input') || inp.tagName === 'SELECT') {
        inp.addEventListener('input', () => {
          const v = inp.value.trim();
          const safe = sanitizeCssVarValue(v);
          if (safe !== null) document.documentElement.style.setProperty('--' + inp.dataset.tokenKey, safe);
        });
      }
    });
  }

  function bindSectionManagerEvents() {
    if (!dashboard) return;
    const container = $('.gv-admin-section-manager', dashboard);
    if (!container || container._boundSM) return;
    container._boundSM = true;
  }

  function bindInspectorStyleEvents() {
    if (!panel) return;
    const container = $('.gv-admin-inspector-style-panel', panel);
    if (!container || container._boundIS) return;
    container._boundIS = true;
    $all('[data-style-prop]', container).forEach(inp => {
      inp.addEventListener('input', () => {
        if (!selectedElement) return;
        const prop = inp.dataset.styleProp;
        const safe = sanitizeStyleValue(prop, inp.value.trim());
        if (safe !== null) selectedElement.style[prop] = safe;
      });
    });
  }

  // ── Phase 7: Editor Safe Mode ─────────────────────────────────────────────

  function setEditorSafeMode(active) {
    editorSafeMode = !!active;
    if (active) {
      document.body.classList.add('editor-safe-mode');
    } else {
      document.body.classList.remove('editor-safe-mode');
    }
  }

  // ── Phase 7: Debug ────────────────────────────────────────────────────────

  function logCmsVisualDebug(context, extra) {
    if (!cmsDebug) return;
    console.log('[GROWVA CMS Visual Debug]', context, {
      editorSafeMode,
      visualControlTab,
      designTokenDraftCount: Object.keys(designTokenDrafts).length,
      sectionDraftCount: Object.keys(sectionSettingsDrafts).length,
      elementStyleDraftCount: Object.keys(elementStyleDrafts).length,
      unsavedVisualCount,
      ...extra
    });
  }

  // ── Phase 14: Scroll layout refresh helper ───────────────────────────────

  let _scrollRefreshFrame = null;
  function refreshScrollLayout() {
    if (_scrollRefreshFrame) cancelAnimationFrame(_scrollRefreshFrame);
    _scrollRefreshFrame = requestAnimationFrame(() => {
      _scrollRefreshFrame = null;
      if (window._lenis && typeof window._lenis.resize === 'function') window._lenis.resize();
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  // ── Phase 13: Live Content Preview Mode + Revision History + Undo Draft ──

  function isDraftStale(row) {
    if (!row || !row.updated_at) return false;
    const updated = new Date(row.updated_at);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return updated < sevenDaysAgo;
  }

  function getStaleDraftCount() {
    let count = 0;
    for (const row of dashboardDraftRows) { if (isDraftStale(row)) count++; }
    for (const key of Object.keys(designTokenDrafts)) {
      const row = designTokenDrafts[key];
      if (isDraftStale(row)) count++;
    }
    for (const key of Object.keys(sectionSettingsDrafts)) {
      const row = sectionSettingsDrafts[key];
      if (isDraftStale(row)) count++;
    }
    for (const key of Object.keys(elementStyleDrafts)) {
      const row = elementStyleDrafts[key];
      if (isDraftStale(row)) count++;
    }
    return count;
  }

  function enterVisitorPreview(type) {
    // Phase 18: clear responsive preview frame before entering visitor preview
    vd18RemoveResponsiveFrame();
    visitorPreviewType = type || 'published';
    visitorPreviewMode = true;
    document.body.classList.add('admin-visitor-preview');
    const existing = document.getElementById('gv-exit-preview-btn');
    if (existing) existing.remove();
    const btn = document.createElement('button');
    btn.id = 'gv-exit-preview-btn';
    btn.type = 'button';
    btn.className = 'gv-admin-exit-preview';
    btn.textContent = 'Exit Preview';
    btn.setAttribute('data-admin-action', 'exit-visitor-preview');
    document.body.appendChild(btn);
    const bar = document.createElement('div');
    bar.id = 'gv-preview-bar';
    bar.className = 'gv-admin-visitor-preview-bar';
    bar.textContent = visitorPreviewType === 'draft' ? 'Previewing: Draft state' : 'Previewing: Published state';
    document.body.appendChild(bar);
    if (visitorPreviewType === 'draft') {
      applyDraftRows();
      // Phase 17: draft preview — draft CSS remains visible (published + draft)
    } else {
      applyPublishedTextToDom();
      // Phase 17: published preview — clear draft CSS so admin sees only published state
      vd17ClearDraftCSSContent();
    }
    logCmsDebug('enter-visitor-preview', { type: visitorPreviewType });
  }

  function applyPublishedTextToDom() {
    const allEditable = document.querySelectorAll('[data-edit-key]');
    allEditable.forEach(el => {
      const key = el.dataset.editKey;
      if (!key) return;
      const pubRow = dashboardPublishedRows.find(r => r.edit_key === key);
      if (pubRow && pubRow.value_text !== undefined) {
        el.textContent = sanitizeText(pubRow.value_text);
      } else if (originalValues[key] !== undefined) {
        el.textContent = String(originalValues[key]);
      }
    });
  }

  function exitVisitorPreview() {
    visitorPreviewMode = false;
    document.body.classList.remove('admin-visitor-preview');
    const btn = document.getElementById('gv-exit-preview-btn');
    if (btn) btn.remove();
    const bar = document.getElementById('gv-preview-bar');
    if (bar) bar.remove();
    applyDraftRows();
    // Phase 17: restore draft CSS after exiting visitor preview
    vd17InjectDraftCSS();
    refreshScrollLayout();
    logCmsDebug('exit-visitor-preview');
  }

  function renderDraftCompareTab() {
    const contentRows = dashboardDraftRows;
    const tokenKeys = Object.keys(designTokenDrafts);
    const sectionKeys = Object.keys(sectionSettingsDrafts);
    const elementKeys = Object.keys(elementStyleDrafts);
    const totalDrafts = contentRows.length + tokenKeys.length + sectionKeys.length + elementKeys.length;
    if (!totalDrafts) {
      return '<p class="gv-admin-empty">No drafts on this page to compare.</p>';
    }
    const staleCount = getStaleDraftCount();
    const staleWarn = staleCount > 0
      ? `<div class="gv-admin-stale-warning">⚠ ${staleCount} draft(s) are older than 7 days and may be stale.</div>`
      : '';
    const contentHtml = contentRows.length
      ? `<h3 class="gv-admin-section-title">Content / Text (${contentRows.length})</h3>
         <div class="gv-admin-row-list">${contentRows.map(row => renderCompareContentRow(row)).join('')}</div>`
      : '';
    const tokenHtml = tokenKeys.length
      ? `<h3 class="gv-admin-section-title">Visual Tokens (${tokenKeys.length})</h3>
         <div class="gv-admin-row-list">${tokenKeys.map(key => {
           const row = designTokenDrafts[key];
           const pubRow = designTokenPublished[key];
           const stale = isDraftStale(row) ? '<span class="gv-admin-stale-badge">stale</span>' : '';
           const draftVal = escapeHtml(JSON.stringify(row?.value_json || '') || '');
           const pubVal = escapeHtml(JSON.stringify(pubRow?.value_json || '') || '–');
           return `<article class="gv-admin-content-row gv-admin-compare-row">
             <div>
               <strong>${escapeHtml(key)}${stale}</strong>
               <div class="gv-admin-diff-value"><span class="gv-admin-diff-label">Draft:</span> ${draftVal}</div>
               <div class="gv-admin-diff-value gv-admin-diff-value--pub"><span class="gv-admin-diff-label">Published:</span> ${pubVal}</div>
             </div>
           </article>`;
         }).join('')}</div>`
      : '';
    const sectionHtml = sectionKeys.length
      ? `<h3 class="gv-admin-section-title">Section Settings (${sectionKeys.length})</h3>
         <div class="gv-admin-row-list">${sectionKeys.map(key => {
           const row = sectionSettingsDrafts[key];
           const stale = isDraftStale(row) ? '<span class="gv-admin-stale-badge">stale</span>' : '';
           return `<article class="gv-admin-content-row gv-admin-compare-row">
             <div>
               <strong>${escapeHtml(key)}${stale}</strong>
               <span>Order: ${row?.order_index ?? '–'} / Visible: ${row?.is_visible ? 'Yes' : 'No'}</span>
             </div>
           </article>`;
         }).join('')}</div>`
      : '';
    const elementHtml = elementKeys.length
      ? `<h3 class="gv-admin-section-title">Element Styles (${elementKeys.length})</h3>
         <div class="gv-admin-row-list">${elementKeys.map(key => {
           const row = elementStyleDrafts[key];
           const pub = elementStylesPublished[key];
           const hasBp = vd17HasBreakpointFormat(row);
           const pubLabel = pub
             ? '<span class="gv-admin-stale-badge" style="background:rgba(97,191,255,.25);color:rgba(97,191,255,1)">published</span>'
             : '<span class="gv-admin-stale-badge">no published</span>';
           if (!hasBp) {
             const flatCount = row && row.styles ? Object.keys(row.styles).length : 0;
             return `<article class="gv-admin-content-row gv-admin-compare-row">
               <div>
                 <strong>${escapeHtml(key)}</strong> ${pubLabel}
                 <div class="gv-admin-diff-value">Legacy flat: ${flatCount} prop${flatCount !== 1 ? 's' : ''}</div>
               </div>
             </article>`;
           }
           // Phase 18: per-breakpoint property-level diff
           const bpDiffHtml = ['desktop','tablet','mobile'].map(bp => {
             const diffs = vd18BuildStyleDiff(row, pub, bp);
             if (!diffs.length) return '';
             const diffRows = diffs.map(d => {
               const pvStr = d.status !== 'added' ? `<span class="gv-vd18-diff-from">${escapeHtml(String(d.pv).slice(0,40))}</span><span class="gv-vd18-diff-arrow"> &rarr; </span>` : '';
               const dvStr = d.status !== 'removed' ? `<span class="gv-vd18-diff-to">${escapeHtml(String(d.dv).slice(0,40))}</span>` : `<span class="gv-vd18-diff-to gv-vd18-diff-removed">removed</span>`;
               return `<div class="gv-vd18-diff-row gv-vd18-diff-${escapeHtml(d.status)}">
                 <code class="gv-vd18-diff-prop">${escapeHtml(d.prop)}</code>
                 ${pvStr}${dvStr}
                 <span class="gv-vd18-diff-badge gv-vd18-diff-badge--${escapeHtml(d.status)}">${escapeHtml(d.status)}</span>
               </div>`;
             }).join('');
             return `<div class="gv-vd18-bp-section">
               <span class="gv-vd18-bp-label">${escapeHtml(bp.charAt(0).toUpperCase() + bp.slice(1))}</span>
               ${diffRows}
             </div>`;
           }).join('');
           const totalDiffs = ['desktop','tablet','mobile'].reduce((s, bp) => s + vd18BuildStyleDiff(row, pub, bp).length, 0);
           return `<article class="gv-admin-content-row gv-admin-compare-row">
             <div>
               <strong>${escapeHtml(key)}</strong> ${pubLabel}
               ${totalDiffs === 0 ? '<div class="gv-admin-diff-value">No changes vs published</div>' : bpDiffHtml}
             </div>
           </article>`;
         }).join('')}</div>`
      : '';
    return `
      ${staleWarn}
      ${contentHtml}
      ${tokenHtml}
      ${sectionHtml}
      ${elementHtml}
    `;
  }

  function renderCompareContentRow(draftRow) {
    const key = draftRow.edit_key || '';
    const type = draftRow.edit_type || 'text';
    const draftVal = (draftRow.value_text || '').slice(0, 200);
    const pubRow = dashboardPublishedRows.find(r => r.edit_key === key);
    const pubVal = pubRow ? (pubRow.value_text || '').slice(0, 200) : null;
    const origVal = originalValues[key] !== undefined ? String(originalValues[key]).slice(0, 200) : null;
    const stale = isDraftStale(draftRow) ? '<span class="gv-admin-stale-badge">stale</span>' : '';
    const isExpanded = draftCompareExpanded === key;
    const expandBtn = `<button class="gv-admin-action gv-admin-action--sm" type="button" data-admin-action="compare-expand" data-edit-key="${escapeHtml(key)}">${isExpanded ? 'Collapse' : 'Expand'}</button>`;
    const resetBtn = canAdminEdit()
      ? `<button class="gv-admin-action gv-admin-action--sm gv-admin-action--danger" type="button" data-admin-action="compare-reset-draft" data-edit-key="${escapeHtml(key)}">Undo Draft</button>`
      : '';
    const detail = isExpanded ? `
      <div class="gv-admin-diff-value"><span class="gv-admin-diff-label">Draft:</span> ${escapeHtml(draftVal)}</div>
      ${pubVal !== null ? `<div class="gv-admin-diff-value gv-admin-diff-value--pub"><span class="gv-admin-diff-label">Published:</span> ${escapeHtml(pubVal)}</div>` : ''}
      ${origVal !== null ? `<div class="gv-admin-diff-value gv-admin-diff-value--orig"><span class="gv-admin-diff-label">Original:</span> ${escapeHtml(origVal)}</div>` : ''}
    ` : `<div class="gv-admin-diff-value"><span class="gv-admin-diff-label">Draft:</span> ${escapeHtml(draftVal.slice(0, 80))}</div>`;
    return `
      <article class="gv-admin-content-row gv-admin-compare-row">
        <div>
          <strong>${escapeHtml(key)}${stale}</strong>
          <span>${escapeHtml(type)}</span>
          ${detail}
          <div class="gv-admin-compare-row-actions">${expandBtn} ${resetBtn}</div>
        </div>
      </article>
    `;
  }

  async function resetDraftToPublished(editKey) {
    if (!canAdminEdit()) {
      statusMessage = 'You do not have permission to undo drafts.';
      updateTopbar();
      return;
    }
    if (!editKey) return;
    if (!window.confirm(`Undo the draft for "${editKey}"? This restores the published (or original) value.`)) return;
    const draftRow = dashboardDraftRows.find(r => r.edit_key === editKey);
    if (!draftRow || !draftRow.id) {
      statusMessage = 'Draft row not found.';
      updateTopbar();
      return;
    }
    if (supabaseClient) {
      const { error } = await supabaseClient.from('cms_content').delete().eq('id', draftRow.id);
      if (error) {
        statusMessage = classifySupabaseError(error);
        updateTopbar();
        return;
      }
    }
    dashboardDraftRows = dashboardDraftRows.filter(r => r.edit_key !== editKey);
    const pubRow = dashboardPublishedRows.find(r => r.edit_key === editKey);
    const restoreVal = pubRow ? (pubRow.value_text || '') : (originalValues[editKey] !== undefined ? String(originalValues[editKey]) : '');
    if (restoreVal !== undefined) {
      const el = document.querySelector(`[data-edit-key="${CSS.escape(editKey)}"]`);
      if (el) el.textContent = restoreVal;
    }
    if (draftCompareExpanded === editKey) draftCompareExpanded = null;
    statusMessage = `Draft for "${editKey}" undone.`;
    unsavedCount = Math.max(0, unsavedCount - 1);
    updateTopbar();
    renderDashboard();
    logCmsDebug('reset-draft-to-published', { editKey });
  }

  // ── Phase 14: Visual Designer Engine ─────────────────────────────────────────
  //
  // Self-contained runtime engine. No new Supabase tables; style store is
  // in-memory only. Future phases add persistence and UI panels.
  // Public API exposed via window.GV_ADMIN_VISUAL for future panels.

  const VD_ALLOWED_STYLE_PROPS = new Set([
    // Inherited — also covered by existing ALLOWED_STYLE_PROPS sanitizers
    'color','backgroundColor','fontSize','fontFamily','fontWeight',
    'lineHeight','letterSpacing','textAlign',
    'marginTop','marginBottom','marginLeft','marginRight',
    'paddingTop','paddingBottom','paddingLeft','paddingRight',
    'borderColor','borderRadius','opacity','maxWidth',
    // Phase 14 additions
    'borderWidth','borderStyle',
    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
    'borderTopColor','borderRightColor','borderBottomColor','borderLeftColor',
    'boxShadow','textDecoration','textTransform',
    'display','flexDirection','flexWrap','justifyContent','alignItems','alignSelf','gap',
    'width','height','minHeight','minWidth','maxHeight',
    'transform','transition','overflow','objectFit','zIndex'
  ]);

  const VD_SAFE_DISPLAY = new Set(['block','inline','inline-block','flex','inline-flex','grid','inline-grid','none','contents','flow-root','table','table-cell','table-row']);
  const VD_SAFE_FLEX_DIR = new Set(['row','row-reverse','column','column-reverse']);
  const VD_SAFE_FLEX_WRAP = new Set(['nowrap','wrap','wrap-reverse']);
  const VD_SAFE_JUSTIFY = new Set(['flex-start','flex-end','center','space-between','space-around','space-evenly','start','end','normal']);
  const VD_SAFE_ALIGN = new Set(['flex-start','flex-end','center','baseline','stretch','start','end','normal','auto']);
  const VD_SAFE_OVERFLOW = new Set(['visible','hidden','scroll','auto','clip']);
  const VD_SAFE_TEXT_DEC = new Set(['none','underline','overline','line-through']);
  const VD_SAFE_TEXT_TRANS = new Set(['none','uppercase','lowercase','capitalize']);
  const VD_SAFE_OBJECT_FIT = new Set(['fill','contain','cover','none','scale-down']);
  const VD_SAFE_BORDER_STYLE = new Set(['none','solid','dashed','dotted','double','groove','ridge','inset','outset','hidden']);
  const VD_BREAKPOINTS = ['desktop', 'tablet', 'mobile'];
  const VD_MAX_HISTORY = 50;

  // ── VD state ──────────────────────────────────────────────────────────────

  let vdActive = false;
  let vdSelectedEl = null;
  let vdBreakpoint = 'desktop';
  let vdStyleStore = {};      // { storeKey: { desktop:{}, tablet:{}, mobile:{} } }
  let vdHistory = [];         // [ { storeKey, prop, breakpoint, before, after } ]
  let vdHistoryIndex = -1;
  let vdClipboard = null;     // { styles: {prop:val} }
  let vdOverlay = null;
  let vdOverlayRaf = null;
  let vdBatchRaf = null;
  let vdBatchQueue = null;
  let vdScrollBound = false;

  // Phase 16 Visual Panel state
  let vdVisualDirty = false;
  let vd18ResponsivePreview = 'none'; // Phase 18: 'none' | 'tablet' | 'mobile'
  // Phase 19: Contact Leads
  const LEAD_PIPELINE_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'nurture'];
  const LEAD_PIPELINE_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
  const LEAD_PIPELINE_STAGE_LABELS = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    proposal: 'Proposal',
    won: 'Won',
    lost: 'Lost',
    nurture: 'Nurture'
  };
  const LEAD_PIPELINE_PRIORITY_LABELS = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent'
  };
  const LEAD_TASK_STATUSES = ['open', 'completed', 'cancelled'];
  const LEAD_TASK_STATUS_LABELS = {
    open: 'Open',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  const LEAD_TASK_BASE_SELECT = 'id,lead_id,title,description,status,priority,assigned_to,due_at,completed_at,completed_by,created_by,created_by_email,updated_by,updated_by_email,metadata,created_at,updated_at';
  const LEAD_TASK_PHASE28_SELECT = `${LEAD_TASK_BASE_SELECT},reminder_enabled,reminder_sent_at,reminder_count,last_reminder_error,automation_source`;
  const TASK_AUTOMATION_STAGE_RULES = {
    contacted: { title: 'Follow up with lead', dueDays: 2, source: 'stage:contacted' },
    qualified: { title: 'Prepare proposal', dueDays: 3, source: 'stage:qualified' },
    proposal: { title: 'Follow up on proposal', dueDays: 3, source: 'stage:proposal' },
    won: { title: 'Onboarding next steps', dueDays: 1, source: 'stage:won' },
    lost: { title: 'Record loss reason', dueDays: 0, source: 'stage:lost' },
    nurture: { title: 'Nurture follow-up', dueDays: 14, source: 'stage:nurture' }
  };
  let leadsData = [];
  let leadsLoading = false;
  let leadsExpanded = null;
  let leadsFilter = 'all'; // 'all' | 'new' | 'read' | 'archived'
  let leadsPipelineFilters = {
    stage: 'all',
    priority: 'all',
    assigned: '',
    followup: 'all'
  };
  let leadBoardFilters = {
    priority: 'all',
    assigned: '',
    followup: 'all',
    showArchived: false
  };
  let leadPipelineSaveState = {
    id: null,
    status: 'idle',
    message: ''
  };
  let leadActivities = [];
  let leadActivitiesLoading = false;
  let leadActivitiesUnavailable = false;
  let leadTasks = [];
  let leadTasksLoading = false;
  let leadTasksError = '';
  let leadTasksUnavailable = false;
  let leadTaskReminderFieldsUnavailable = false;
  let leadTaskSaveState = {
    id: null,
    status: 'idle',
    message: ''
  };
  let leadTaskReminderState = {
    id: null,
    status: 'idle',
    message: ''
  };
  let leadTaskFilters = {
    status: 'open',
    priority: 'all',
    assigned: '',
    due: 'all',
    automation: 'all'
  };
  // Phase 20: test notification state
  let leadsNotifyState = 'idle'; // 'idle' | 'sending' | 'ok' | 'error'
  let leadsNotifyMsg = '';
  // Phase 21: notification log state
  let notificationLogs = [];
  let notificationLogsLoading = false;
  let notificationLogsError = '';
  let leadRetrying = null; // lead ID currently being retried

  // ── VD: Extended sanitizer ────────────────────────────────────────────────

  function vdSanitizeStyleValue(prop, v) {
    if (!prop || typeof v !== 'string') return null;
    v = v.trim();
    if (!VD_ALLOWED_STYLE_PROPS.has(prop)) return null;
    // Re-use existing sanitizers for inherited props
    if (ALLOWED_STYLE_PROPS.has(prop)) return sanitizeStyleValue(prop, v);
    if (!v) return '';
    if (prop === 'display') return VD_SAFE_DISPLAY.has(v) ? v : null;
    if (prop === 'flexDirection') return VD_SAFE_FLEX_DIR.has(v) ? v : null;
    if (prop === 'flexWrap') return VD_SAFE_FLEX_WRAP.has(v) ? v : null;
    if (prop === 'justifyContent') return VD_SAFE_JUSTIFY.has(v) ? v : null;
    if (prop === 'alignItems' || prop === 'alignSelf') return VD_SAFE_ALIGN.has(v) ? v : null;
    if (prop === 'overflow') return VD_SAFE_OVERFLOW.has(v) ? v : null;
    if (prop === 'textDecoration') return VD_SAFE_TEXT_DEC.has(v) ? v : null;
    if (prop === 'textTransform') return VD_SAFE_TEXT_TRANS.has(v) ? v : null;
    if (prop === 'objectFit') return VD_SAFE_OBJECT_FIT.has(v) ? v : null;
    if (prop === 'borderStyle') return VD_SAFE_BORDER_STYLE.has(v) ? v : null;
    if (['borderTopColor','borderRightColor','borderBottomColor','borderLeftColor'].includes(prop)) return sanitizeColorValue(v);
    if (prop === 'boxShadow') {
      if (v === 'none') return 'none';
      if (/^[\d\s\-\.px%rgba(),#a-fA-F]+$/.test(v) && v.length < 120) return v;
      return null;
    }
    if (prop === 'transform') {
      if (v === 'none') return 'none';
      if (/^(translate|scale|rotate|skew)(X|Y|Z|3d)?\([\d\-\.,\s%pxdegradturn]+\)$/.test(v)) return v;
      return null;
    }
    if (prop === 'transition') {
      if (v === 'none' || v === 'all 0s') return v;
      if (/^[\w\s,\.\-]+$/.test(v) && v.length < 80) return v;
      return null;
    }
    if (prop === 'zIndex') {
      const n = parseInt(v, 10);
      return (!isNaN(n) && n >= -999 && n <= 9999) ? String(n) : null;
    }
    if (prop === 'gap') return sanitizeSizeValue(v);
    if (['width','height','minHeight','minWidth','maxHeight',
         'borderWidth','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].includes(prop)) {
      if (v === 'auto') return 'auto';
      return sanitizeSizeValue(v);
    }
    return null;
  }

  // ── VD: Style store ───────────────────────────────────────────────────────

  function vdGetStoreKey(el) {
    if (!el) return null;
    return el.dataset.editKey || el.dataset.sectionId || null;
  }

  function vdGetStoredStyles(el, bp) {
    const key = vdGetStoreKey(el);
    if (!key) return {};
    return (vdStyleStore[key] && vdStyleStore[key][bp]) ? Object.assign({}, vdStyleStore[key][bp]) : {};
  }

  function vdSetStoredStyle(el, prop, val, bp) {
    const key = vdGetStoreKey(el);
    if (!key) return;
    if (!vdStyleStore[key]) vdStyleStore[key] = { desktop: {}, tablet: {}, mobile: {} };
    if (!vdStyleStore[key][bp]) vdStyleStore[key][bp] = {};
    if (val === '' || val === null) delete vdStyleStore[key][bp][prop];
    else vdStyleStore[key][bp][prop] = val;
  }

  function vdGetComputedStyleSnapshot(el) {
    if (!el) return {};
    try {
      const cs = window.getComputedStyle(el);
      const out = {};
      VD_ALLOWED_STYLE_PROPS.forEach(prop => {
        try { out[prop] = cs[prop] || ''; } catch (e) { /* skip */ }
      });
      return out;
    } catch (e) { return {}; }
  }

  function vdReadElementStyles(el) {
    return {
      computed: vdGetComputedStyleSnapshot(el),
      stored: {
        desktop: vdGetStoredStyles(el, 'desktop'),
        tablet: vdGetStoredStyles(el, 'tablet'),
        mobile: vdGetStoredStyles(el, 'mobile')
      }
    };
  }

  // ── VD: Style writing ─────────────────────────────────────────────────────

  function vdApplyStyleDirect(el, prop, val) {
    if (!el) return;
    try { el.style[prop] = val; } catch (e) { /* skip */ }
  }

  function vdWriteStyle(el, prop, val, breakpoint) {
    if (!el || !prop) return false;
    const bp = VD_BREAKPOINTS.includes(breakpoint) ? breakpoint : vdBreakpoint;
    const safe = vdSanitizeStyleValue(prop, String(val != null ? val : ''));
    if (safe === null) return false;
    const before = (vdGetStoredStyles(el, bp))[prop] || '';
    vdSetStoredStyle(el, prop, safe, bp);
    if (bp === vdBreakpoint) vdApplyStyleDirect(el, prop, safe);
    vdHistoryPush({ storeKey: vdGetStoreKey(el), prop, breakpoint: bp, before, after: safe });
    return true;
  }

  function vdBatchWriteStyles(el, styles, breakpoint) {
    if (!el || !styles) return;
    if (vdBatchRaf) cancelAnimationFrame(vdBatchRaf);
    if (!vdBatchQueue) vdBatchQueue = { el, styles: {}, breakpoint: breakpoint || vdBreakpoint };
    Object.assign(vdBatchQueue.styles, styles);
    vdBatchRaf = requestAnimationFrame(() => {
      vdBatchRaf = null;
      if (!vdBatchQueue) return;
      const { el: bEl, styles: bStyles, breakpoint: bBp } = vdBatchQueue;
      vdBatchQueue = null;
      Object.entries(bStyles).forEach(([p, v]) => vdWriteStyle(bEl, p, v, bBp));
      vdScheduleOverlayUpdate();
    });
  }

  function vdApplyBreakpointStyles(el, bp) {
    if (!el) return;
    const target = VD_BREAKPOINTS.includes(bp) ? bp : vdBreakpoint;
    const desktop = vdGetStoredStyles(el, 'desktop');
    const stored = vdGetStoredStyles(el, target);
    VD_ALLOWED_STYLE_PROPS.forEach(prop => { try { el.style[prop] = ''; } catch (e) {} });
    if (target !== 'desktop') Object.entries(desktop).forEach(([p, v]) => vdApplyStyleDirect(el, p, v));
    Object.entries(stored).forEach(([p, v]) => vdApplyStyleDirect(el, p, v));
  }

  function vdSetBreakpoint(bp) {
    if (!VD_BREAKPOINTS.includes(bp)) return;
    vdBreakpoint = bp;
    if (vdSelectedEl) vdApplyBreakpointStyles(vdSelectedEl, bp);
  }

  // ── VD: History (undo/redo) ───────────────────────────────────────────────

  function vdHistoryPush(entry) {
    vdHistory = vdHistory.slice(0, vdHistoryIndex + 1);
    vdHistory.push(entry);
    if (vdHistory.length > VD_MAX_HISTORY) vdHistory.shift();
    else vdHistoryIndex = vdHistory.length - 1;
  }

  function vdFindEl(storeKey) {
    if (!storeKey) return null;
    return document.querySelector(`[data-edit-key="${cssEscape(storeKey)}"]`) ||
           document.querySelector(`[data-section-id="${cssEscape(storeKey)}"]`);
  }

  function vdHistoryUndo() {
    if (vdHistoryIndex < 0) return false;
    const entry = vdHistory[vdHistoryIndex];
    vdHistoryIndex--;
    if (!entry) return false;
    const el = vdFindEl(entry.storeKey);
    if (el) {
      vdSetStoredStyle(el, entry.prop, entry.before, entry.breakpoint);
      if (entry.breakpoint === vdBreakpoint) vdApplyStyleDirect(el, entry.prop, entry.before);
    }
    return true;
  }

  function vdHistoryRedo() {
    if (vdHistoryIndex >= vdHistory.length - 1) return false;
    vdHistoryIndex++;
    const entry = vdHistory[vdHistoryIndex];
    if (!entry) return false;
    const el = vdFindEl(entry.storeKey);
    if (el) {
      vdSetStoredStyle(el, entry.prop, entry.after, entry.breakpoint);
      if (entry.breakpoint === vdBreakpoint) vdApplyStyleDirect(el, entry.prop, entry.after);
    }
    return true;
  }

  // ── VD: Clipboard (copy / paste styles) ──────────────────────────────────

  function vdClipboardCopy(el) {
    if (!el) return;
    vdClipboard = { styles: Object.assign({}, vdGetStoredStyles(el, vdBreakpoint)) };
  }

  function vdClipboardPaste(el) {
    if (!el || !vdClipboard) return;
    Object.entries(vdClipboard.styles).forEach(([prop, val]) => vdWriteStyle(el, prop, val, vdBreakpoint));
  }

  // ── VD: Selection ─────────────────────────────────────────────────────────

  function vdSelect(el) {
    vdSelectedEl = el || null;
    vdScheduleOverlayUpdate();
  }

  function vdDeselect() {
    vdSelectedEl = null;
    vdHideOverlay();
  }

  function vdSelectParent() {
    if (!vdSelectedEl) return;
    const parent = vdSelectedEl.parentElement;
    if (!parent || parent === document.body || parent.closest('[data-admin-ui]')) return;
    const target = parent.dataset.editKey ? parent : parent.closest('[data-edit-key]');
    if (target) selectElement(target);
  }

  function vdSelectChild(index) {
    if (!vdSelectedEl) return;
    const children = Array.from(vdSelectedEl.children).filter(c => !c.closest('[data-admin-ui]') && c.dataset.editKey);
    const child = children[index || 0];
    if (child) selectElement(child);
  }

  // ── VD: Box model overlay ─────────────────────────────────────────────────

  function vdBuildOverlay() {
    if (vdOverlay) return;
    vdOverlay = document.createElement('div');
    vdOverlay.className = 'gv-vd-overlay';
    vdOverlay.setAttribute('aria-hidden', 'true');
    vdOverlay.innerHTML =
      '<div class="gv-vd-layer gv-vd-margin" data-vd-layer="margin"></div>' +
      '<div class="gv-vd-layer gv-vd-border" data-vd-layer="border"></div>' +
      '<div class="gv-vd-layer gv-vd-padding" data-vd-layer="padding"></div>' +
      '<div class="gv-vd-layer gv-vd-content" data-vd-layer="content"></div>' +
      '<div class="gv-vd-label" data-vd-label></div>' +
      '<div class="gv-vd-boxmodel" data-vd-boxmodel></div>';
    document.body.appendChild(vdOverlay);
  }

  function vdDestroyOverlay() {
    if (vdOverlay && vdOverlay.parentNode) vdOverlay.parentNode.removeChild(vdOverlay);
    vdOverlay = null;
  }

  function vdHideOverlay() {
    if (vdOverlay) vdOverlay.classList.remove('is-active');
  }

  function vdSetLayerRect(selector, r) {
    if (!vdOverlay) return;
    const el = vdOverlay.querySelector(selector);
    if (!el) return;
    el.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + Math.max(0, r.width) + 'px;height:' + Math.max(0, r.height) + 'px';
  }

  function vdUpdateOverlay(el) {
    if (!vdOverlay || !el) { vdHideOverlay(); return; }
    if (el === document.body || el.closest('[data-admin-ui]') || el === vdOverlay) { vdHideOverlay(); return; }

    let rect;
    try { rect = el.getBoundingClientRect(); } catch (e) { vdHideOverlay(); return; }
    if (!rect.width && !rect.height) { vdHideOverlay(); return; }

    let cs;
    try { cs = window.getComputedStyle(el); } catch (e) { vdHideOverlay(); return; }

    const mt = parseFloat(cs.marginTop) || 0;
    const mb = parseFloat(cs.marginBottom) || 0;
    const ml = parseFloat(cs.marginLeft) || 0;
    const mr = parseFloat(cs.marginRight) || 0;
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth) || 0;
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;

    vdSetLayerRect('[data-vd-layer="margin"]', {
      left: rect.left - ml, top: rect.top - mt,
      width: rect.width + ml + mr, height: rect.height + mt + mb
    });
    vdSetLayerRect('[data-vd-layer="border"]', rect);
    vdSetLayerRect('[data-vd-layer="padding"]', {
      left: rect.left + bl, top: rect.top + bt,
      width: rect.width - bl - br, height: rect.height - bt - bb
    });
    vdSetLayerRect('[data-vd-layer="content"]', {
      left: rect.left + bl + pl, top: rect.top + bt + pt,
      width: rect.width - bl - br - pl - pr, height: rect.height - bt - bb - pt - pb
    });

    const labelEl = vdOverlay.querySelector('[data-vd-label]');
    if (labelEl) {
      const tag = el.tagName.toLowerCase();
      const key = el.dataset.editKey || el.dataset.sectionId || '';
      const suffix = key ? ' [' + key.split('.').pop().slice(0, 20) + ']' : '';
      const dims = Math.round(rect.width) + '×' + Math.round(rect.height);
      labelEl.textContent = tag + suffix + ' ' + dims;
      labelEl.style.cssText = 'left:' + rect.left + 'px;top:' + Math.max(4, rect.top - 22) + 'px';
    }

    const boxEl = vdOverlay.querySelector('[data-vd-boxmodel]');
    if (boxEl) {
      const cw = Math.round(rect.width - bl - br - pl - pr);
      const ch = Math.round(rect.height - bt - bb - pt - pb);
      const parts = [];
      if (mt || mr || mb || ml) parts.push('M ' + [mt,mr,mb,ml].map(Math.round).join(' '));
      if (bt || br || bb || bl) parts.push('B ' + [bt,br,bb,bl].map(Math.round).join(' '));
      if (pt || pr || pb || pl) parts.push('P ' + [pt,pr,pb,pl].map(Math.round).join(' '));
      parts.push(cw + '×' + ch);
      boxEl.textContent = parts.join('  ');
      const bx = Math.min(rect.left - ml, window.innerWidth - 180);
      const by = Math.min(rect.bottom + mb + 4, window.innerHeight - 36);
      boxEl.style.cssText = 'left:' + Math.max(4, bx) + 'px;top:' + Math.max(4, by) + 'px';
    }

    vdOverlay.classList.add('is-active');
  }

  function vdScheduleOverlayUpdate() {
    if (vdOverlayRaf) cancelAnimationFrame(vdOverlayRaf);
    vdOverlayRaf = requestAnimationFrame(() => {
      vdOverlayRaf = null;
      if (vdSelectedEl && document.body.classList.contains('admin-edit-mode')) {
        vdUpdateOverlay(vdSelectedEl);
      } else {
        vdHideOverlay();
      }
    });
  }

  // ── VD: Scroll + resize tracking ─────────────────────────────────────────

  function _vdOnScroll() { vdScheduleOverlayUpdate(); }
  function _vdOnResize() { vdScheduleOverlayUpdate(); }

  function vdBindScrollResize() {
    if (vdScrollBound) return;
    vdScrollBound = true;
    window.addEventListener('scroll', _vdOnScroll, { passive: true, capture: true });
    window.addEventListener('resize', _vdOnResize, { passive: true });
  }

  function vdUnbindScrollResize() {
    vdScrollBound = false;
    window.removeEventListener('scroll', _vdOnScroll, { capture: true });
    window.removeEventListener('resize', _vdOnResize);
  }

  // ── VD: Activate / Deactivate ─────────────────────────────────────────────

  function vdActivate() {
    if (vdActive) return;
    vdActive = true;
    vdBuildOverlay();
    vdBindScrollResize();
    if (cmsDebug) console.log('[GV Visual Designer Engine] activated');
  }

  function vdDeactivate() {
    if (!vdActive) return;
    vdActive = false;
    vdDeselect();
    vdDestroyOverlay();
    vdUnbindScrollResize();
    if (vdBatchRaf) { cancelAnimationFrame(vdBatchRaf); vdBatchRaf = null; }
    vdBatchQueue = null;
    if (vdOverlayRaf) { cancelAnimationFrame(vdOverlayRaf); vdOverlayRaf = null; }
    if (cmsDebug) console.log('[GV Visual Designer Engine] deactivated');
  }

  // ── VD: Developer hook (window.GV_ADMIN_VISUAL) ───────────────────────────
  //
  // Future panel phases import this object to drive the engine.
  // All writes go through sanitizers; no raw CSS injection possible.

  window.GV_ADMIN_VISUAL = Object.freeze({
    version: '14.0',
    breakpoints: VD_BREAKPOINTS.slice(),
    allowedProps: Array.from(VD_ALLOWED_STYLE_PROPS),
    get active() { return vdActive; },
    get selectedEl() { return vdSelectedEl; },
    get breakpoint() { return vdBreakpoint; },
    get historyLength() { return vdHistory.length; },
    get historyIndex() { return vdHistoryIndex; },
    get hasUndo() { return vdHistoryIndex >= 0; },
    get hasRedo() { return vdHistoryIndex < vdHistory.length - 1; },
    get hasClipboard() { return Boolean(vdClipboard); },
    // Selection
    select: function (el) { if (el instanceof Element && !el.closest('[data-admin-ui]')) selectElement(el); },
    deselect: vdDeselect,
    selectParent: vdSelectParent,
    selectChild: vdSelectChild,
    // Style abstraction
    readStyles: vdReadElementStyles,
    writeStyle: vdWriteStyle,
    batchWriteStyles: vdBatchWriteStyles,
    applyBreakpointStyles: vdApplyBreakpointStyles,
    setBreakpoint: vdSetBreakpoint,
    snapshot: vdGetComputedStyleSnapshot,
    sanitize: vdSanitizeStyleValue,
    // History
    undo: vdHistoryUndo,
    redo: vdHistoryRedo,
    // Clipboard
    copyStyles: vdClipboardCopy,
    pasteStyles: vdClipboardPaste,
    // Introspection
    getStyleStore: function () { return JSON.parse(JSON.stringify(vdStyleStore)); },
    // Overlay
    updateOverlay: vdScheduleOverlayUpdate
  });

  // ── Phase 16: Visual Properties Panel ────────────────────────────────────

  function vd16HydrateStoreEntry(editKey, styleJson) {
    if (!editKey || !styleJson || typeof styleJson !== 'object') return;
    const hasBpFormat = VD_BREAKPOINTS.some(bp => styleJson[bp] && typeof styleJson[bp] === 'object');
    if (!hasBpFormat) return;
    if (!vdStyleStore[editKey]) vdStyleStore[editKey] = { desktop: {}, tablet: {}, mobile: {} };
    VD_BREAKPOINTS.forEach(bp => {
      if (styleJson[bp] && typeof styleJson[bp] === 'object') {
        vdStyleStore[editKey][bp] = Object.assign({}, styleJson[bp]);
      }
    });
  }

  function renderVisualTabHTML(el) {
    if (!el || !window.GV_ADMIN_VISUAL) {
      return '<p class="gv-admin-empty">Visual Designer Engine not available.</p>';
    }
    const vd = window.GV_ADMIN_VISUAL;
    const editKey = el.dataset.editKey || '';
    const bp = vdBreakpoint;
    const storedAll = vdStyleStore[editKey] || {};
    const bpStyles = storedAll[bp] || {};
    const canEdit = canAdminEdit();
    const canSave = !!editKey && canEdit;

    function esc(v) { return escapeHtml(String(v || '')); }
    function storedVal(prop) { return bpStyles[prop] || ''; }

    function renderControl(prop, cfg) {
      const v = esc(storedVal(prop));
      const dis = canEdit ? '' : ' disabled';
      if (cfg.type === 'select') {
        const opts = cfg.opts.map(o => `<option value="${escapeHtml(o)}"${storedVal(prop) === o && o !== '' ? ' selected' : ''}>${escapeHtml(o) || '—'}</option>`).join('');
        return `<select class="gv-vd-ctrl" data-vd-prop="${prop}"${dis}>${opts}</select>`;
      }
      if (cfg.type === 'color') {
        const stored = storedVal(prop);
        const hex = /^#[0-9a-fA-F]{3,8}$/.test(stored) ? stored : '#000000';
        return `<div class="gv-vd-color-row"><input type="color" class="gv-vd-swatch" data-vd-swatch="${prop}" value="${esc(hex)}"${dis}><input type="text" class="gv-vd-ctrl" data-vd-prop="${prop}" value="${v}" placeholder="${esc(cfg.placeholder || '#000000')}"${dis}></div>`;
      }
      return `<input type="text" class="gv-vd-ctrl" data-vd-prop="${prop}" value="${v}" placeholder="${esc(cfg.placeholder || '')}"${dis}>`;
    }

    const GROUPS = [
      { id: 'typography', label: 'Typography', props: [
        { prop: 'color',           label: 'Color',          type: 'color' },
        { prop: 'fontSize',        label: 'Font Size',      type: 'text',   placeholder: '16px' },
        { prop: 'fontWeight',      label: 'Weight',         type: 'select', opts: ['','100','200','300','400','500','600','700','800','900','normal','bold'] },
        { prop: 'lineHeight',      label: 'Line Height',    type: 'text',   placeholder: '1.5' },
        { prop: 'letterSpacing',   label: 'Letter Spacing', type: 'text',   placeholder: '0' },
        { prop: 'textAlign',       label: 'Align',          type: 'select', opts: ['','left','center','right','justify'] },
        { prop: 'textTransform',   label: 'Transform',      type: 'select', opts: ['','none','uppercase','lowercase','capitalize'] },
        { prop: 'textDecoration',  label: 'Decoration',     type: 'select', opts: ['','none','underline','overline','line-through'] },
      ]},
      { id: 'spacing', label: 'Spacing', props: [
        { prop: 'marginTop',       label: 'Margin Top',     type: 'text', placeholder: '0' },
        { prop: 'marginRight',     label: 'Margin Right',   type: 'text', placeholder: '0' },
        { prop: 'marginBottom',    label: 'Margin Bottom',  type: 'text', placeholder: '0' },
        { prop: 'marginLeft',      label: 'Margin Left',    type: 'text', placeholder: '0' },
        { prop: 'paddingTop',      label: 'Padding Top',    type: 'text', placeholder: '0' },
        { prop: 'paddingRight',    label: 'Padding Right',  type: 'text', placeholder: '0' },
        { prop: 'paddingBottom',   label: 'Padding Bottom', type: 'text', placeholder: '0' },
        { prop: 'paddingLeft',     label: 'Padding Left',   type: 'text', placeholder: '0' },
        { prop: 'gap',             label: 'Gap',            type: 'text', placeholder: '0' },
      ]},
      { id: 'layout', label: 'Layout', props: [
        { prop: 'display',         label: 'Display',        type: 'select', opts: ['','block','inline','inline-block','flex','inline-flex','grid','inline-grid','none'] },
        { prop: 'flexDirection',   label: 'Flex Dir',       type: 'select', opts: ['','row','row-reverse','column','column-reverse'] },
        { prop: 'flexWrap',        label: 'Flex Wrap',      type: 'select', opts: ['','nowrap','wrap','wrap-reverse'] },
        { prop: 'justifyContent',  label: 'Justify',        type: 'select', opts: ['','flex-start','flex-end','center','space-between','space-around','space-evenly'] },
        { prop: 'alignItems',      label: 'Align Items',    type: 'select', opts: ['','flex-start','flex-end','center','baseline','stretch'] },
        { prop: 'alignSelf',       label: 'Align Self',     type: 'select', opts: ['','auto','flex-start','flex-end','center','baseline','stretch'] },
        { prop: 'overflow',        label: 'Overflow',       type: 'select', opts: ['','visible','hidden','scroll','auto','clip'] },
      ]},
      { id: 'size', label: 'Size', props: [
        { prop: 'width',           label: 'Width',          type: 'text', placeholder: 'auto' },
        { prop: 'height',          label: 'Height',         type: 'text', placeholder: 'auto' },
        { prop: 'minWidth',        label: 'Min Width',      type: 'text', placeholder: '0' },
        { prop: 'maxWidth',        label: 'Max Width',      type: 'text', placeholder: 'none' },
        { prop: 'minHeight',       label: 'Min Height',     type: 'text', placeholder: '0' },
        { prop: 'maxHeight',       label: 'Max Height',     type: 'text', placeholder: 'none' },
      ]},
      { id: 'border', label: 'Border', props: [
        { prop: 'borderWidth',     label: 'Width',          type: 'text', placeholder: '0' },
        { prop: 'borderStyle',     label: 'Style',          type: 'select', opts: ['','none','solid','dashed','dotted','double'] },
        { prop: 'borderColor',     label: 'Color',          type: 'color' },
        { prop: 'borderRadius',    label: 'Radius',         type: 'text', placeholder: '0' },
      ]},
      { id: 'effects', label: 'Effects', props: [
        { prop: 'backgroundColor', label: 'Background',     type: 'color' },
        { prop: 'opacity',         label: 'Opacity',        type: 'text', placeholder: '1' },
        { prop: 'boxShadow',       label: 'Box Shadow',     type: 'text', placeholder: 'none' },
        { prop: 'transform',       label: 'Transform',      type: 'text', placeholder: 'none' },
        { prop: 'transition',      label: 'Transition',     type: 'text', placeholder: 'none' },
        { prop: 'zIndex',          label: 'Z-Index',        type: 'text', placeholder: '0' },
      ]},
    ];

    const bpBtns = VD_BREAKPOINTS.map(b =>
      `<button type="button" class="gv-vd-bp-btn${bp === b ? ' is-active' : ''}" data-admin-action="vd-bp-switch" data-vd-bp="${b}" aria-pressed="${bp === b ? 'true' : 'false'}">${b.charAt(0).toUpperCase() + b.slice(1)}</button>`
    ).join('');

    const hasAnyStyles = VD_BREAKPOINTS.some(b => Object.keys((storedAll[b] || {})).length > 0);
    const saveBtnLabel = vdVisualDirty ? 'Save Visual Draft*' : 'Save Visual Draft';
    // Phase 18: prop count summary per breakpoint for save bar
    const vd18PropSummary = VD_BREAKPOINTS.map(b => {
      const cnt = Object.keys(storedAll[b] || {}).length;
      return `${b.charAt(0).toUpperCase() + b.slice(1)}: ${cnt}`;
    }).join(' / ');

    const groups = GROUPS.map(g => {
      const rows = g.props.map(cfg => `
        <div class="gv-vd-row">
          <span class="gv-vd-lbl">${esc(cfg.label)}</span>
          ${renderControl(cfg.prop, cfg)}
        </div>
      `).join('');
      return `
        <details class="gv-vd-group" open>
          <summary class="gv-vd-group-head">${esc(g.label)}</summary>
          <div class="gv-vd-group-body">${rows}</div>
        </details>
      `;
    }).join('');

    // Phase 18: responsive preview frame controls
    const vd18RpBtns = ['tablet', 'mobile', 'reset'].map(b => {
      const label = b === 'reset' ? 'Clear Frame' : esc(b.charAt(0).toUpperCase() + b.slice(1)) + ' Frame';
      const isActive = vd18ResponsivePreview === b;
      return `<button type="button" class="gv-vd-bp-btn${isActive ? ' is-active' : ''}" data-admin-action="vd18-resp-preview" data-vd18-bp="${b}">${label}</button>`;
    }).join('');

    return `
      <div class="gv-vd-panel">
        <div class="gv-vd-bp-bar" role="group" aria-label="Breakpoint switcher">${bpBtns}</div>
        <p class="gv-vd-bp-hint">Editing <strong>${esc(bp)}</strong> styles${editKey ? ` for <code>${esc(editKey)}</code>` : ''}</p>
        <div class="gv-vd-rp-bar" role="group" aria-label="Responsive preview frame">${vd18RpBtns}</div>
        ${vd18ResponsivePreview !== 'none' ? `<p class="gv-vd-bp-hint gv-vd-rp-hint">Showing <strong>${esc(vd18ResponsivePreview)}</strong> frame. Resize browser to see true responsive layout.</p>` : ''}
        <div class="gv-vd-actions-bar">
          <button type="button" class="gv-vd-act" data-admin-action="vd-undo" title="Undo (Ctrl+Z)"${!canEdit || !vd.hasUndo ? ' disabled' : ''}>Undo</button>
          <button type="button" class="gv-vd-act" data-admin-action="vd-redo" title="Redo (Ctrl+Y)"${!canEdit || !vd.hasRedo ? ' disabled' : ''}>Redo</button>
          <button type="button" class="gv-vd-act" data-admin-action="vd-copy" title="Copy breakpoint styles">Copy</button>
          <button type="button" class="gv-vd-act" data-admin-action="vd-paste" title="Paste styles"${!canEdit || !vd.hasClipboard ? ' disabled' : ''}>Paste</button>
          <button type="button" class="gv-vd-act gv-vd-act--warn" data-admin-action="vd-reset" title="Reset all VD styles for this element"${!canEdit || !hasAnyStyles ? ' disabled' : ''}>Reset</button>
        </div>
        ${groups}
        <div class="gv-vd-save-bar">
          <button type="button" class="gv-admin-action gv-admin-action--mint" data-admin-action="vd-save"${!canSave ? ' disabled' : ''}>${escapeHtml(saveBtnLabel)}</button>
          ${!editKey ? '<span class="gv-vd-save-note">No edit key — live preview only, cannot persist.</span>' : ''}
          ${canSave && hasAnyStyles ? `<span class="gv-vd-save-note">${esc(vd18PropSummary)}</span>` : ''}
        </div>
      </div>
    `;
  }

  function bindVisualTabEvents() {
    const panelBody = $('[data-admin-panel-body]', panel);
    if (!panelBody || !window.GV_ADMIN_VISUAL) return;

    function markDirty() {
      vdVisualDirty = true;
      const saveBtn = panelBody.querySelector('[data-admin-action="vd-save"]');
      if (saveBtn && !saveBtn.textContent.includes('*')) saveBtn.textContent = 'Save Visual Draft*';
    }

    // Text / select controls
    panelBody.querySelectorAll('.gv-vd-ctrl[data-vd-prop]').forEach(input => {
      input.addEventListener('input', function () {
        if (!selectedElement || !canAdminEdit()) return;
        const prop = this.dataset.vdProp;
        if (!prop) return;
        if (window.GV_ADMIN_VISUAL.writeStyle(selectedElement, prop, this.value, vdBreakpoint) !== false) {
          markDirty();
          // Sync color swatch if this is a color text input
          const swatch = panelBody.querySelector(`.gv-vd-swatch[data-vd-swatch="${prop}"]`);
          if (swatch && /^#[0-9a-fA-F]{3,8}$/.test(this.value)) swatch.value = this.value;
        }
      });
    });

    // Color swatches
    panelBody.querySelectorAll('.gv-vd-swatch[data-vd-swatch]').forEach(swatch => {
      swatch.addEventListener('input', function () {
        if (!selectedElement || !canAdminEdit()) return;
        const prop = this.dataset.vdSwatch;
        if (!prop) return;
        // Sync hex text input
        const hexInput = panelBody.querySelector(`.gv-vd-ctrl[data-vd-prop="${prop}"]`);
        if (hexInput) hexInput.value = this.value;
        if (window.GV_ADMIN_VISUAL.writeStyle(selectedElement, prop, this.value, vdBreakpoint) !== false) {
          markDirty();
        }
      });
    });
  }

  async function saveVisualStyleDraft(el) {
    if (!el || !canAdminEdit()) return;
    const editKey = el.dataset.editKey || '';
    if (!editKey) {
      statusMessage = 'Cannot save: element has no edit key.';
      updateTopbar();
      return;
    }

    // Phase 18: prevent saving when nothing has been set in the VD panel
    const store = vdStyleStore[editKey] || {};
    const vd18TotalVdProps = VD_BREAKPOINTS.reduce((sum, b) => sum + Object.keys(store[b] || {}).length, 0);
    const vd18HasLegacy = !!(elementStyleDrafts[editKey] && elementStyleDrafts[editKey].styles) ||
                          !!(elementStylesPublished[editKey] && elementStylesPublished[editKey].styles);
    if (vd18TotalVdProps === 0 && !vd18HasLegacy) {
      statusMessage = 'Nothing to save — no visual styles set for this element.';
      updateTopbar();
      return;
    }

    // Compose breakpoint-aware style_json; preserve legacy styles key if present
    const existing = elementStyleDrafts[editKey] || elementStylesPublished[editKey];
    const merged = Object.assign(
      existing && existing.styles ? { styles: existing.styles } : {},
      {
        desktop: Object.assign({}, store.desktop || {}),
        tablet:  Object.assign({}, store.tablet  || {}),
        mobile:  Object.assign({}, store.mobile  || {}),
      }
    );

    const saveBtn = $('[data-admin-action="vd-save"]', $('[data-admin-panel-body]', panel));
    if (saveBtn) saveBtn.textContent = 'Saving...';

    if (isMockAdminSession()) {
      elementStyleDrafts[editKey] = merged;
      vdVisualDirty = false;
      vd17InjectDraftCSS();
      statusMessage = 'Visual styles saved (mock session).';
      updateTopbar();
      if (selectedElement === el && inspectorTab === 'visual') renderInspector(el);
      return;
    }

    const error = await saveElementStyleDraftData(editKey, merged);
    vdVisualDirty = false;
    vd17InjectDraftCSS();
    statusMessage = error ? 'Failed to save visual styles.' : 'Visual styles saved.';
    updateTopbar();
    if (selectedElement === el && inspectorTab === 'visual') renderInspector(el);
  }

  async function resetVisualStyleDraft(el) {
    if (!el || !canAdminEdit()) return;
    const editKey = el.dataset.editKey || '';
    // Phase 18: show per-breakpoint counts in confirm message, block if nothing to reset
    const vd18Store = vdStyleStore[editKey] || {};
    const vd18DeskCount = Object.keys(vd18Store.desktop || {}).length;
    const vd18TabCount  = Object.keys(vd18Store.tablet  || {}).length;
    const vd18MobCount  = Object.keys(vd18Store.mobile  || {}).length;
    if (vd18DeskCount + vd18TabCount + vd18MobCount === 0) {
      statusMessage = 'No Visual Designer styles to reset for this element.';
      updateTopbar();
      return;
    }
    const vd18ConfirmMsg = `Reset Visual Designer styles for "${editKey}"?\n\nThis will clear:\n- Desktop: ${vd18DeskCount} prop${vd18DeskCount !== 1 ? 's' : ''}\n- Tablet: ${vd18TabCount} prop${vd18TabCount !== 1 ? 's' : ''}\n- Mobile: ${vd18MobCount} prop${vd18MobCount !== 1 ? 's' : ''}\n\nLegacy Style tab overrides are preserved. Published styles are not deleted until you publish.`;
    if (!window.confirm(vd18ConfirmMsg)) return;

    // Collect all VD-managed props so we can remove them from inline style
    const store = vdStyleStore[editKey] || {};
    const allVdProps = new Set();
    VD_BREAKPOINTS.forEach(b => Object.keys(store[b] || {}).forEach(p => allVdProps.add(p)));

    // Remove VD styles from DOM
    allVdProps.forEach(p => el.style.removeProperty(p.replace(/([A-Z])/g, '-$1').toLowerCase()));

    // Re-apply legacy styles if any (preserves old Style-tab overrides)
    const draft = elementStyleDrafts[editKey];
    const pub = elementStylesPublished[editKey];
    const legacyStyles = (draft && draft.styles) || (pub && pub.styles);
    if (legacyStyles) {
      Object.entries(legacyStyles).forEach(([p, v]) => {
        const safe = sanitizeStyleValue(p, String(v));
        if (safe !== null) el.style[p] = safe;
      });
    }

    // Clear in-memory VD store
    vdStyleStore[editKey] = { desktop: {}, tablet: {}, mobile: {} };
    vdVisualDirty = false;

    if (isMockAdminSession()) {
      if (legacyStyles) elementStyleDrafts[editKey] = { styles: legacyStyles };
      else delete elementStyleDrafts[editKey];
    } else if (supabaseClient && currentUser && editKey) {
      if (legacyStyles) {
        const merged = { styles: legacyStyles, desktop: {}, tablet: {}, mobile: {} };
        await saveElementStyleDraftData(editKey, merged);
      } else if (draft) {
        await supabaseClient.from('cms_element_styles').delete()
          .eq('page_path', pagePath)
          .eq('edit_key', editKey)
          .eq('status', 'draft');
        delete elementStyleDrafts[editKey];
      }
    }

    vd17InjectDraftCSS();
    statusMessage = 'Visual styles reset.';
    updateTopbar();
    if (selectedElement === el && inspectorTab === 'visual') renderInspector(el);
  }

  // ── Phase 17: Responsive Style Runtime + Public CSS Publisher ───────────────

  // Breakpoints: desktop = no query, tablet = ≤991px, mobile = ≤767px
  const VD17_BREAKPOINTS = {
    desktop: null,
    tablet:  '(max-width:991px)',
    mobile:  '(max-width:767px)'
  };

  function vd17HasBreakpointFormat(styleJson) {
    if (!styleJson || typeof styleJson !== 'object') return false;
    return ['desktop', 'tablet', 'mobile'].some(bp => styleJson[bp] && typeof styleJson[bp] === 'object');
  }

  function vd17EscapeSelector(str) {
    // Safe for CSS attribute selector value — escape backslash and double-quote only
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function vd17BuildDeclarations(styles) {
    if (!styles || typeof styles !== 'object') return '';
    const decls = [];
    Object.entries(styles).forEach(([prop, val]) => {
      const safe = vdSanitizeStyleValue(prop, String(val));
      if (safe !== null && safe !== '') {
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        decls.push(`${cssProp}:${safe}`);
      }
    });
    return decls.join(';');
  }

  // Phase 18: mode='published' → html body [data-edit-key="..."] specificity (0,1,2)
  //           mode='draft'     → body.admin-mode [data-edit-key="..."] specificity (0,2,1)
  function vd17BuildElementCSS(stylesMap, mode) {
    if (!stylesMap || typeof stylesMap !== 'object') return '';
    const byBreakpoint = { desktop: [], tablet: [], mobile: [] };

    Object.entries(stylesMap).forEach(([editKey, styleJson]) => {
      if (!styleJson || typeof styleJson !== 'object') return;
      if (!vd17HasBreakpointFormat(styleJson)) return; // legacy rows handled inline
      const sel = vd17EscapeSelector(editKey);
      const selectorFn = mode === 'draft'
        ? `body.admin-mode [data-edit-key="${sel}"]`
        : `html body [data-edit-key="${sel}"]`;

      // Desktop base: merge legacy "styles" key (foundation) with VD desktop (override)
      const baseStyles = Object.assign({}, styleJson.styles || {}, styleJson.desktop || {});
      const deskDecls = vd17BuildDeclarations(baseStyles);
      if (deskDecls) byBreakpoint.desktop.push(`${selectorFn}{${deskDecls}}`);

      // Tablet override
      const tabDecls = vd17BuildDeclarations(styleJson.tablet || {});
      if (tabDecls) byBreakpoint.tablet.push(`${selectorFn}{${tabDecls}}`);

      // Mobile override
      const mobDecls = vd17BuildDeclarations(styleJson.mobile || {});
      if (mobDecls) byBreakpoint.mobile.push(`${selectorFn}{${mobDecls}}`);
    });

    let css = '';
    if (byBreakpoint.desktop.length) css += byBreakpoint.desktop.join('\n') + '\n';
    if (byBreakpoint.tablet.length)  css += `@media ${VD17_BREAKPOINTS.tablet}{\n${byBreakpoint.tablet.join('\n')}\n}\n`;
    if (byBreakpoint.mobile.length)  css += `@media ${VD17_BREAKPOINTS.mobile}{\n${byBreakpoint.mobile.join('\n')}\n}\n`;
    return css;
  }

  function vd17GetOrCreateStyleTag(id) {
    let tag = document.getElementById(id);
    if (!tag) {
      tag = document.createElement('style');
      tag.id = id;
      tag.dataset.gvPhase = '17';
      document.head.appendChild(tag);
    }
    return tag;
  }

  function vd17InjectPublishedCSS() {
    const tag = vd17GetOrCreateStyleTag('gv-cms-published-element-styles');
    // Phase 18: 'published' mode → html body [data-edit-key="..."] selector (specificity 0,1,2)
    tag.textContent = vd17BuildElementCSS(elementStylesPublished, 'published');
  }

  function vd17InjectDraftCSS() {
    if (!document.body.classList.contains('admin-mode')) return;
    const tag = vd17GetOrCreateStyleTag('gv-cms-draft-element-styles');
    // Phase 18: 'draft' mode → body.admin-mode [data-edit-key="..."] selector (specificity 0,2,1)
    tag.textContent = vd17BuildElementCSS(elementStyleDrafts, 'draft');
  }

  function vd17RemoveDraftCSS() {
    const tag = document.getElementById('gv-cms-draft-element-styles');
    if (tag) tag.remove();
  }

  function vd17ClearDraftCSSContent() {
    const tag = document.getElementById('gv-cms-draft-element-styles');
    if (tag) tag.textContent = '';
  }

  // ── Phase 19: Contact Form Lead Capture ──────────────────────────────────────

  function normalizeLeadPipelineStage(value) {
    const stage = String(value || '').trim().toLowerCase();
    return LEAD_PIPELINE_STAGES.includes(stage) ? stage : 'new';
  }

  function normalizeLeadPriority(value) {
    const priority = String(value || '').trim().toLowerCase();
    return LEAD_PIPELINE_PRIORITIES.includes(priority) ? priority : 'normal';
  }

  function leadStageLabel(value) {
    return LEAD_PIPELINE_STAGE_LABELS[normalizeLeadPipelineStage(value)] || 'New';
  }

  function leadPriorityLabel(value) {
    return LEAD_PIPELINE_PRIORITY_LABELS[normalizeLeadPriority(value)] || 'Normal';
  }

  function leadDateValue(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function leadFollowUpState(lead) {
    const followUp = leadDateValue(lead && lead.follow_up_at);
    if (!followUp) return 'none';
    const today = startOfLocalDay(new Date());
    const dueDay = startOfLocalDay(followUp);
    if (dueDay.getTime() < today.getTime()) return 'overdue';
    if (dueDay.getTime() === today.getTime()) return 'today';
    return 'upcoming';
  }

  function leadFollowUpLabel(lead) {
    const state = leadFollowUpState(lead);
    if (state === 'overdue') return 'Overdue';
    if (state === 'today') return 'Today';
    if (state === 'upcoming') return 'Upcoming';
    return 'No follow-up';
  }

  function formatLeadDateTime(value) {
    const date = leadDateValue(value);
    return date ? date.toLocaleString() : 'Not set';
  }

  function formatDateTimeLocal(value) {
    const date = leadDateValue(value);
    if (!date) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function datetimeLocalToIso(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function truncateLeadPipelineValue(value, max = 1000) {
    const text = String(value || '').trim();
    return text ? text.slice(0, max) : null;
  }

  function applyLeadPipelineDefaults(lead) {
    if (!lead) return lead;
    lead.pipeline_stage = normalizeLeadPipelineStage(lead.pipeline_stage);
    lead.priority = normalizeLeadPriority(lead.priority);
    return lead;
  }

  function resetLeadPipelineFilters() {
    leadsPipelineFilters = { stage: 'all', priority: 'all', assigned: '', followup: 'all' };
  }

  function applyLeadPipelineFiltersFromDom() {
    const form = $('[data-lead-pipeline-filters]', dashboard || adminRoot || document);
    if (!form) return;
    const stage = $('[data-lead-filter-stage]', form)?.value || 'all';
    const priority = $('[data-lead-filter-priority]', form)?.value || 'all';
    const assigned = $('[data-lead-filter-assigned]', form)?.value || '';
    const followup = $('[data-lead-filter-followup]', form)?.value || 'all';
    leadsPipelineFilters = {
      stage: stage === 'all' || LEAD_PIPELINE_STAGES.includes(stage) ? stage : 'all',
      priority: priority === 'all' || LEAD_PIPELINE_PRIORITIES.includes(priority) ? priority : 'all',
      assigned: String(assigned || '').trim().slice(0, 120),
      followup: ['all', 'overdue', 'today', 'upcoming', 'unassigned'].includes(followup) ? followup : 'all'
    };
  }

  function leadMatchesPipelineFilters(lead) {
    const filters = leadsPipelineFilters || {};
    if (filters.stage && filters.stage !== 'all' && normalizeLeadPipelineStage(lead.pipeline_stage) !== filters.stage) return false;
    if (filters.priority && filters.priority !== 'all' && normalizeLeadPriority(lead.priority) !== filters.priority) return false;
    if (filters.assigned) {
      const assigned = String(lead.assigned_to || '').toLowerCase();
      if (!assigned.includes(filters.assigned.toLowerCase())) return false;
    }
    if (filters.followup === 'unassigned' && String(lead.assigned_to || '').trim()) return false;
    if (['overdue', 'today', 'upcoming'].includes(filters.followup) && leadFollowUpState(lead) !== filters.followup) return false;
    return true;
  }

  function getLeadPipelineSummary(leads = leadsData) {
    const active = (leads || []).filter(lead => !lead.is_archived);
    const byStage = {};
    const byPriority = {};
    LEAD_PIPELINE_STAGES.forEach(stage => { byStage[stage] = 0; });
    LEAD_PIPELINE_PRIORITIES.forEach(priority => { byPriority[priority] = 0; });
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let unassigned = 0;
    active.forEach(lead => {
      byStage[normalizeLeadPipelineStage(lead.pipeline_stage)] += 1;
      byPriority[normalizeLeadPriority(lead.priority)] += 1;
      const follow = leadFollowUpState(lead);
      if (follow === 'overdue') overdue += 1;
      if (follow === 'today') today += 1;
      if (follow === 'upcoming') upcoming += 1;
      if (!String(lead.assigned_to || '').trim()) unassigned += 1;
    });
    return { activeCount: active.length, byStage, byPriority, overdue, today, upcoming, unassigned };
  }

  function renderLeadPipelineSummary(summary) {
    const total = Math.max(summary.activeCount, 1);
    const stageCards = LEAD_PIPELINE_STAGES.map(stage => {
      const count = summary.byStage[stage] || 0;
      const pct = Math.round((count / total) * 100);
      return `<div class="gv-lead-pipeline-summary-card">
        <span>${escapeHtml(LEAD_PIPELINE_STAGE_LABELS[stage])}</span>
        <strong>${escapeHtml(count)}</strong>
        <i style="width:${pct}%"></i>
      </div>`;
    }).join('');
    const priorityCards = LEAD_PIPELINE_PRIORITIES.map(priority => {
      const count = summary.byPriority[priority] || 0;
      const pct = Math.round((count / total) * 100);
      return `<div class="gv-lead-pipeline-summary-card gv-lead-pipeline-summary-card--priority">
        <span>${escapeHtml(LEAD_PIPELINE_PRIORITY_LABELS[priority])}</span>
        <strong>${escapeHtml(count)}</strong>
        <i style="width:${pct}%"></i>
      </div>`;
    }).join('');
    return `<section class="gv-lead-pipeline-summary" aria-label="Lead pipeline summary">
      <div class="gv-lead-pipeline-summary-head">
        <span class="gv-admin-pill">Pipeline</span>
        <strong>${escapeHtml(summary.activeCount)} active leads</strong>
      </div>
      <div class="gv-lead-pipeline-summary-grid">${stageCards}</div>
      <div class="gv-lead-pipeline-summary-grid gv-lead-pipeline-summary-grid--priority">${priorityCards}</div>
      <div class="gv-lead-followup-summary">
        <span><strong>${escapeHtml(summary.overdue)}</strong> overdue</span>
        <span><strong>${escapeHtml(summary.today)}</strong> due today</span>
        <span><strong>${escapeHtml(summary.upcoming)}</strong> upcoming</span>
        <span><strong>${escapeHtml(summary.unassigned)}</strong> unassigned</span>
      </div>
    </section>`;
  }

  function renderLeadPipelineFilters() {
    const filters = leadsPipelineFilters || {};
    const option = (value, label, selected) => `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const stageOptions = option('all', 'Any stage', filters.stage === 'all') + LEAD_PIPELINE_STAGES.map(stage => option(stage, LEAD_PIPELINE_STAGE_LABELS[stage], filters.stage === stage)).join('');
    const priorityOptions = option('all', 'Any priority', filters.priority === 'all') + LEAD_PIPELINE_PRIORITIES.map(priority => option(priority, LEAD_PIPELINE_PRIORITY_LABELS[priority], filters.priority === priority)).join('');
    const followOptions = [
      ['all', 'Any follow-up'],
      ['overdue', 'Overdue'],
      ['today', 'Due today'],
      ['upcoming', 'Upcoming'],
      ['unassigned', 'Unassigned']
    ].map(([value, label]) => option(value, label, filters.followup === value)).join('');
    return `<div class="gv-lead-pipeline-filters" data-lead-pipeline-filters>
      <label><span>Stage</span><select data-lead-filter-stage>${stageOptions}</select></label>
      <label><span>Priority</span><select data-lead-filter-priority>${priorityOptions}</select></label>
      <label><span>Owner</span><input type="search" data-lead-filter-assigned value="${escapeHtml(filters.assigned || '')}" placeholder="Assigned to"></label>
      <label><span>Follow-up</span><select data-lead-filter-followup>${followOptions}</select></label>
      <button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--mint" data-admin-action="lead-pipeline-filter-apply">Apply</button>
      <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-pipeline-filter-reset">Reset</button>
    </div>`;
  }

  function renderLeadPipelineBadges(lead) {
    const stage = normalizeLeadPipelineStage(lead.pipeline_stage);
    const priority = normalizeLeadPriority(lead.priority);
    const follow = leadFollowUpState(lead);
    return `<span class="gv-lead-pipeline-badges">
      <span class="gv-lead-stage-badge gv-lead-stage-badge--${escapeHtml(stage)}">${escapeHtml(LEAD_PIPELINE_STAGE_LABELS[stage])}</span>
      <span class="gv-lead-priority-badge gv-lead-priority-badge--${escapeHtml(priority)}">${escapeHtml(LEAD_PIPELINE_PRIORITY_LABELS[priority])}</span>
      <span class="gv-lead-followup-badge gv-lead-followup-badge--${escapeHtml(follow)}">${escapeHtml(leadFollowUpLabel(lead))}</span>
    </span>`;
  }

  function renderLeadPipelineForm(lead, canEdit) {
    const stage = normalizeLeadPipelineStage(lead.pipeline_stage);
    const priority = normalizeLeadPriority(lead.priority);
    const option = (value, label, selected) => `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const dis = canEdit ? '' : ' disabled';
    const readonlyClass = canEdit ? '' : ' gv-lead-pipeline--readonly';
    const saveState = leadPipelineSaveState.id === lead.id ? leadPipelineSaveState : { status: 'idle', message: '' };
    const saveMessage = saveState.message ? `<span class="gv-lead-pipeline-save-state gv-lead-pipeline-save-state--${escapeHtml(saveState.status)}">${escapeHtml(saveState.message)}</span>` : '';
    return `<section class="gv-lead-pipeline${readonlyClass}" data-lead-pipeline-form data-lead-id="${escapeHtml(lead.id)}">
      <div class="gv-lead-pipeline-head">
        <div>
          <span class="gv-admin-pill">Pipeline</span>
          <strong>${escapeHtml(leadStageLabel(stage))} / ${escapeHtml(leadPriorityLabel(priority))}</strong>
        </div>
        ${canEdit ? `<button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--mint"${saveState.status === 'saving' ? ' disabled' : ''} data-admin-action="lead-pipeline-save" data-lead-id="${escapeHtml(lead.id)}">${saveState.status === 'saving' ? 'Saving...' : 'Save Pipeline'}</button>` : '<span class="gv-lead-pipeline-readonly">Viewer mode</span>'}
      </div>
      <div class="gv-lead-pipeline-grid">
        <label><span>Stage</span><select data-pipeline-field="pipeline_stage"${dis}>${LEAD_PIPELINE_STAGES.map(item => option(item, LEAD_PIPELINE_STAGE_LABELS[item], stage === item)).join('')}</select></label>
        <label><span>Priority</span><select data-pipeline-field="priority"${dis}>${LEAD_PIPELINE_PRIORITIES.map(item => option(item, LEAD_PIPELINE_PRIORITY_LABELS[item], priority === item)).join('')}</select></label>
        <label><span>Assigned owner</span><input type="text" data-pipeline-field="assigned_to" value="${escapeHtml(lead.assigned_to || '')}" maxlength="160"${dis}></label>
        <label><span>Outcome</span><input type="text" data-pipeline-field="outcome" value="${escapeHtml(lead.outcome || '')}" maxlength="240"${dis}></label>
        <label><span>Follow-up date</span><input type="datetime-local" data-pipeline-field="follow_up_at" value="${escapeHtml(formatDateTimeLocal(lead.follow_up_at))}"${dis}></label>
        <label><span>Last contacted</span><input type="datetime-local" data-pipeline-field="last_contacted_at" value="${escapeHtml(formatDateTimeLocal(lead.last_contacted_at))}"${dis}></label>
      </div>
      <label class="gv-lead-pipeline-wide"><span>Next action</span><textarea data-pipeline-field="next_action" maxlength="1000"${dis}>${escapeHtml(lead.next_action || '')}</textarea></label>
      <label class="gv-lead-pipeline-wide"><span>Internal notes</span><textarea data-pipeline-field="internal_notes" maxlength="4000"${dis}>${escapeHtml(lead.internal_notes || '')}</textarea></label>
      <div class="gv-lead-pipeline-meta">
        <span>Follow-up: ${escapeHtml(leadFollowUpLabel(lead))}</span>
        <span>Last contacted: ${escapeHtml(formatLeadDateTime(lead.last_contacted_at))}</span>
        ${lead.pipeline_updated_at ? `<span>Pipeline updated: ${escapeHtml(formatLeadDateTime(lead.pipeline_updated_at))}</span>` : ''}
        ${saveMessage}
      </div>
    </section>`;
  }

  function readLeadPipelinePayload(form) {
    if (!form) return null;
    const field = name => $(`[data-pipeline-field="${name}"]`, form);
    return {
      pipeline_stage: normalizeLeadPipelineStage(field('pipeline_stage')?.value),
      priority: normalizeLeadPriority(field('priority')?.value),
      assigned_to: truncateLeadPipelineValue(field('assigned_to')?.value, 160),
      follow_up_at: datetimeLocalToIso(field('follow_up_at')?.value),
      last_contacted_at: datetimeLocalToIso(field('last_contacted_at')?.value),
      outcome: truncateLeadPipelineValue(field('outcome')?.value, 240),
      next_action: truncateLeadPipelineValue(field('next_action')?.value, 1000),
      internal_notes: truncateLeadPipelineValue(field('internal_notes')?.value, 4000),
      pipeline_updated_at: new Date().toISOString()
    };
  }

  function activityValue(value) {
    if (value == null || value === '') return '';
    if (value instanceof Date) return value.toISOString();
    return String(value).slice(0, 1000);
  }

  function sameActivityValue(a, b) {
    return activityValue(a) === activityValue(b);
  }

  function leadActivityTypeLabel(type) {
    const labels = {
      pipeline_updated: 'Pipeline updated',
      stage_changed: 'Stage changed',
      priority_changed: 'Priority changed',
      assigned_to_changed: 'Owner changed',
      follow_up_changed: 'Follow-up changed',
      last_contacted_changed: 'Last contacted changed',
      outcome_changed: 'Outcome changed',
      next_action_changed: 'Next action changed',
      internal_note_added: 'Internal note updated',
      archived: 'Archived',
      unarchived: 'Unarchived',
      marked_read: 'Marked read',
      marked_new: 'Marked new',
      task_created: 'Task created',
      task_completed: 'Task completed',
      task_cancelled: 'Task cancelled',
      task_reopened: 'Task reopened',
      task_updated: 'Task updated',
      task_reminder_sent: 'Task reminder sent',
      task_reminder_failed: 'Task reminder failed',
      automation_task_created: 'Automation task created',
      automation_task_skipped_duplicate: 'Automation skipped duplicate',
      suggested_task_created: 'Suggested task created'
    };
    return labels[type] || 'Activity';
  }

  function buildLeadPipelineActivityRows(leadId, previous, payload) {
    if (!leadId || !previous || !payload) return [];
    const fields = [
      ['pipeline_stage', 'stage_changed'],
      ['priority', 'priority_changed'],
      ['assigned_to', 'assigned_to_changed'],
      ['follow_up_at', 'follow_up_changed'],
      ['last_contacted_at', 'last_contacted_changed'],
      ['outcome', 'outcome_changed'],
      ['next_action', 'next_action_changed'],
      ['internal_notes', 'internal_note_added']
    ];
    return fields
      .filter(([field]) => !sameActivityValue(previous[field], payload[field]))
      .map(([field, type]) => ({
        lead_id: leadId,
        actor_id: currentUser?.id || null,
        actor_email: currentUser?.email || adminProfile?.email || null,
        activity_type: type,
        field_name: field,
        old_value: activityValue(previous[field]),
        new_value: activityValue(payload[field]),
        note: field === 'internal_notes' ? activityValue(payload[field]).slice(0, 1000) : null,
        metadata: { source: 'admin_dashboard', phase: 26 }
      }));
  }

  async function insertLeadActivities(rows) {
    if (!rows || !rows.length || !supabaseClient || !currentUser || !canAdminEdit()) return { ok: true, skipped: true };
    if (leadActivitiesUnavailable) return { ok: false, skipped: true };
    try {
      const { data, error } = await supabaseClient
        .from('cms_lead_activity')
        .insert(rows)
        .select('id,lead_id,actor_id,actor_email,activity_type,field_name,old_value,new_value,note,metadata,created_at');
      if (error) throw error;
      if (Array.isArray(data)) {
        leadActivities = data.concat(leadActivities).slice(0, 500);
      }
      return { ok: true };
    } catch (error) {
      leadActivitiesUnavailable = true;
      return { ok: false, error };
    }
  }

  async function logLeadSimpleActivity(leadId, activityType, extra = {}) {
    if (!leadId || !canAdminEdit()) return;
    const row = {
      lead_id: leadId,
      actor_id: currentUser?.id || null,
      actor_email: currentUser?.email || adminProfile?.email || null,
      activity_type: activityType,
      field_name: extra.field_name || null,
      old_value: activityValue(extra.old_value),
      new_value: activityValue(extra.new_value),
      note: extra.note ? activityValue(extra.note) : null,
      metadata: { source: 'admin_dashboard', phase: 26 }
    };
    await insertLeadActivities([row]);
  }

  async function loadLeadActivities() {
    if (!supabaseClient || !currentUser || !adminProfile || leadActivitiesUnavailable) return;
    leadActivitiesLoading = true;
    try {
      const { data, error } = await supabaseClient
        .from('cms_lead_activity')
        .select('id,lead_id,actor_id,actor_email,activity_type,field_name,old_value,new_value,note,metadata,created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      leadActivities = Array.isArray(data) ? data : [];
    } catch (error) {
      leadActivities = [];
      leadActivitiesUnavailable = true;
    }
    leadActivitiesLoading = false;
  }

  function leadActivitiesFor(leadId, limit = 8) {
    return (leadActivities || [])
      .filter(activity => activity.lead_id === leadId)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, limit);
  }

  function renderLeadActivityTimeline(lead) {
    const rows = leadActivitiesFor(lead.id, 8);
    const unavailable = leadActivitiesUnavailable
      ? '<div class="gv-lead-activity-note">Activity table is not available yet. Run the Phase 26 SQL patch.</div>'
      : '';
    if (!rows.length) {
      return `<section class="gv-lead-activity">
        <div class="gv-lead-activity-title">Activity Timeline</div>
        ${unavailable || '<div class="gv-lead-activity-empty">No activity yet.</div>'}
      </section>`;
    }
    return `<section class="gv-lead-activity">
      <div class="gv-lead-activity-title">Activity Timeline</div>
      ${unavailable}
      ${rows.map(activity => {
        const time = activity.created_at ? new Date(activity.created_at).toLocaleString() : '';
        const oldValue = activity.old_value ? `<span class="gv-activity-chip">${escapeHtml(activity.old_value)}</span>` : '';
        const newValue = activity.new_value ? `<span class="gv-activity-chip gv-activity-chip--new">${escapeHtml(activity.new_value)}</span>` : '';
        const delta = oldValue || newValue ? `<div class="gv-lead-activity-delta">${oldValue}<span>-></span>${newValue}</div>` : '';
        return `<div class="gv-lead-activity-row">
          <div class="gv-lead-activity-row-head">
            <strong>${escapeHtml(leadActivityTypeLabel(activity.activity_type))}</strong>
            <time>${escapeHtml(time)}</time>
          </div>
          <div class="gv-lead-activity-meta">
            ${activity.actor_email ? `<span>${escapeHtml(activity.actor_email)}</span>` : ''}
            ${activity.field_name ? `<span>${escapeHtml(activity.field_name)}</span>` : ''}
          </div>
          ${delta}
          ${activity.note ? `<p>${escapeHtml(activity.note)}</p>` : ''}
        </div>`;
      }).join('')}
    </section>`;
  }

  function resetLeadBoardFilters() {
    leadBoardFilters = { priority: 'all', assigned: '', followup: 'all', showArchived: false };
  }

  function applyLeadBoardFiltersFromDom() {
    const form = $('[data-pipeline-board-filters]', dashboard || adminRoot || document);
    if (!form) return;
    const priority = $('[data-board-filter-priority]', form)?.value || 'all';
    const assigned = $('[data-board-filter-assigned]', form)?.value || '';
    const followup = $('[data-board-filter-followup]', form)?.value || 'all';
    const showArchived = Boolean($('[data-board-filter-archived]', form)?.checked);
    leadBoardFilters = {
      priority: priority === 'all' || LEAD_PIPELINE_PRIORITIES.includes(priority) ? priority : 'all',
      assigned: String(assigned || '').trim().slice(0, 120),
      followup: ['all', 'overdue', 'today', 'upcoming', 'unassigned'].includes(followup) ? followup : 'all',
      showArchived
    };
  }

  function leadMatchesBoardFilters(lead) {
    const filters = leadBoardFilters || {};
    if (!filters.showArchived && lead.is_archived) return false;
    if (filters.priority && filters.priority !== 'all' && normalizeLeadPriority(lead.priority) !== filters.priority) return false;
    if (filters.assigned) {
      const assigned = String(lead.assigned_to || '').toLowerCase();
      if (!assigned.includes(filters.assigned.toLowerCase())) return false;
    }
    if (filters.followup === 'unassigned' && String(lead.assigned_to || '').trim()) return false;
    if (['overdue', 'today', 'upcoming'].includes(filters.followup) && leadFollowUpState(lead) !== filters.followup) return false;
    return true;
  }

  function renderPipelineBoardFilters() {
    const filters = leadBoardFilters || {};
    const option = (value, label, selected) => `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const priorityOptions = option('all', 'Any priority', filters.priority === 'all') + LEAD_PIPELINE_PRIORITIES.map(priority => option(priority, LEAD_PIPELINE_PRIORITY_LABELS[priority], filters.priority === priority)).join('');
    const followOptions = [
      ['all', 'Any follow-up'],
      ['overdue', 'Overdue'],
      ['today', 'Due today'],
      ['upcoming', 'Upcoming'],
      ['unassigned', 'Unassigned']
    ].map(([value, label]) => option(value, label, filters.followup === value)).join('');
    return `<div class="gv-pipeline-board-filters" data-pipeline-board-filters>
      <label><span>Priority</span><select data-board-filter-priority>${priorityOptions}</select></label>
      <label><span>Owner</span><input type="search" data-board-filter-assigned value="${escapeHtml(filters.assigned || '')}" placeholder="Assigned to"></label>
      <label><span>Follow-up</span><select data-board-filter-followup>${followOptions}</select></label>
      <label class="gv-pipeline-board-toggle"><input type="checkbox" data-board-filter-archived${filters.showArchived ? ' checked' : ''}> <span>Show archived</span></label>
      <button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--mint" data-admin-action="pipeline-board-filter-apply">Apply</button>
      <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="pipeline-board-filter-reset">Reset</button>
    </div>`;
  }

  function getPipelineBoardSummary(leads) {
    const active = (leads || []).filter(lead => !lead.is_archived);
    return {
      total: active.length,
      overdue: active.filter(lead => leadFollowUpState(lead) === 'overdue').length,
      today: active.filter(lead => leadFollowUpState(lead) === 'today').length,
      urgentHigh: active.filter(lead => ['urgent', 'high'].includes(normalizeLeadPriority(lead.priority))).length,
      unassigned: active.filter(lead => !String(lead.assigned_to || '').trim()).length,
      won: active.filter(lead => normalizeLeadPipelineStage(lead.pipeline_stage) === 'won').length,
      lost: active.filter(lead => normalizeLeadPipelineStage(lead.pipeline_stage) === 'lost').length
    };
  }

  function renderPipelineBoardSummary(summary) {
    const cards = [
      ['Active', summary.total],
      ['Overdue', summary.overdue],
      ['Due today', summary.today],
      ['High/Urgent', summary.urgentHigh],
      ['Unassigned', summary.unassigned],
      ['Won', summary.won],
      ['Lost', summary.lost]
    ];
    return `<div class="gv-pipeline-board-summary">
      ${cards.map(([label, value]) => `<div class="gv-pipeline-board-summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
    </div>`;
  }

  function renderPipelineTab() {
    if (leadsLoading) return '<p class="gv-admin-empty">Loading pipeline...</p>';
    const summary = getPipelineBoardSummary(leadsData);
    const filtered = (leadsData || []).filter(leadMatchesBoardFilters);
    const columns = LEAD_PIPELINE_STAGES.map(stage => {
      const stageLeads = filtered.filter(lead => normalizeLeadPipelineStage(lead.pipeline_stage) === stage);
      const cards = stageLeads.length ? stageLeads.map(lead => {
        const createdDate = lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '';
        const openTaskCount = openLeadTasksFor(lead.id).length;
        const nextTask = nextOpenTaskForLead(lead.id);
        const hasOverdueTask = leadHasOverdueTask(lead.id);
        return `<article class="gv-pipeline-card${lead.is_archived ? ' is-archived' : ''}">
          <div class="gv-pipeline-card-head">
            <strong>${escapeHtml(lead.name || lead.email || 'Lead')}</strong>
            ${renderLeadPipelineBadges(lead)}
          </div>
          <span class="gv-pipeline-card-email">${escapeHtml(lead.email || '')}</span>
          <div class="gv-pipeline-card-meta">
            ${lead.assigned_to ? `<span>Owner: ${escapeHtml(lead.assigned_to)}</span>` : '<span>Unassigned</span>'}
            ${lead.project_type ? `<span>${escapeHtml(lead.project_type)}</span>` : ''}
            ${lead.source ? `<span>${escapeHtml(lead.source)}</span>` : ''}
            ${createdDate ? `<span>${escapeHtml(createdDate)}</span>` : ''}
          </div>
          ${openTaskCount ? `<div class="gv-pipeline-task-strip"><span class="${hasOverdueTask ? 'is-overdue' : ''}">${escapeHtml(openTaskCount)} open task${openTaskCount === 1 ? '' : 's'}</span>${nextTask ? `<span>Next: ${escapeHtml(formatLeadDateTime(nextTask.due_at))}</span>` : ''}</div>` : ''}
          ${lead.next_action ? `<p>${escapeHtml(String(lead.next_action).slice(0, 140))}${String(lead.next_action).length > 140 ? '...' : ''}</p>` : ''}
          <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="pipeline-open-lead" data-lead-id="${escapeHtml(lead.id)}">Open in Leads</button>
        </article>`;
      }).join('') : '<div class="gv-pipeline-empty">No leads in this stage.</div>';
      return `<section class="gv-pipeline-column">
        <div class="gv-pipeline-column-head">
          <strong>${escapeHtml(LEAD_PIPELINE_STAGE_LABELS[stage])}</strong>
          <span>${escapeHtml(stageLeads.length)}</span>
        </div>
        <div class="gv-pipeline-column-body">${cards}</div>
      </section>`;
    }).join('');
    return `<div class="gv-pipeline-board">
      <div class="gv-pipeline-board-head">
        <div>
          <span class="gv-admin-pill">Pipeline Board</span>
          <h3>Lead workflow by stage</h3>
          <small>${leadActivitiesUnavailable ? 'Activity table not available yet. Run the Phase 26 SQL patch for timelines.' : 'Click a card to open the lead record in the Leads tab.'}</small>
        </div>
        <button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--mint" data-admin-action="leads-refresh">Refresh</button>
      </div>
      ${renderPipelineBoardSummary(summary)}
      ${renderPipelineBoardFilters()}
      <div class="gv-pipeline-columns">${columns}</div>
    </div>`;
  }

  function normalizeLeadTaskStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    return LEAD_TASK_STATUSES.includes(status) ? status : 'open';
  }

  function leadTaskStatusLabel(value) {
    return LEAD_TASK_STATUS_LABELS[normalizeLeadTaskStatus(value)] || 'Open';
  }

  function taskDueState(task) {
    const due = leadDateValue(task && task.due_at);
    if (!due) return 'none';
    if (normalizeLeadTaskStatus(task.status) !== 'open') return 'done';
    const today = startOfLocalDay(new Date());
    const dueDay = startOfLocalDay(due);
    if (dueDay.getTime() < today.getTime()) return 'overdue';
    if (dueDay.getTime() === today.getTime()) return 'today';
    return 'upcoming';
  }

  function taskDueLabel(task) {
    const state = taskDueState(task);
    if (state === 'overdue') return 'Overdue';
    if (state === 'today') return 'Due today';
    if (state === 'upcoming') return 'Upcoming';
    if (state === 'done') return 'Done';
    return 'No due date';
  }

  function leadTaskMetadata(task) {
    return task && task.metadata && typeof task.metadata === 'object' && !Array.isArray(task.metadata)
      ? task.metadata
      : {};
  }

  function taskReminderSent(task) {
    const metadata = leadTaskMetadata(task);
    return Boolean(task?.reminder_sent_at || Number(task?.reminder_count || 0) > 0 || metadata.last_manual_reminder?.ok === true);
  }

  function taskReminderFailed(task) {
    const metadata = leadTaskMetadata(task);
    return Boolean(task?.last_reminder_error || metadata.last_manual_reminder?.ok === false);
  }

  function taskAutomationSource(task) {
    const metadata = leadTaskMetadata(task);
    return String(task?.automation_source || metadata.automation_source || '').trim();
  }

  function taskIsAutomationCreated(task) {
    return Boolean(taskAutomationSource(task));
  }

  function isMissingLeadTaskTableError(error) {
    const raw = getAuthErrorText(error);
    const code = String(error?.code || '');
    if (code === '42P01') return true;
    if (raw.includes('cms_lead_tasks') && (raw.includes('schema cache') || raw.includes('not found'))) return true;
    if (raw.includes('relation') && raw.includes('cms_lead_tasks') && raw.includes('does not exist')) return true;
    return false;
  }

  function isMissingLeadTaskReminderColumnError(error) {
    const raw = getAuthErrorText(error);
    const code = String(error?.code || '');
    if (code === '42703' && (raw.includes('reminder') || raw.includes('automation_source'))) return true;
    if (raw.includes('cms_lead_tasks') && raw.includes('schema cache') && (raw.includes('reminder') || raw.includes('automation_source'))) return true;
    if (raw.includes('column') && raw.includes('does not exist') && (raw.includes('reminder') || raw.includes('automation_source'))) return true;
    return false;
  }

  function leadTasksFor(leadId) {
    return (leadTasks || []).filter(task => task.lead_id === leadId);
  }

  function openLeadTasksFor(leadId) {
    return leadTasksFor(leadId).filter(task => normalizeLeadTaskStatus(task.status) === 'open');
  }

  function nextOpenTaskForLead(leadId) {
    return openLeadTasksFor(leadId)
      .slice()
      .sort((a, b) => {
        const ad = leadDateValue(a.due_at)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bd = leadDateValue(b.due_at)?.getTime() || Number.MAX_SAFE_INTEGER;
        return ad - bd;
      })[0] || null;
  }

  function leadHasOverdueTask(leadId) {
    return openLeadTasksFor(leadId).some(task => taskDueState(task) === 'overdue');
  }

  function readLeadTaskPayload(form) {
    if (!form) return null;
    const field = name => $(`[data-task-field="${name}"]`, form);
    const title = truncateLeadPipelineValue(field('title')?.value, 240);
    if (!title) return null;
    const priority = normalizeLeadPriority(field('priority')?.value);
    return {
      title,
      description: truncateLeadPipelineValue(field('description')?.value, 2000),
      priority,
      assigned_to: truncateLeadPipelineValue(field('assigned_to')?.value, 160),
      due_at: datetimeLocalToIso(field('due_at')?.value),
      status: 'open',
      metadata: { source: 'admin_dashboard', phase: 27 }
    };
  }

  async function loadLeadTasks() {
    if (!supabaseClient || !currentUser || !adminProfile || leadTasksUnavailable) return;
    leadTasksLoading = true;
    leadTasksError = '';
    try {
      const { data, error } = await supabaseClient
        .from('cms_lead_tasks')
        .select(leadTaskReminderFieldsUnavailable ? LEAD_TASK_BASE_SELECT : LEAD_TASK_PHASE28_SELECT)
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      leadTasks = Array.isArray(data) ? data : [];
    } catch (error) {
      if (!leadTaskReminderFieldsUnavailable && isMissingLeadTaskReminderColumnError(error)) {
        leadTaskReminderFieldsUnavailable = true;
        try {
          const fallback = await supabaseClient
            .from('cms_lead_tasks')
            .select(LEAD_TASK_BASE_SELECT)
            .order('due_at', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(500);
          if (fallback.error) throw fallback.error;
          leadTasks = Array.isArray(fallback.data) ? fallback.data : [];
          leadTasksError = 'Reminder fields are not available yet. Run the Phase 28 SQL patch.';
          leadTasksLoading = false;
          return;
        } catch (fallbackError) {
          error = fallbackError;
        }
      }
      leadTasks = [];
      if (isMissingLeadTaskTableError(error)) {
        leadTasksError = 'Tasks table is not available yet. Run the Phase 27 SQL patch.';
        leadTasksUnavailable = true;
      } else {
        leadTasksError = classifySupabaseError(error);
      }
    }
    leadTasksLoading = false;
  }

  async function logLeadTaskActivity(task, activityType, extra = {}) {
    if (!task || !task.lead_id || !canAdminEdit()) return;
    await insertLeadActivities([{
      lead_id: task.lead_id,
      actor_id: currentUser?.id || null,
      actor_email: currentUser?.email || adminProfile?.email || null,
      activity_type: activityType,
      field_name: extra.field_name || 'task',
      old_value: activityValue(extra.old_value),
      new_value: activityValue(extra.new_value || task.title),
      note: extra.note ? activityValue(extra.note) : null,
      metadata: Object.assign({ source: 'admin_dashboard', phase: 28, task_id: task.id || null }, extra.metadata || {})
    }]);
  }

  async function createLeadTask(leadId, form) {
    if (!leadId || !canAdminEdit() || !supabaseClient || !currentUser) return;
    const payload = readLeadTaskPayload(form);
    if (!payload) {
      leadTaskSaveState = { id: leadId, status: 'error', message: 'Task title is required.' };
      renderDashboard();
      return;
    }
    const insertPayload = Object.assign({}, payload, {
      lead_id: leadId,
      created_by: currentUser.id || null,
      created_by_email: currentUser.email || adminProfile?.email || null,
      updated_by: currentUser.id || null,
      updated_by_email: currentUser.email || adminProfile?.email || null
    });
    leadTaskSaveState = { id: leadId, status: 'saving', message: 'Creating task...' };
    renderDashboard();
    try {
      const { data, error } = await supabaseClient
        .from('cms_lead_tasks')
        .insert(insertPayload)
        .select(leadTaskReminderFieldsUnavailable ? LEAD_TASK_BASE_SELECT : LEAD_TASK_PHASE28_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (data) leadTasks = [data].concat(leadTasks).slice(0, 500);
      await logLeadTaskActivity(data || insertPayload, 'task_created', { new_value: payload.title, note: payload.description });
      leadTaskSaveState = { id: leadId, status: 'saved', message: 'Task created.' };
    } catch (error) {
      const missingTable = isMissingLeadTaskTableError(error);
      leadTaskSaveState = { id: leadId, status: 'error', message: missingTable ? 'Tasks table is not available yet. Run the Phase 27 SQL patch.' : classifySupabaseError(error) };
      if (missingTable) {
        leadTasksUnavailable = true;
        leadTasksError = 'Tasks table is not available yet. Run the Phase 27 SQL patch.';
      }
    }
    renderDashboard();
  }

  async function updateLeadTask(taskId, fields, activityType = 'task_updated') {
    if (!taskId || !canAdminEdit() || !supabaseClient || !currentUser) return;
    const task = leadTasks.find(item => item.id === taskId);
    if (!task) return;
    const previous = Object.assign({}, task);
    const payload = Object.assign({}, fields, {
      updated_by: currentUser.id || null,
      updated_by_email: currentUser.email || adminProfile?.email || null
    });
    Object.assign(task, payload);
    leadTaskSaveState = { id: taskId, status: 'saving', message: 'Saving task...' };
    renderDashboard();
    try {
      const { data, error } = await supabaseClient
        .from('cms_lead_tasks')
        .update(payload)
        .eq('id', taskId)
        .select(leadTaskReminderFieldsUnavailable ? LEAD_TASK_BASE_SELECT : LEAD_TASK_PHASE28_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (data) Object.assign(task, data);
      await logLeadTaskActivity(task, activityType, {
        old_value: previous.status,
        new_value: task.status,
        note: task.title
      });
      leadTaskSaveState = { id: taskId, status: 'saved', message: 'Task saved.' };
    } catch (error) {
      Object.assign(task, previous);
      leadTaskSaveState = { id: taskId, status: 'error', message: classifySupabaseError(error) };
    }
    renderDashboard();
  }

  function completeLeadTask(taskId) {
    return updateLeadTask(taskId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: currentUser?.id || null
    }, 'task_completed');
  }

  function cancelLeadTask(taskId) {
    return updateLeadTask(taskId, {
      status: 'cancelled',
      completed_at: null,
      completed_by: null
    }, 'task_cancelled');
  }

  function reopenLeadTask(taskId) {
    return updateLeadTask(taskId, {
      status: 'open',
      completed_at: null,
      completed_by: null
    }, 'task_reopened');
  }

  async function sendLeadTaskReminder(taskId) {
    if (!taskId || !canAdminEdit() || !supabaseClient || !currentUser) return;
    if (leadTaskReminderFieldsUnavailable) {
      leadTaskReminderState = { id: taskId, status: 'error', message: 'Run the Phase 28 SQL patch before sending reminders.' };
      renderDashboard();
      return;
    }
    leadTaskReminderState = { id: taskId, status: 'saving', message: 'Sending reminder...' };
    renderDashboard();
    try {
      if (!supabaseClient.functions || typeof supabaseClient.functions.invoke !== 'function') {
        throw new Error('Supabase Functions are not available in this client.');
      }
      const { data, error } = await supabaseClient.functions.invoke('task-reminder-notify', {
        body: { task_id: taskId }
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error || 'Reminder email failed.');
      leadTaskReminderState = { id: taskId, status: 'saved', message: 'Reminder sent.' };
      await Promise.all([loadLeadTasks(), loadLeadActivities(), loadNotificationLogs()]);
    } catch (error) {
      leadTaskReminderState = { id: taskId, status: 'error', message: classifySupabaseError(error) };
    }
    renderDashboard();
  }

  function automationDueDateIso(days) {
    const due = new Date();
    due.setDate(due.getDate() + Number(days || 0));
    if (Number(days || 0) === 0) due.setHours(due.getHours() + 2, 0, 0, 0);
    else due.setHours(10, 0, 0, 0);
    return due.toISOString();
  }

  function sameAutomationTitle(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  async function logAutomationTaskActivity(leadId, activityType, rule, note = '') {
    await logLeadTaskActivity({
      id: null,
      lead_id: leadId,
      title: rule.title
    }, activityType, {
      field_name: 'automation',
      new_value: rule.title,
      note,
      metadata: { automation_source: rule.source }
    });
  }

  async function maybeCreateStageAutomationTask(leadId, previous, payload, leadRow) {
    if (!leadId || !previous || !payload || leadTaskReminderFieldsUnavailable || leadTasksUnavailable) return { status: 'none' };
    const oldStage = normalizeLeadPipelineStage(previous.pipeline_stage);
    const newStage = normalizeLeadPipelineStage(payload.pipeline_stage);
    if (oldStage === newStage) return { status: 'none' };
    const rule = TASK_AUTOMATION_STAGE_RULES[newStage];
    if (!rule) return { status: 'none' };
    const duplicate = openLeadTasksFor(leadId).some(task =>
      sameAutomationTitle(task.title, rule.title) && taskAutomationSource(task) === rule.source
    );
    if (duplicate) {
      await logAutomationTaskActivity(leadId, 'automation_task_skipped_duplicate', rule, 'Similar open automation task already exists.');
      return { status: 'duplicate' };
    }
    try {
      const existing = await supabaseClient
        .from('cms_lead_tasks')
        .select('id')
        .eq('lead_id', leadId)
        .eq('status', 'open')
        .eq('title', rule.title)
        .eq('automation_source', rule.source)
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data?.id) {
        await logAutomationTaskActivity(leadId, 'automation_task_skipped_duplicate', rule, 'Similar open automation task already exists.');
        return { status: 'duplicate' };
      }
    } catch (error) {
      if (isMissingLeadTaskReminderColumnError(error)) {
        leadTaskReminderFieldsUnavailable = true;
        leadTasksError = 'Reminder fields are not available yet. Run the Phase 28 SQL patch.';
        return { status: 'error' };
      }
    }
    const insertPayload = {
      lead_id: leadId,
      title: rule.title,
      description: `Auto-created when lead stage changed to ${leadStageLabel(newStage)}.`,
      status: 'open',
      priority: 'normal',
      assigned_to: truncateLeadPipelineValue(payload.assigned_to || leadRow?.assigned_to, 160),
      due_at: automationDueDateIso(rule.dueDays),
      reminder_enabled: true,
      automation_source: rule.source,
      metadata: {
        source: 'admin_dashboard',
        phase: 28,
        automation_rule: 'pipeline_stage_change',
        automation_source: rule.source,
        stage: newStage
      },
      created_by: currentUser?.id || null,
      created_by_email: currentUser?.email || adminProfile?.email || null,
      updated_by: currentUser?.id || null,
      updated_by_email: currentUser?.email || adminProfile?.email || null
    };
    try {
      const { data, error } = await supabaseClient
        .from('cms_lead_tasks')
        .insert(insertPayload)
        .select(LEAD_TASK_PHASE28_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (data) leadTasks = [data].concat(leadTasks).slice(0, 500);
      await logAutomationTaskActivity(leadId, 'automation_task_created', rule, insertPayload.description);
      return { status: 'created' };
    } catch (error) {
      if (isMissingLeadTaskReminderColumnError(error)) {
        leadTaskReminderFieldsUnavailable = true;
        leadTasksError = 'Reminder fields are not available yet. Run the Phase 28 SQL patch.';
      }
      return { status: 'error' };
    }
  }

  function renderTaskBadges(task) {
    const status = normalizeLeadTaskStatus(task.status);
    const priority = normalizeLeadPriority(task.priority);
    const due = taskDueState(task);
    const reminder = taskReminderFailed(task)
      ? '<span class="gv-task-reminder-badge gv-task-reminder-badge--failed">Reminder failed</span>'
      : taskReminderSent(task)
        ? '<span class="gv-task-reminder-badge gv-task-reminder-badge--sent">Reminder sent</span>'
        : '';
    const automation = taskIsAutomationCreated(task)
      ? '<span class="gv-task-reminder-badge gv-task-reminder-badge--auto">Automation</span>'
      : '';
    return `<span class="gv-task-badges">
      <span class="gv-task-status gv-task-status--${escapeHtml(status)}">${escapeHtml(LEAD_TASK_STATUS_LABELS[status])}</span>
      <span class="gv-lead-priority-badge gv-lead-priority-badge--${escapeHtml(priority)}">${escapeHtml(LEAD_PIPELINE_PRIORITY_LABELS[priority])}</span>
      <span class="gv-lead-followup-badge gv-lead-followup-badge--${escapeHtml(due)}">${escapeHtml(taskDueLabel(task))}</span>
      ${reminder}
      ${automation}
    </span>`;
  }

  function renderTaskRow(task, options = {}) {
    const canEdit = canAdminEdit();
    const lead = leadsData.find(item => item.id === task.lead_id);
    const due = task.due_at ? formatLeadDateTime(task.due_at) : 'No due date';
    const status = normalizeLeadTaskStatus(task.status);
    const reminderState = leadTaskReminderState.id === task.id ? leadTaskReminderState : { status: 'idle', message: '' };
    const reminderMessage = reminderState.message ? `<span class="gv-task-save-state gv-task-save-state--${escapeHtml(reminderState.status)}">${escapeHtml(reminderState.message)}</span>` : '';
    const reminderSending = reminderState.status === 'saving';
    return `<article class="gv-task-row gv-task-row--${escapeHtml(taskDueState(task))}">
      <div class="gv-task-row-main">
        <div class="gv-task-row-head">
          <strong>${escapeHtml(task.title || 'Untitled task')}</strong>
          ${renderTaskBadges(task)}
        </div>
        ${options.showLead && lead ? `<div class="gv-task-lead-ref">${escapeHtml(lead.name || lead.email || 'Lead')}${lead.company ? ` / ${escapeHtml(lead.company)}` : ''}</div>` : ''}
        <div class="gv-task-meta">
          <span>Due: ${escapeHtml(due)}</span>
          ${task.assigned_to ? `<span>Owner: ${escapeHtml(task.assigned_to)}</span>` : '<span>Unassigned</span>'}
          ${task.reminder_sent_at ? `<span>Reminder: ${escapeHtml(formatLeadDateTime(task.reminder_sent_at))}</span>` : ''}
          ${Number(task.reminder_count || 0) ? `<span>${escapeHtml(task.reminder_count)} reminder${Number(task.reminder_count || 0) === 1 ? '' : 's'}</span>` : ''}
          ${task.completed_at ? `<span>Completed: ${escapeHtml(formatLeadDateTime(task.completed_at))}</span>` : ''}
        </div>
        ${task.last_reminder_error ? `<div class="gv-task-reminder-error">${escapeHtml(String(task.last_reminder_error).slice(0, 180))}</div>` : ''}
        ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}
      </div>
      <div class="gv-task-actions">
        ${canEdit && status === 'open' && !leadTaskReminderFieldsUnavailable ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-task-reminder" data-task-id="${escapeHtml(task.id)}"${reminderSending ? ' disabled' : ''}>${reminderSending ? 'Sending...' : 'Send Reminder'}</button>` : ''}
        ${canEdit && status === 'open' ? `<button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--mint" data-admin-action="lead-task-complete" data-task-id="${escapeHtml(task.id)}">Complete</button>` : ''}
        ${canEdit && status === 'open' ? `<button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--warn" data-admin-action="lead-task-cancel" data-task-id="${escapeHtml(task.id)}">Cancel</button>` : ''}
        ${canEdit && status !== 'open' ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-task-reopen" data-task-id="${escapeHtml(task.id)}">Reopen</button>` : ''}
        ${options.showLead && task.lead_id ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="task-open-lead" data-lead-id="${escapeHtml(task.lead_id)}">Open Lead</button>` : ''}
        ${reminderMessage}
      </div>
    </article>`;
  }

  function renderLeadTaskSection(lead, canEdit) {
    const tasks = leadTasksFor(lead.id);
    const open = tasks.filter(task => normalizeLeadTaskStatus(task.status) === 'open');
    const done = tasks.filter(task => normalizeLeadTaskStatus(task.status) !== 'open');
    const saveState = leadTaskSaveState.id === lead.id ? leadTaskSaveState : { status: 'idle', message: '' };
    const dis = canEdit ? '' : ' disabled';
    const taskMessage = saveState.message ? `<span class="gv-task-save-state gv-task-save-state--${escapeHtml(saveState.status)}">${escapeHtml(saveState.message)}</span>` : '';
    const unavailable = leadTasksUnavailable ? '<div class="gv-task-empty">Tasks table is not available yet. Run the Phase 27 SQL patch.</div>' : '';
    const reminderUnavailable = !leadTasksUnavailable && leadTaskReminderFieldsUnavailable ? '<div class="gv-task-empty">Reminder fields are not available yet. Run the Phase 28 SQL patch.</div>' : '';
    return `<section class="gv-lead-tasks${canEdit ? '' : ' gv-lead-tasks--readonly'}">
      <div class="gv-lead-tasks-head">
        <div>
          <span class="gv-admin-pill">Tasks & Reminders</span>
          <strong>${escapeHtml(open.length)} open / ${escapeHtml(done.length)} done</strong>
        </div>
        ${canEdit ? '' : '<span class="gv-lead-pipeline-readonly">Viewer mode</span>'}
      </div>
      ${unavailable}
      ${reminderUnavailable}
      ${open.length ? `<div class="gv-task-list">${open.map(task => renderTaskRow(task)).join('')}</div>` : '<div class="gv-task-empty">No open tasks.</div>'}
      ${done.length ? `<details class="gv-task-completed"><summary>Completed / cancelled (${escapeHtml(done.length)})</summary><div class="gv-task-list">${done.slice(0, 8).map(task => renderTaskRow(task)).join('')}</div></details>` : ''}
      <div class="gv-task-form" data-lead-task-form data-lead-id="${escapeHtml(lead.id)}">
        <label><span>Title</span><input type="text" data-task-field="title" maxlength="240"${dis}></label>
        <label><span>Priority</span><select data-task-field="priority"${dis}>${LEAD_PIPELINE_PRIORITIES.map(priority => `<option value="${escapeHtml(priority)}"${priority === 'normal' ? ' selected' : ''}>${escapeHtml(LEAD_PIPELINE_PRIORITY_LABELS[priority])}</option>`).join('')}</select></label>
        <label><span>Owner</span><input type="text" data-task-field="assigned_to" maxlength="160" value="${escapeHtml(lead.assigned_to || '')}"${dis}></label>
        <label><span>Due</span><input type="datetime-local" data-task-field="due_at"${dis}></label>
        <label class="gv-task-form-wide"><span>Description</span><textarea data-task-field="description" maxlength="2000"${dis}></textarea></label>
        <div class="gv-task-form-actions">
          ${canEdit ? `<button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--mint" data-admin-action="lead-task-create" data-lead-id="${escapeHtml(lead.id)}">Create Task</button>` : ''}
          ${taskMessage}
        </div>
      </div>
    </section>`;
  }

  function resetLeadTaskFilters() {
    leadTaskFilters = { status: 'open', priority: 'all', assigned: '', due: 'all', automation: 'all' };
  }

  function applyLeadTaskFiltersFromDom() {
    const form = $('[data-task-filters]', dashboard || adminRoot || document);
    if (!form) return;
    const status = $('[data-task-filter-status]', form)?.value || 'open';
    const priority = $('[data-task-filter-priority]', form)?.value || 'all';
    const assigned = $('[data-task-filter-assigned]', form)?.value || '';
    const due = $('[data-task-filter-due]', form)?.value || 'all';
    const automation = $('[data-task-filter-automation]', form)?.value || 'all';
    leadTaskFilters = {
      status: status === 'all' || LEAD_TASK_STATUSES.includes(status) ? status : 'open',
      priority: priority === 'all' || LEAD_PIPELINE_PRIORITIES.includes(priority) ? priority : 'all',
      assigned: String(assigned || '').trim().slice(0, 120),
      due: ['all', 'overdue', 'today', 'upcoming', 'none'].includes(due) ? due : 'all',
      automation: ['all', 'automation', 'manual', 'reminder-sent', 'reminder-failed'].includes(automation) ? automation : 'all'
    };
  }

  function taskMatchesFilters(task) {
    const filters = leadTaskFilters || {};
    if (filters.status && filters.status !== 'all' && normalizeLeadTaskStatus(task.status) !== filters.status) return false;
    if (filters.priority && filters.priority !== 'all' && normalizeLeadPriority(task.priority) !== filters.priority) return false;
    if (filters.assigned) {
      const assigned = String(task.assigned_to || '').toLowerCase();
      if (!assigned.includes(filters.assigned.toLowerCase())) return false;
    }
    if (filters.due === 'none' && task.due_at) return false;
    if (['overdue', 'today', 'upcoming'].includes(filters.due) && taskDueState(task) !== filters.due) return false;
    if (filters.automation === 'automation' && !taskIsAutomationCreated(task)) return false;
    if (filters.automation === 'manual' && taskIsAutomationCreated(task)) return false;
    if (filters.automation === 'reminder-sent' && !taskReminderSent(task)) return false;
    if (filters.automation === 'reminder-failed' && !taskReminderFailed(task)) return false;
    return true;
  }

  function getTaskSummary(tasks = leadTasks) {
    const open = tasks.filter(task => normalizeLeadTaskStatus(task.status) === 'open');
    return {
      open: open.length,
      overdue: open.filter(task => taskDueState(task) === 'overdue').length,
      today: open.filter(task => taskDueState(task) === 'today').length,
      upcoming: open.filter(task => taskDueState(task) === 'upcoming').length,
      completed: tasks.filter(task => normalizeLeadTaskStatus(task.status) === 'completed').length,
      urgentHigh: open.filter(task => ['urgent', 'high'].includes(normalizeLeadPriority(task.priority))).length,
      remindersSent: tasks.filter(taskReminderSent).length,
      reminderFailures: tasks.filter(taskReminderFailed).length,
      automated: tasks.filter(taskIsAutomationCreated).length,
      noDueDate: open.filter(task => taskDueState(task) === 'none').length
    };
  }

  function renderTaskSummaryCards(summary) {
    const cards = [
      ['Open tasks', summary.open],
      ['Overdue', summary.overdue],
      ['Due today', summary.today],
      ['Upcoming', summary.upcoming],
      ['Completed', summary.completed],
      ['High/Urgent', summary.urgentHigh],
      ['Reminders sent', summary.remindersSent],
      ['Reminder failures', summary.reminderFailures],
      ['Automation-created', summary.automated],
      ['No due date', summary.noDueDate]
    ];
    return `<div class="gv-task-summary">${cards.map(([label, value]) => `<div class="gv-task-summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>`;
  }

  function renderTaskFilters() {
    const filters = leadTaskFilters || {};
    const option = (value, label, selected) => `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const statusOptions = option('all', 'Any status', filters.status === 'all') + LEAD_TASK_STATUSES.map(status => option(status, LEAD_TASK_STATUS_LABELS[status], filters.status === status)).join('');
    const priorityOptions = option('all', 'Any priority', filters.priority === 'all') + LEAD_PIPELINE_PRIORITIES.map(priority => option(priority, LEAD_PIPELINE_PRIORITY_LABELS[priority], filters.priority === priority)).join('');
    const dueOptions = [
      ['all', 'Any due date'],
      ['overdue', 'Overdue'],
      ['today', 'Due today'],
      ['upcoming', 'Upcoming'],
      ['none', 'No due date']
    ].map(([value, label]) => option(value, label, filters.due === value)).join('');
    const automationOptions = [
      ['all', 'Any reminder state'],
      ['automation', 'Automation-created'],
      ['manual', 'Manual tasks'],
      ['reminder-sent', 'Reminder sent'],
      ['reminder-failed', 'Reminder failed']
    ].map(([value, label]) => option(value, label, filters.automation === value)).join('');
    return `<div class="gv-task-filters" data-task-filters>
      <label><span>Status</span><select data-task-filter-status>${statusOptions}</select></label>
      <label><span>Priority</span><select data-task-filter-priority>${priorityOptions}</select></label>
      <label><span>Owner</span><input type="search" data-task-filter-assigned value="${escapeHtml(filters.assigned || '')}" placeholder="Assigned to"></label>
      <label><span>Due</span><select data-task-filter-due>${dueOptions}</select></label>
      <label><span>Automation</span><select data-task-filter-automation>${automationOptions}</select></label>
      <button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--mint" data-admin-action="tasks-filter-apply">Apply</button>
      <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="tasks-filter-reset">Reset</button>
    </div>`;
  }

  function renderTasksTab() {
    if (leadTasksLoading) return '<p class="gv-admin-empty">Loading tasks...</p>';
    const summary = getTaskSummary(leadTasks);
    const visible = (leadTasks || []).filter(taskMatchesFilters);
    const rows = visible.length
      ? visible.map(task => renderTaskRow(task, { showLead: true })).join('')
      : '<p class="gv-admin-empty">No tasks match the current filters.</p>';
    const warning = leadTasksUnavailable || leadTasksError
      ? `<div class="gv-admin-dashboard-message">${escapeHtml(leadTasksError || 'Tasks table is not available yet. Run the Phase 27 SQL patch.')}</div>`
      : '';
    return `<div class="gv-tasks-tab">
      <div class="gv-tasks-head">
        <div>
          <span class="gv-admin-pill">Tasks</span>
          <h3>CRM reminders</h3>
          <small>Lead follow-up tasks, due dates, and owner assignments.</small>
        </div>
        <button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--mint" data-admin-action="leads-refresh">Refresh</button>
      </div>
      ${warning}
      ${renderTaskSummaryCards(summary)}
      ${renderTaskFilters()}
      <div class="gv-task-list gv-task-list--global">${rows}</div>
    </div>`;
  }

  async function updateLeadPipeline(id, form) {
    if (!id || !canAdminEdit()) return;
    if (!supabaseClient || !currentUser) return;
    const payload = readLeadPipelinePayload(form);
    if (!payload) return;
    const row = leadsData.find(lead => lead.id === id);
    const previous = row ? Object.assign({}, row) : null;
    if (row) Object.assign(row, payload);
    leadPipelineSaveState = { id, status: 'saving', message: 'Saving pipeline...' };
    renderDashboard();
    try {
      const { data, error } = await supabaseClient
        .from('cms_contact_submissions')
        .update(payload)
        .eq('id', id)
        .select('pipeline_stage,priority,assigned_to,follow_up_at,last_contacted_at,outcome,next_action,internal_notes,pipeline_updated_at')
        .maybeSingle();
      if (error) throw error;
      if (row && data) Object.assign(row, data);
      if (row) applyLeadPipelineDefaults(row);
      const activityRows = buildLeadPipelineActivityRows(id, previous, payload);
      const activityResult = await insertLeadActivities(activityRows);
      const automationResult = await maybeCreateStageAutomationTask(id, previous, payload, row);
      const automationMessage = automationResult.status === 'created'
        ? ' Automation task created.'
        : automationResult.status === 'duplicate'
          ? ' Automation skipped duplicate task.'
          : automationResult.status === 'error'
            ? ' Automation task unavailable.'
            : '';
      leadPipelineSaveState = {
        id,
        status: 'saved',
        message: `${activityResult.ok || !activityRows.length ? 'Pipeline saved.' : 'Pipeline saved. Activity log unavailable.'}${automationMessage}`
      };
    } catch (error) {
      if (row && previous) Object.assign(row, previous);
      leadPipelineSaveState = { id, status: 'error', message: 'Pipeline could not be saved.' };
    }
    renderDashboard();
  }

  async function loadLeads() {
    if (!supabaseClient || !currentUser || !adminProfile) return;
    leadsLoading = true;
    try {
      const baseColumns = 'id,name,email,company,project_type,budget,message,page_path,source,status,is_archived,user_agent,created_at';
      const phase24Columns = `${baseColumns},landing_page,referrer,utm_source,utm_medium,utm_campaign,utm_term,utm_content,attribution_json`;
      const phase25Columns = `${phase24Columns},pipeline_stage,priority,assigned_to,follow_up_at,last_contacted_at,outcome,next_action,internal_notes,pipeline_updated_at`;
      let { data, error } = await supabaseClient
        .from('cms_contact_submissions')
        .select(phase25Columns)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        const fallback = await supabaseClient
          .from('cms_contact_submissions')
          .select(phase24Columns)
          .order('created_at', { ascending: false })
          .limit(500);
        data = fallback.data;
        error = fallback.error;
      }
      if (error) {
        const fallback = await supabaseClient
          .from('cms_contact_submissions')
          .select(baseColumns)
          .order('created_at', { ascending: false })
          .limit(500);
        data = fallback.data;
        error = fallback.error;
      }
      leadsData = (!error && Array.isArray(data)) ? data.map(applyLeadPipelineDefaults) : [];
    } catch (e) {
      leadsData = [];
    }
    leadsLoading = false;
  }

  async function loadNotificationLogs() {
    if (!supabaseClient || !currentUser || !adminProfile) return;
    notificationLogsLoading = true;
    notificationLogsError = '';
    try {
      const baseColumns = 'id,lead_id,status,event_type,recipient_email,provider_message_id,error_message,created_at';
      const phase22Columns = `${baseColumns},metadata,delivered_at,bounced_at,complained_at,opened_at,clicked_at,last_event_at`;
      let { data, error } = await supabaseClient
        .from('cms_notification_log')
        .select(phase22Columns)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        const fallback = await supabaseClient
          .from('cms_notification_log')
          .select(baseColumns)
          .order('created_at', { ascending: false })
          .limit(500);
        data = fallback.data;
        error = fallback.error;
      }
      if (error) {
        notificationLogsError = 'Notification logs could not be loaded. Check cms_notification_log RLS and Phase 21/22 SQL patches.';
      }
      notificationLogs = (!error && Array.isArray(data)) ? data : [];
    } catch (e) {
      notificationLogs = [];
      notificationLogsError = 'Notification logs could not be loaded.';
    }
    notificationLogsLoading = false;
  }

  async function updateLeadStatus(id, status) {
    if (!id || !canAdminEdit()) return;
    if (!supabaseClient || !currentUser) return;
    const row = leadsData.find(l => l.id === id);
    const previousStatus = row ? row.status : null;
    if (row) row.status = status; // optimistic update
    renderDashboard();
    try {
      const { error } = await supabaseClient
        .from('cms_contact_submissions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await logLeadSimpleActivity(id, status === 'read' ? 'marked_read' : 'marked_new', {
        field_name: 'status',
        old_value: previousStatus,
        new_value: status
      });
    } catch (e) {
      // revert on error
      if (row) row.status = status === 'read' ? 'new' : 'read';
      renderDashboard();
    }
  }

  async function updateLeadArchived(id, isArchived) {
    if (!id || !canAdminEdit()) return;
    if (!supabaseClient || !currentUser) return;
    const row = leadsData.find(l => l.id === id);
    const previousArchived = row ? row.is_archived : null;
    if (row) row.is_archived = isArchived; // optimistic update
    renderDashboard();
    try {
      const { error } = await supabaseClient
        .from('cms_contact_submissions')
        .update({ is_archived: isArchived, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await logLeadSimpleActivity(id, isArchived ? 'archived' : 'unarchived', {
        field_name: 'is_archived',
        old_value: previousArchived,
        new_value: isArchived
      });
    } catch (e) {
      if (row) row.is_archived = !isArchived;
      renderDashboard();
    }
  }

  async function sendTestNotification() {
    if (!supabaseClient || !currentUser || adminProfile?.role !== 'owner') return;
    leadsNotifyState = 'sending';
    leadsNotifyMsg = '';
    renderDashboard();
    // Use the most recent real lead as payload, or a synthetic sample
    const sampleLead = leadsData.find(l => !l.is_archived) || {
      name: 'Test Lead',
      email: 'test@example.com',
      company: 'Test Company',
      project_type: 'Web Design',
      budget: '£5k–£15k',
      message: 'This is a test notification from the GROWVA admin dashboard.',
      page_path: '/contact',
      created_at: new Date().toISOString(),
    };
    try {
      if (typeof supabaseClient.functions?.invoke !== 'function') {
        throw new Error('Supabase Functions not available in this client version.');
      }
      const { error } = await supabaseClient.functions.invoke('contact-notify', {
        body: { record: sampleLead, test: true },
      });
      if (error) throw error;
      leadsNotifyState = 'ok';
      leadsNotifyMsg = 'Test email sent. Check your inbox.';
    } catch (e) {
      leadsNotifyState = 'error';
      leadsNotifyMsg = (e && typeof e.message === 'string') ? e.message : 'Failed to send. Check Edge Function logs.';
    }
    // Phase 21: reload logs so the test entry appears immediately
    await loadNotificationLogs();
    renderDashboard();
  }

  async function retryNotification(leadId) {
    if (!supabaseClient || !currentUser || adminProfile?.role !== 'owner') return;
    if (!leadId) return;
    const lead = leadsData.find(l => l.id === leadId);
    if (!lead) return;
    if (typeof supabaseClient.functions?.invoke !== 'function') {
      leadsNotifyState = 'error';
      leadsNotifyMsg = 'Supabase Functions not available in this client version.';
      renderDashboard();
      return;
    }
    leadRetrying = leadId;
    renderDashboard();
    try {
      const { error } = await supabaseClient.functions.invoke('contact-notify', {
        body: { record: lead, retry: true },
      });
      if (error) throw error;
      leadsNotifyState = 'ok';
      leadsNotifyMsg = 'Retry sent. Check your inbox.';
    } catch (e) {
      leadsNotifyState = 'error';
      leadsNotifyMsg = (e && typeof e.message === 'string') ? e.message : 'Retry failed. Check Edge Function logs.';
    }
    leadRetrying = null;
    await loadNotificationLogs();
    renderDashboard();
  }

  function renderLeadsTab() {
    const canEdit = canAdminEdit();

    if (leadsLoading) {
      return '<p class="gv-admin-empty">Loading leads…</p>';
    }

    // Filter options
    const allCount      = leadsData.filter(l => !l.is_archived).length;
    const newCount      = leadsData.filter(l => l.status === 'new' && !l.is_archived).length;
    const readCount     = leadsData.filter(l => l.status === 'read' && !l.is_archived).length;
    const archivedCount = leadsData.filter(l => l.is_archived).length;
    const pipelineSummary = getLeadPipelineSummary(leadsData);
    const pipelineSummaryHtml = renderLeadPipelineSummary(pipelineSummary);

    // Phase 20: owner-only test notification panel
    let notifyPanel = '';
    if (adminProfile?.role === 'owner') {
      const isSending = leadsNotifyState === 'sending';
      let statusHtml = '';
      if (leadsNotifyState === 'ok') {
        statusHtml = `<span class="gv-leads-notify-status gv-leads-notify-status--ok">${escapeHtml(leadsNotifyMsg)}</span>`;
      } else if (leadsNotifyState === 'error') {
        statusHtml = `<span class="gv-leads-notify-status gv-leads-notify-status--err">${escapeHtml(leadsNotifyMsg)}</span>`;
      }
      notifyPanel = `<div class="gv-leads-notify-bar">
        <span class="gv-leads-notify-label">Email notification:</span>
        <button type="button" class="gv-admin-action gv-admin-action--sm"${isSending ? ' disabled' : ''} data-admin-action="lead-test-notify">${isSending ? 'Sending…' : 'Send Test'}</button>
        ${statusHtml}
      </div>`;
    }

    const filters = [
      ['all',      `All Active (${allCount})`],
      ['new',      `New (${newCount})`],
      ['read',     `Read (${readCount})`],
      ['archived', `Archived (${archivedCount})`],
    ];
    const filterBar = `
      <div class="gv-leads-filterbar">
        ${filters.map(([f, label]) =>
          `<button type="button" class="gv-admin-action gv-admin-action--sm${leadsFilter === f ? ' is-active' : ''}" data-admin-action="leads-filter" data-leads-filter="${f}">${escapeHtml(label)}</button>`
        ).join('')}
        <button type="button" class="gv-admin-action gv-admin-action--sm" style="margin-left:auto;" data-admin-action="leads-refresh">↻ Refresh</button>
      </div>`;

    const pipelineFilterBar = renderLeadPipelineFilters();

    // Apply filter
    let visible = leadsData;
    if (leadsFilter === 'archived') {
      visible = leadsData.filter(l => l.is_archived);
    } else if (leadsFilter === 'new') {
      visible = leadsData.filter(l => l.status === 'new' && !l.is_archived);
    } else if (leadsFilter === 'read') {
      visible = leadsData.filter(l => l.status === 'read' && !l.is_archived);
    } else {
      visible = leadsData.filter(l => !l.is_archived);
    }
    visible = visible.filter(leadMatchesPipelineFilters);

    if (!visible.length) {
      const emptyMsg = leadsData.length === 0
        ? 'No leads yet. Form submissions will appear here.'
        : 'No leads match the current filter.';
      return notifyPanel + pipelineSummaryHtml + filterBar + pipelineFilterBar + `<p class="gv-admin-empty">${escapeHtml(emptyMsg)}</p>`;
    }

    const rows = visible.map(lead => {
      const isExpanded = leadsExpanded === lead.id;
      const statusBadge = lead.status === 'new'
        ? '<span class="gv-lead-badge gv-lead-badge--new">new</span>'
        : '<span class="gv-lead-badge gv-lead-badge--read">read</span>';
      const pipelineBadges = renderLeadPipelineBadges(lead);
      const msgPreview = escapeHtml((lead.message || '').slice(0, 120));
      const createdDate = lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '';

      // Collapsed-state lead management actions (mark read/new, archive)
      const actions = canEdit ? `
        <div class="gv-lead-actions">
          ${lead.status !== 'read' ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-mark-read" data-lead-id="${escapeHtml(lead.id)}">Mark Read</button>` : ''}
          ${lead.status !== 'new'  ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-mark-new"  data-lead-id="${escapeHtml(lead.id)}">Mark New</button>` : ''}
          ${!lead.is_archived ? `<button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--warn" data-admin-action="lead-archive"   data-lead-id="${escapeHtml(lead.id)}">Archive</button>` : ''}
          ${lead.is_archived  ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-unarchive" data-lead-id="${escapeHtml(lead.id)}">Unarchive</button>` : ''}
        </div>` : '';

      // Phase 21: notification history for this lead (max 5 entries, newest first)
      const leadLogs = notificationLogs.filter(lg => lg.lead_id === lead.id).slice(0, 5);
      const isRetryingThis = leadRetrying === lead.id;

      const logsHtml = leadLogs.length ? `
        <div class="gv-notif-log">
          <div class="gv-notif-log-title">Notification history</div>
          ${leadLogs.map(lg => {
            const eventTime = notifTime(lg);
            const reason = notifReason(lg);
            return `
            <div class="gv-notif-log-row">
              ${notifBadgeHtml(lg.status)}
              <span class="gv-notif-log-time">${escapeHtml(eventTime ? new Date(eventTime).toLocaleString() : '—')}</span>
              <span class="gv-notif-log-type">${escapeHtml(lg.event_type || 'notification')}</span>
              ${lg.provider_message_id ? `<span class="gv-notif-log-id">${escapeHtml(notifProviderShort(lg.provider_message_id))}</span>` : ''}
              ${notifNeedsReason(lg.status) && reason ? `<div class="gv-notif-err">${escapeHtml(String(reason).slice(0, 140))}</div>` : ''}
            </div>`;
          }).join('')}
        </div>` : `<div class="gv-notif-log"><div class="gv-notif-log-empty">No notification history.</div></div>`;

      const retryBtn = adminProfile?.role === 'owner' ? `
        <button type="button" class="gv-admin-action gv-admin-action--sm"${isRetryingThis ? ' disabled' : ''} data-admin-action="lead-retry-notify" data-lead-id="${escapeHtml(lead.id)}">${isRetryingThis ? 'Retrying…' : 'Retry Notification'}</button>` : '';

      const detail = isExpanded ? `
        <div class="gv-lead-detail">
          <div class="gv-lead-detail-grid">
            ${lead.company     ? `<div><span class="gv-admin-diff-label">Company</span> ${escapeHtml(lead.company)}</div>` : ''}
            ${lead.project_type? `<div><span class="gv-admin-diff-label">Project</span> ${escapeHtml(lead.project_type)}</div>` : ''}
            ${lead.budget      ? `<div><span class="gv-admin-diff-label">Budget</span>  ${escapeHtml(lead.budget)}</div>` : ''}
            ${lead.page_path   ? `<div><span class="gv-admin-diff-label">Page</span>    ${escapeHtml(lead.page_path)}</div>` : ''}
            ${lead.source      ? `<div><span class="gv-admin-diff-label">Source</span>  ${escapeHtml(lead.source)}</div>` : ''}
            ${lead.created_at  ? `<div><span class="gv-admin-diff-label">Received</span> ${escapeHtml(new Date(lead.created_at).toLocaleString())}</div>` : ''}
          </div>
          ${renderLeadAttributionHtml(lead)}
          ${renderLeadPipelineForm(lead, canEdit)}
          ${renderLeadTaskSection(lead, canEdit)}
          ${renderLeadActivityTimeline(lead)}
          <div class="gv-lead-message">${escapeHtml(lead.message || '')}</div>
          ${lead.user_agent ? `<div class="gv-lead-ua">${escapeHtml((lead.user_agent || '').slice(0, 120))}</div>` : ''}
          ${logsHtml}
          <div class="gv-lead-actions">
            ${canEdit ? `
              ${lead.status !== 'read' ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-mark-read" data-lead-id="${escapeHtml(lead.id)}">Mark Read</button>` : ''}
              ${lead.status !== 'new'  ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-mark-new"  data-lead-id="${escapeHtml(lead.id)}">Mark New</button>` : ''}
              ${!lead.is_archived ? `<button type="button" class="gv-admin-action gv-admin-action--sm gv-admin-action--warn" data-admin-action="lead-archive"   data-lead-id="${escapeHtml(lead.id)}">Archive</button>` : ''}
              ${lead.is_archived  ? `<button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-unarchive" data-lead-id="${escapeHtml(lead.id)}">Unarchive</button>` : ''}
            ` : ''}
            ${retryBtn}
          </div>
        </div>` : actions;

      return `
        <article class="gv-admin-content-row gv-lead-row${lead.status === 'new' && !lead.is_archived ? ' gv-lead-row--new' : ''}">
          <div>
            <div class="gv-lead-header">
              <strong>${escapeHtml(lead.name || '—')}</strong>
              ${statusBadge}
              ${pipelineBadges}
              <span class="gv-lead-date">${escapeHtml(createdDate)}</span>
            </div>
            <span class="gv-lead-email">${escapeHtml(lead.email || '—')}</span>
            ${lead.company ? `<span class="gv-lead-company">${escapeHtml(lead.company)}</span>` : ''}
            ${lead.assigned_to ? `<span class="gv-lead-company">Owner: ${escapeHtml(lead.assigned_to)}</span>` : ''}
            ${lead.next_action ? `<span class="gv-lead-company">Next: ${escapeHtml(String(lead.next_action).slice(0, 90))}${String(lead.next_action).length > 90 ? '...' : ''}</span>` : ''}
            <div class="gv-admin-diff-value">${msgPreview}${(lead.message || '').length > 120 ? '…' : ''}</div>
            <button type="button" class="gv-admin-action gv-admin-action--sm" data-admin-action="lead-expand" data-lead-id="${escapeHtml(lead.id)}">${isExpanded ? 'Collapse' : 'Expand'}</button>
            ${detail}
          </div>
        </article>`;
    }).join('');

    return notifyPanel + pipelineSummaryHtml + filterBar + pipelineFilterBar + `<div class="gv-admin-row-list">${rows}</div>`;
  }

  // ── Phase 18: Visual Designer Production Hardening ───────────────────────────

  function vd18ShowResponsiveFrame(bp) {
    vd18RemoveResponsiveFrame();
    if (!bp) return;
    const frame = document.createElement('div');
    frame.id = 'gv-resp-preview-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.dataset.vdBp = bp;
    document.body.appendChild(frame);
    document.body.classList.add('gv-resp-preview-' + bp);
    vd18ResponsivePreview = bp;
    refreshScrollLayout();
  }

  function vd18RemoveResponsiveFrame() {
    const frame = document.getElementById('gv-resp-preview-frame');
    if (frame) frame.remove();
    document.body.classList.remove('gv-resp-preview-tablet', 'gv-resp-preview-mobile');
    if (vd18ResponsivePreview !== 'none') {
      vd18ResponsivePreview = 'none';
      refreshScrollLayout();
    }
  }

  // Returns array of { prop, pv, dv, status } for one breakpoint
  function vd18BuildStyleDiff(draftSj, pubSj, bp) {
    const draft = draftSj && typeof draftSj[bp] === 'object' ? draftSj[bp] : {};
    const pub   = pubSj   && typeof pubSj[bp]   === 'object' ? pubSj[bp]   : {};
    const allProps = new Set([...Object.keys(draft), ...Object.keys(pub)]);
    const diffs = [];
    allProps.forEach(prop => {
      const dv = draft[prop];
      const pv = pub[prop];
      if (dv === pv) return;
      const status = !pv ? 'added' : !dv ? 'removed' : 'changed';
      diffs.push({ prop, pv: pv || '—', dv: dv || '—', status });
    });
    return diffs;
  }

  async function boot() {
    // Phase 18: FOUC mitigation — mark body as loading before VD styles are injected
    document.body.classList.add('gv-cms-loading');
    // Safety: remove loading class after 1s even if Supabase is slow or errors
    const vd18LoadSafetyTimer = setTimeout(() => {
      document.body.classList.remove('gv-cms-loading');
      document.body.classList.add('gv-cms-ready');
    }, 1000);

    ensureEntryButtonsAreSafe();
    bindEntryEvents();
    ensureRoot();
    captureOriginalValues();
    initSupabase();
    setupAuthStateListener();

    // Phase 18: inject published VD styles FIRST (minimises flash of unstyled content)
    await applyPublishedElementStyles();
    clearTimeout(vd18LoadSafetyTimer);
    document.body.classList.remove('gv-cms-loading');
    document.body.classList.add('gv-cms-ready');

    await loadPublishedEdits();
    await applyPublishedImageEdits();
    await applyPublishedDesignTokens();
    await loadPublishedCustomSections();
    await applyPublishedSectionSettings();
    logCmsDebug('boot');
    let hasBootSession = false;
    try {
      hasBootSession = await withTimeout(hasActiveAdminSession(), 2500, false);
    } catch (error) {
      hasBootSession = false;
    }
    if (hasBootSession) {
      await loadPublishedEdits();
      await applyPublishedImageEdits();
      await applyPublishedDesignTokens();
      await loadPublishedCustomSections();
      await applyPublishedSectionSettings();
      await applyPublishedElementStyles();
      await enterAdminMode();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
