/* ==========================================================================
   GROWVA — js/script.js  (shared across all pages)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- First-party attribution memory (no third-party tracking) ---------- */
  (function rememberLandingPage() {
    try {
      const key = 'growva_landing_page';
      if (!sessionStorage.getItem(key)) {
        const path = String(window.location.pathname || '/').slice(0, 240);
        const query = String(window.location.search || '').slice(0, 500);
        sessionStorage.setItem(key, (path + query).slice(0, 700));
      }
    } catch (e) {
      // sessionStorage may be unavailable in strict privacy modes; attribution still falls back.
    }
  })();

  /* ---------- Preloader ---------- */
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.innerHTML = `
      <div class="preloader-core" aria-live="polite">
        <div class="preloader-mark" aria-hidden="true">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M52 22 A22 22 0 1 0 52 58 L52 44 H36"
                  stroke="white" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="30,37 41,55 60,24"
                      stroke="#B1FA20" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="preloader-wordmark">GROWVA</div>
        <div class="preloader-count" id="preloaderCount">000%</div>
      </div>`;

    const countEl = document.getElementById('preloaderCount');
    let loaded = document.readyState === 'complete';
    let finished = false;
    const start = performance.now();
    const minDuration = 1200;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (countEl) countEl.textContent = '100%';
      setTimeout(() => preloader.classList.add('done'), 260);
    };

    function tickLoader(now) {
      const elapsed = now - start;
      const p = Math.min(elapsed / minDuration, 1);
      const simulated = Math.round((1 - Math.pow(1 - p, 3)) * (loaded ? 100 : 92));
      if (countEl) countEl.textContent = String(Math.min(simulated, 100)).padStart(3, '0') + '%';
      if (loaded && elapsed >= minDuration) {
        finish();
      } else {
        requestAnimationFrame(tickLoader);
      }
    }

    window.addEventListener('load', () => { loaded = true; });
    setTimeout(() => { loaded = true; }, 1800);
    setTimeout(finish, 3200);
    requestAnimationFrame(tickLoader);
  }

  /* ---------- Scroll progress ---------- */
  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span id="scrollProgressBar"></span>';
  document.body.appendChild(progress);
  const progressBar = document.getElementById('scrollProgressBar');
  function updateScrollProgress() {
    if (!progressBar) return;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    progressBar.style.width = `${Math.min(100, Math.max(0, (window.scrollY / max) * 100))}%`;
  }
  updateScrollProgress();
  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  /* ---------- Lenis smooth scroll ---------- */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touchLike = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (!reducedMotion && !touchLike && window.Lenis && window.gsap) {
    const lenis = new Lenis({
      duration: 1.15,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
      wheelMultiplier: 0.9,
      touchMultiplier: 1
    });
    window._lenis = lenis;
    lenis.on('scroll', () => {
      updateScrollProgress();
      if (window.ScrollTrigger) ScrollTrigger.update();
    });
    let lenisSyncFrame = null;
    const syncLenisLayout = () => {
      lenisSyncFrame = null;
      lenis.resize();
      updateScrollProgress();
      if (window.ScrollTrigger) {
        ScrollTrigger.update();
        ScrollTrigger.refresh();
      }
    };
    const queueLenisSync = () => {
      if (lenisSyncFrame) cancelAnimationFrame(lenisSyncFrame);
      lenisSyncFrame = requestAnimationFrame(() => {
        lenisSyncFrame = requestAnimationFrame(syncLenisLayout);
      });
    };
    window.addEventListener('load', queueLenisSync);
    window.addEventListener('resize', queueLenisSync);
    setTimeout(queueLenisSync, 450);
    setTimeout(queueLenisSync, 1800);
    setTimeout(queueLenisSync, 3400);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Word-level headline reveals ---------- */
  (function initHeadlineWordReveals() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll('.hero-title, .page-hero-title');
    if (!targets.length) return;

    function splitTextNode(node) {
      const frag = document.createDocumentFragment();
      const parts = node.nodeValue.split(/(\s+)/);
      parts.forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const clip = document.createElement('span');
        const word = document.createElement('span');
        clip.className = 'word-clip';
        word.className = 'word';
        word.textContent = part;
        clip.appendChild(word);
        frag.appendChild(clip);
      });
      node.parentNode.replaceChild(frag, node);
    }

    function walk(el) {
      Array.from(el.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          splitTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('word-clip')) {
          walk(node);
        }
      });
    }

    targets.forEach(target => {
      target.classList.remove('reveal-up', 'reveal-line');
      target.querySelectorAll('.reveal-line').forEach(el => el.classList.remove('reveal-line'));
      target.querySelectorAll('.in').forEach(el => el.classList.remove('in'));
      target.classList.add('word-reveal');
      walk(target);
      target.querySelectorAll('.word').forEach((word, i) => word.style.setProperty('--word-index', i));
      if (reduced) {
        target.classList.add('in');
      }
    });

    if (reduced) return;
    const wordIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        wordIO.unobserve(entry.target);
      });
    }, { threshold: 0.25, rootMargin: '0px 0px -80px 0px' });
    targets.forEach(target => wordIO.observe(target));
  })();

  /* ---------- Custom cursor (magnetic upgrade) ---------- */
  const dot  = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (dot && ring && window.matchMedia('(hover: hover)').matches) {
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;
    let magnetEl = null; // currently hovered [data-hover] element
    const isAdminMode = () => document.body.classList.contains('admin-mode');
    const isAdminTarget = target => Boolean(target && target.closest && target.closest('[data-admin-ui], [data-admin-action], [data-admin-entry], .gv-admin-root, .gv-admin, .admin-shell, .growva-admin, .admin-panel'));
    const clearAdminCursorState = () => {
      ring.classList.remove('hovered', 'has-label');
      delete ring.dataset.label;
      magnetEl = null;
    };

    window.addEventListener('mousemove', e => {
      if (isAdminMode() || isAdminTarget(e.target)) {
        clearAdminCursorState();
        return;
      }
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px'; dot.style.top = my + 'px';
    });

    (function tick() {
      if (!window._rafPaused) {
        if (isAdminMode()) {
          clearAdminCursorState();
          requestAnimationFrame(tick);
          return;
        }
        if (magnetEl) {
          // Pull ring partway toward the element's center — the magnetic feel
          const r = magnetEl.getBoundingClientRect();
          const cx = r.left + r.width  / 2;
          const cy = r.top  + r.height / 2;
          const tx = cx * 0.5 + mx * 0.5;
          const ty = cy * 0.5 + my * 0.5;
          rx += (tx - rx) * 0.22;
          ry += (ty - ry) * 0.22;
        } else {
          rx += (mx - rx) * 0.16;
          ry += (my - ry) * 0.16;
        }
        ring.style.left = rx + 'px';
        ring.style.top  = ry + 'px';
      }
      requestAnimationFrame(tick);
    })();

    document.querySelectorAll('[data-hover]').forEach(el => {
      el.addEventListener('mouseenter', event => {
        if (isAdminMode() || isAdminTarget(event.target)) return;
        ring.classList.add('hovered');
        magnetEl = el;
      });
      el.addEventListener('mouseleave', () => { ring.classList.remove('hovered'); magnetEl = null; });
    });

    document.querySelectorAll('[data-cursor-text]').forEach(el => {
      el.addEventListener('mouseenter', event => {
        if (isAdminMode() || isAdminTarget(event.target)) return;
        ring.classList.add('has-label');
        ring.dataset.label = el.dataset.cursorText || '';
      });
      el.addEventListener('mouseleave', () => {
        ring.classList.remove('has-label');
        delete ring.dataset.label;
      });
    });
  }

  /* ---------- Nav scroll + burger ---------- */
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    });
  }
  const burger    = document.getElementById('navBurger');
  const navMobile = document.getElementById('navMobile');
  if (burger && navMobile) {
    burger.addEventListener('click', () => {
      const isOpen = navMobile.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(isOpen));
    });
    navMobile.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => {
        navMobile.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        navMobile.querySelectorAll('.mobile-mega.open').forEach(item => {
          item.classList.remove('open');
          const toggle = item.querySelector('.mobile-mega-toggle');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
      })
    );
    navMobile.querySelectorAll('.mobile-mega-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const item = toggle.closest('.mobile-mega');
        if (!item) return;
        const shouldOpen = !item.classList.contains('open');
        navMobile.querySelectorAll('.mobile-mega.open').forEach(openItem => {
          if (openItem === item) return;
          openItem.classList.remove('open');
          const openToggle = openItem.querySelector('.mobile-mega-toggle');
          if (openToggle) openToggle.setAttribute('aria-expanded', 'false');
        });
        item.classList.toggle('open', shouldOpen);
        toggle.setAttribute('aria-expanded', String(shouldOpen));
      });
    });
  }

  (function initMegaNavigation() {
    const megaItems = Array.from(document.querySelectorAll('[data-mega-item]'));
    if (!megaItems.length) return;

    const delay = 150;
    let openTimer = null;
    let closeTimer = null;
    let activeItem = null;

    function clearTimers() {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
    }

    function closeItem(item) {
      if (!item) return;
      item.classList.remove('open');
      const trigger = item.querySelector('.nav-link--mega');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      if (activeItem === item) activeItem = null;
    }

    function openItem(item) {
      if (!item) return;
      if (activeItem && activeItem !== item) closeItem(activeItem);
      activeItem = item;
      item.classList.add('open');
      const trigger = item.querySelector('.nav-link--mega');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
    }

    function scheduleOpen(item) {
      clearTimers();
      openTimer = setTimeout(() => openItem(item), delay);
    }

    function scheduleClose(item) {
      clearTimers();
      closeTimer = setTimeout(() => closeItem(item), delay);
    }

    megaItems.forEach(item => {
      const trigger = item.querySelector('.nav-link--mega');
      if (!trigger) return;

      item.addEventListener('mouseenter', () => scheduleOpen(item));
      item.addEventListener('mouseleave', () => scheduleClose(item));
      item.addEventListener('focusin', () => openItem(item));
      item.addEventListener('focusout', event => {
        if (!item.contains(event.relatedTarget)) scheduleClose(item);
      });

      trigger.addEventListener('click', event => {
        event.preventDefault();
        clearTimers();
        item.classList.contains('open') ? closeItem(item) : openItem(item);
      });

      trigger.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          item.classList.contains('open') ? closeItem(item) : openItem(item);
        }
        if (event.key === 'Escape') {
          closeItem(item);
          trigger.focus();
        }
      });
    });

    document.addEventListener('click', event => {
      if (activeItem && !activeItem.contains(event.target)) closeItem(activeItem);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && activeItem) closeItem(activeItem);
    });

    document.querySelectorAll('.mega-menu--services').forEach(menu => {
      const tabs = Array.from(menu.querySelectorAll('.mega-tab'));
      const panels = Array.from(menu.querySelectorAll('.mega-panel'));
      const activateTab = tab => {
        const target = tab.dataset.megaTab;
        tabs.forEach(item => {
          const isActive = item === tab;
          item.classList.toggle('active', isActive);
          item.setAttribute('aria-selected', String(isActive));
        });
        panels.forEach(panel => {
          panel.classList.toggle('active', panel.dataset.megaPanel === target);
        });
      };
      tabs.forEach(tab => {
        tab.addEventListener('mouseenter', () => activateTab(tab));
        tab.addEventListener('focus', () => activateTab(tab));
        tab.addEventListener('click', () => activateTab(tab));
        tab.addEventListener('keydown', event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const offset = event.key === 'ArrowDown' ? 1 : -1;
          const next = tabs[(tabs.indexOf(tab) + offset + tabs.length) % tabs.length];
          next.focus();
          activateTab(next);
        });
      });
    });
  })();

  /* ---------- Active nav link ---------- */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a, .nav-link--mega').forEach(link => {
    const href = link.getAttribute('href') || link.dataset.activePage;
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  (function initHashAnchorLanding() {
    const scrollToHashTarget = () => {
      const hash = decodeURIComponent(window.location.hash || '').replace(/^#/, '');
      if (!hash) return;
      const target = document.getElementById(hash);
      if (!target) return;
      const offset = -96;
      const run = () => {
        if (window._lenis) {
          window._lenis.scrollTo(target, { offset });
        } else {
          const top = target.getBoundingClientRect().top + window.scrollY + offset;
          window.scrollTo({ top, behavior: 'auto' });
        }
      };
      requestAnimationFrame(() => setTimeout(run, 120));
    };
    scrollToHashTarget();
    window.addEventListener('load', scrollToHashTarget);
    window.addEventListener('hashchange', scrollToHashTarget);
  })();

  /* ---------- Year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal-up, .reveal-line');
  if (revealEls.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => io.observe(el));
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(open => {
        open.classList.remove('open');
        const openA = open.querySelector('.faq-a');
        if (openA) openA.style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  /* ---------- Stat counters ---------- */
  const statNums = document.querySelectorAll('.stat-num');
  if (statNums.length) {
    const statIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          const duration = 1400;
          const start = performance.now();
          function step(now) {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(eased * target);
            if (p < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
          statIO.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    statNums.forEach(el => statIO.observe(el));
  }

  /* ---------- Services sidenav active state ---------- */
  const sidenav = document.querySelector('.services-sidenav');
  if (sidenav) {
    const sections = document.querySelectorAll('.service-section[id]');
    const sideLinks = sidenav.querySelectorAll('a');
    const sectionIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          sideLinks.forEach(l => l.classList.remove('active'));
          const active = sidenav.querySelector(`a[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    }, { threshold: 0.3 });
    sections.forEach(s => sectionIO.observe(s));
  }

  /* ---------- Contact form — Phase 19 lead capture ---------- */
  (function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    const gvFormPageLoadTime = Date.now();
    const statusEl = document.getElementById('formStatus');
    const submitBtn = contactForm.querySelector('[type="submit"]');
    let gvSubmitLocked = false;

    function safeAttributionText(value, max) {
      return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max || 500);
    }

    function currentPathWithQuery() {
      const path = safeAttributionText(window.location.pathname || '/contact.html', 240);
      const query = safeAttributionText(window.location.search || '', 500);
      return (path + query).slice(0, 700);
    }

    function getLandingPage() {
      const key = 'growva_landing_page';
      try {
        const existing = sessionStorage.getItem(key);
        if (existing) return safeAttributionText(existing, 700);
        const landing = currentPathWithQuery();
        sessionStorage.setItem(key, landing);
        return landing;
      } catch (e) {
        return currentPathWithQuery();
      }
    }

    function referrerHost(referrer) {
      try {
        const url = new URL(referrer);
        return safeAttributionText(url.hostname.replace(/^www\./, ''), 160);
      } catch (e) {
        return '';
      }
    }

    function collectLeadAttribution() {
      const params = new URLSearchParams(window.location.search || '');
      const referrer = safeAttributionText(document.referrer || '', 700);
      const utm = {
        utm_source: safeAttributionText(params.get('utm_source'), 160),
        utm_medium: safeAttributionText(params.get('utm_medium'), 160),
        utm_campaign: safeAttributionText(params.get('utm_campaign'), 200),
        utm_term: safeAttributionText(params.get('utm_term'), 200),
        utm_content: safeAttributionText(params.get('utm_content'), 200),
      };
      const source = utm.utm_source || referrerHost(referrer) || 'direct';
      return {
        page_path: currentPathWithQuery(),
        landing_page: getLandingPage(),
        referrer,
        source,
        ...utm,
        attribution_json: {
          captured_at: new Date().toISOString(),
          page_path: currentPathWithQuery(),
          landing_page: getLandingPage(),
          referrer,
          referrer_host: referrerHost(referrer),
          source,
          utm,
        },
      };
    }

    function showFormStatus(msg, type) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = 'contact-form-status contact-form-status--' + type;
      statusEl.style.display = '';
    }
    function hideFormStatus() {
      if (!statusEl) return;
      statusEl.style.display = 'none';
    }
    function setSubmitLoading(loading) {
      if (!submitBtn) return;
      const span = submitBtn.querySelector('span');
      submitBtn.disabled = loading;
      if (span) span.textContent = loading ? 'Sending…' : 'Send Inquiry →';
    }

    function validateLeadData(d) {
      if (!d.name || d.name.length < 2) return 'Please enter your full name.';
      if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'Please enter a valid email address.';
      if (!d.project_type) return 'Please select a project type.';
      if (!d.message || d.message.length < 10) return 'Please tell us about your project (at least 10 characters).';
      if (d.message.length > 4000) return 'Message is too long — please keep it under 4000 characters.';
      return null;
    }

    function showFormSuccess() {
      contactForm.style.display = 'none';
      const success = document.getElementById('formSuccess');
      if (success) success.classList.add('show');
    }

    contactForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (gvSubmitLocked) return;
      hideFormStatus();

      // Honeypot: if filled, silently appear to succeed (bot protection)
      const hpField = contactForm.querySelector('[name="hp_website"]');
      if (hpField && hpField.value.trim() !== '') { showFormSuccess(); return; }
      // Timing: submitted in under 2s = likely bot
      if (Date.now() - gvFormPageLoadTime < 2000) { showFormSuccess(); return; }

      const fd = new FormData(contactForm);
      const firstName = (fd.get('first_name') || '').trim();
      const lastName  = (fd.get('last_name')  || '').trim();
      const name      = [firstName, lastName].filter(Boolean).join(' ');
      const email     = (fd.get('email')    || '').trim();
      const company   = (fd.get('company')  || '').trim();
      const projectType = (fd.get('service') || '').trim();
      const budget    = (fd.get('budget')   || '').trim();
      let   message   = (fd.get('message')  || '').trim();
      const timeline  = (fd.get('timeline') || '').trim();
      if (timeline) message += '\n\nIdeal start date: ' + timeline;

      const leadData = { name, email, company, project_type: projectType, budget, message };
      const validationError = validateLeadData(leadData);
      if (validationError) { showFormStatus(validationError, 'error'); return; }

      gvSubmitLocked = true;
      setSubmitLoading(true);
      showFormStatus('Sending your message…', 'loading');

      try {
        const cfg = window.GROWVA_SUPABASE_CONFIG;
        if (cfg && cfg.url && cfg.anonKey && window.supabase) {
          const client = window.supabase.createClient(cfg.url, cfg.anonKey);
          const attribution = collectLeadAttribution();
          const basePayload = {
            name,
            email,
            company:      company      || null,
            project_type: projectType  || null,
            budget:       budget       || null,
            message,
            page_path:    attribution.page_path || '/contact.html',
            source:       attribution.source || 'direct',
            user_agent:   navigator.userAgent ? navigator.userAgent.slice(0, 400) : null,
          };
          const attributionPayload = Object.assign({}, basePayload, {
            landing_page:     attribution.landing_page     || null,
            referrer:         attribution.referrer         || null,
            utm_source:       attribution.utm_source       || null,
            utm_medium:       attribution.utm_medium       || null,
            utm_campaign:     attribution.utm_campaign     || null,
            utm_term:         attribution.utm_term         || null,
            utm_content:      attribution.utm_content      || null,
            attribution_json: attribution.attribution_json || {},
          });
          let { error } = await client.from('cms_contact_submissions').insert([attributionPayload]);
          const canFallbackToBase =
            error &&
            /column|schema cache|could not find/i.test(String(error.message || error.details || error.hint || ''));
          if (canFallbackToBase) {
            const fallback = await client.from('cms_contact_submissions').insert([basePayload]);
            error = fallback.error;
          }
          if (error) throw new Error(error.message || 'Submission failed');
        } else {
          // Supabase not configured — form submission cannot be stored
          // Surface a friendly error instead of silently succeeding
          throw new Error('Form service not available');
        }
        showFormSuccess();
      } catch (err) {
        gvSubmitLocked = false;
        setSubmitLoading(false);
        const isServiceErr = (err.message || '').includes('not available');
        showFormStatus(
          isServiceErr
            ? 'Form service is currently unavailable. Please email us directly at hello@growva.com.'
            : 'Something went wrong — please try again or email us at hello@growva.com.',
          'error'
        );
      }
    });
  })();

  /* ---------- Work filter ---------- */
  (function initWorkFilter() {
    const filterBtns = Array.from(document.querySelectorAll('.work-filter-btn'));
    const caseCards = Array.from(document.querySelectorAll('.case-card[data-category]'));
    if (!filterBtns.length || !caseCards.length) return;

    const emptyState = document.getElementById('workEmpty');
    const aliases = {
      'food-beverage': 'food',
      'food-and-beverage': 'food'
    };
    const validFilters = new Set(['all', ...filterBtns.map(btn => btn.dataset.filter)]);

    function normalizeFilter(value) {
      const key = (value || 'all').toLowerCase().replace(/^#/, '');
      return aliases[key] || key || 'all';
    }

    function applyFilter(filter, updateHash) {
      const normalized = validFilters.has(filter) ? filter : 'all';
      filterBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === normalized));
      let visibleCount = 0;
      caseCards.forEach(card => {
        const isVisible = normalized === 'all' || card.dataset.category === normalized;
        card.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount += 1;
      });
      if (emptyState) emptyState.classList.toggle('show', visibleCount === 0);
      if (updateHash) {
        const nextHash = normalized === 'all' ? '#all' : `#${normalized}`;
        if (window.location.hash !== nextHash) history.replaceState(null, '', nextHash);
      }
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => applyFilter(btn.dataset.filter, true));
    });

    const applyHashFilter = () => {
      const rawHash = decodeURIComponent(window.location.hash || '').replace(/^#/, '');
      const normalized = normalizeFilter(rawHash);
      if (!validFilters.has(normalized) && rawHash && document.getElementById(rawHash)) {
        applyFilter('all', false);
        requestAnimationFrame(() => {
          document.getElementById(rawHash)?.scrollIntoView({ block: 'start' });
        });
        return;
      }
      applyFilter(normalized, false);
    };
    applyHashFilter();
    window.addEventListener('hashchange', applyHashFilter);
  })();

  /* ---------- GSAP ScrollTrigger ---------- */
  if (window.gsap && window.ScrollTrigger) {
    const gsapPlugins = [ScrollTrigger];
    if (window.Flip) gsapPlugins.push(Flip);
    gsap.registerPlugin(...gsapPlugins);

    function initIntroBentoGalleries() {
      document.querySelectorAll('.gallery--switch').forEach(galleryElement => {
        const galleryItems = galleryElement.querySelectorAll('.gallery__item');
        const galleryLabels = galleryElement.querySelectorAll('.gallery-caption');
        if (!galleryItems.length) return;

        const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const desktopQuery = window.matchMedia('(min-width: 900px)');
        let flipCtx;
        let resizeFrame = null;

        const createTween = () => {
          flipCtx && flipCtx.revert();
          galleryElement.classList.remove('gallery--final', 'gallery--static');
          gsap.set(galleryItems, { clearProps: 'all' });
          gsap.set(galleryLabels, { clearProps: 'all' });
          gsap.set(galleryLabels, { autoAlpha: 0, y: 8 });

          if (!window.Flip || reduceMotionQuery.matches || !desktopQuery.matches) {
            galleryElement.classList.add('gallery--static');
            flipCtx = gsap.context(() => {
              if (reduceMotionQuery.matches) {
                gsap.set([...galleryItems, ...galleryLabels], { autoAlpha: 1, y: 0 });
                return () => gsap.set([...galleryItems, ...galleryLabels], { clearProps: 'all' });
              }

              gsap.fromTo(galleryItems,
                { autoAlpha: 0, y: reduceMotionQuery.matches ? 0 : 18 },
                {
                  autoAlpha: 1,
                  y: 0,
                  duration: reduceMotionQuery.matches ? 0.18 : 0.45,
                  stagger: 0.035,
                  ease: 'power1.out',
                  scrollTrigger: {
                    trigger: galleryElement.parentNode,
                    start: 'top 82%',
                    once: true
                  }
                }
              );
              gsap.set(galleryLabels, { autoAlpha: 1, y: 0 });
              return () => gsap.set([...galleryItems, ...galleryLabels], { clearProps: 'all' });
            }, galleryElement.parentNode);
            if (window._lenis) window._lenis.resize();
            ScrollTrigger.refresh();
            return;
          }

          flipCtx = gsap.context(() => {
            const flipState = Flip.getState(galleryItems);
            galleryElement.classList.add('gallery--final');
            const flip = Flip.from(flipState, {
              simple: true,
              ease: 'expoScale(1, 5)',
              duration: 1
            });
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: galleryElement,
                start: 'center center',
                end: '+=100%',
                scrub: true,
                pin: galleryElement.parentNode,
                invalidateOnRefresh: true
              }
            });
            tl.add(flip, 0);
            tl.to(galleryLabels, {
              autoAlpha: 1,
              y: 0,
              duration: 0.12,
              stagger: 0.02,
              ease: 'none'
            }, 0.84);
            return () => gsap.set([...galleryItems, ...galleryLabels], { clearProps: 'all' });
          }, galleryElement.parentNode);

          if (window._lenis) window._lenis.resize();
          ScrollTrigger.refresh();
        };

        createTween();
        window.addEventListener('resize', () => {
          if (resizeFrame) cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            resizeFrame = null;
            createTween();
          });
        });
      });
    }

    initIntroBentoGalleries();

    function initBentoGallery() {
      const galleryElement = document.querySelector('#bentoGallery');
      if (!galleryElement || !window.gsap || !window.Flip || !window.ScrollTrigger) return;
      const galleryItems = galleryElement.querySelectorAll('.bento-gallery__item');
      const galleryLabels = galleryElement.querySelectorAll('.bento-gallery__label');
      const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const desktopQuery = window.matchMedia('(min-width: 900px)');
      let flipCtx;

      const createTween = () => {
        flipCtx && flipCtx.revert();
        galleryElement.classList.remove('bento-gallery--final', 'bento-gallery--static');
        gsap.set(galleryLabels, { autoAlpha: 0, y: 8 });

        if (reduceMotionQuery.matches || !desktopQuery.matches) {
          galleryElement.classList.add('bento-gallery--final', 'bento-gallery--static');
          flipCtx = gsap.context(() => {
            gsap.fromTo(galleryItems,
              { autoAlpha: 0 },
              {
                autoAlpha: 1,
                duration: reduceMotionQuery.matches ? 0.18 : 0.35,
                stagger: 0.035,
                ease: 'power1.out',
                scrollTrigger: {
                  trigger: galleryElement.parentNode,
                  start: 'top 80%',
                  once: true
                }
              }
            );
            gsap.set(galleryLabels, { autoAlpha: 1, y: 0 });
            return () => gsap.set([...galleryItems, ...galleryLabels], { clearProps: 'all' });
          }, galleryElement.parentNode);
          if (window._lenis) window._lenis.resize();
          ScrollTrigger.refresh();
          return;
        }

        flipCtx = gsap.context(() => {
          const flipState = Flip.getState(galleryItems);
          galleryElement.classList.add('bento-gallery--final');
          const flip = Flip.from(flipState, { simple: true, paused: true, ease: 'power3.inOut', duration: 1 });
          flip.pause(0);
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: galleryElement,
              start: 'center center',
              end: '+=100%',
              scrub: true,
              pin: galleryElement.parentNode,
              invalidateOnRefresh: true
            }
          });
          tl.add(flip);
          flip.paused(false);
          tl.to(galleryLabels, {
            autoAlpha: 1,
            y: 0,
            duration: 0.14,
            stagger: 0.02,
            ease: 'none'
          }, 0.88);
          return () => gsap.set([...galleryItems, ...galleryLabels], { clearProps: 'all' });
        }, galleryElement.parentNode);

        if (window._lenis) window._lenis.resize();
        ScrollTrigger.refresh();
      };

      createTween();
      let _bentoResizeFrame = null;
      window.addEventListener('resize', () => {
        if (_bentoResizeFrame) cancelAnimationFrame(_bentoResizeFrame);
        _bentoResizeFrame = requestAnimationFrame(() => { _bentoResizeFrame = null; createTween(); });
      });
    }

    initBentoGallery();

    const processLineFill = document.getElementById('processLineFill');
    if (processLineFill) {
      gsap.to('#processLineFill', {
        width: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: '.process-track-wrap',
          start: 'top 70%',
          end: 'bottom 60%',
          scrub: 0.6
        }
      });
    }

    document.querySelectorAll('.case-visual-inner').forEach(el => {
      gsap.to(el, {
        yPercent: -8,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });

    /* ---------- Hero stack-deck scroll scatter ---------- */
    (function heroStackDeck() {
      const deck     = document.getElementById('stackDeck');
      if (!deck) return;
      const cards    = Array.from(deck.querySelectorAll('.stack-card'));
      if (cards.length < 4) return;
      const travelEl = document.getElementById('cardTravel');

      // Initial stacked fan — GSAP owns all transforms from here
      gsap.set(cards[0], { rotation: -6,  x: -10, y:  6, zIndex: 4 });
      gsap.set(cards[1], { rotation: -2,  x:  -4, y:  2, zIndex: 3 });
      gsap.set(cards[2], { rotation:  2,  x:   4, y:  2, zIndex: 2 });
      gsap.set(cards[3], { rotation:  6,  x:  10, y:  6, zIndex: 1 });

      // Prefers-reduced-motion: static scattered positions, no pin, no travel
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(cards[0], { x: '-36vw', y: '22vh',  rotation: -14, scale: 0.62 });
        gsap.set(cards[1], { x: '-13vw', y: '-22vh', rotation:  11, scale: 0.65 });
        gsap.set(cards[2], { x:   '3vw', y: '-26vh', rotation:  -8, scale: 0.63 });
        gsap.set(cards[3], { x:   '4vw', y:  '20vh', rotation:  16, scale: 0.61 });
        return;
      }

      // Mobile (< 900px): static stacked deck only
      if (window.matchMedia('(max-width: 899px)').matches) return;
      if (!travelEl) return;

      // Final scatter target scales (~62% of original)
      const scatterScales = [0.62, 0.65, 0.63, 0.61];
      const scatterRots   = [-14, 11, -8, 16];

      // Scatter timeline — driven by the pin ScrollTrigger below
      const tl = gsap.timeline();
      tl.to('.hero-scroll', { opacity: 0, duration: 0.4 }, 0);
      tl.to(cards[0], { x: '-36vw', y:  '22vh', rotation: -14, scale: scatterScales[0], ease: 'power2.out', duration: 7 }, 0);
      tl.to(cards[1], { x: '-13vw', y: '-22vh', rotation:  11, scale: scatterScales[1], ease: 'power2.out', duration: 7 }, 0.14);
      tl.to(cards[2], { x:   '3vw', y: '-26vh', rotation:  -8, scale: scatterScales[2], ease: 'power2.out', duration: 7 }, 0.28);
      tl.to(cards[3], { x:   '4vw', y:  '20vh', rotation:  16, scale: scatterScales[3], ease: 'power2.out', duration: 7 }, 0.42);
      // Hero text subtly recedes as cards take visual focus
      tl.to(deck, { autoAlpha: 0, duration: 0.55, ease: 'none' }, 0.4);

      // Desktop hover lift — yPercent doesn't conflict with scatter's absolute y
      if (window.matchMedia('(hover: hover)').matches) {
        cards.forEach((card, i) => {
          card.addEventListener('mouseenter', () => {
            gsap.to(card, { yPercent: -2, scale: scatterScales[i] * 1.04,
                            duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
          });
          card.addEventListener('mouseleave', () => {
            gsap.to(card, { yPercent: 0, scale: scatterScales[i],
                            duration: 0.5, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
          });
        });
      }

      // Travel system — fixed-position cards drifting down at different speeds
      const travelTops  = ['-30vh', '-34vh', '-29vh', '0vh'];
      const travelEnds  = [0.64, 0.82, 0.72, 0.9];
      const fadeInAt    = [0.12, 0.12, 0.12, 0.32];
      const extraRot    = [-3, 4, -2, 5];

      const travelCards = cards.map((card, i) => {
        const clone = card.cloneNode(true);
        clone.classList.add(
          'stack-card--traveling',
          i % 2 === 0 ? 'travel-lane-left' : 'travel-lane-right'
        );
        clone.style.setProperty('--travel-top', travelTops[i]);
        travelEl.appendChild(clone);
        return clone;
      });

      gsap.set(travelCards, {
        autoAlpha: 0,
        scale: 0.58,
        transformOrigin: '50% 50%',
        pointerEvents: 'auto'
      });

      travelCards.forEach((card, i) => {
        const travelTl = gsap.timeline({
          scrollTrigger: {
            trigger: travelEl,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true
          }
        });

        travelTl.set(card, {
          autoAlpha: 0,
          y: () => window.innerHeight * 0.08,
          rotation: scatterRots[i],
          scale: 0.58
        }, 0);
        travelTl.to(card, { autoAlpha: 1, duration: 0.08, ease: 'none' }, fadeInAt[i]);
        travelTl.to(card, {
          y: () => travelEl.offsetHeight * travelEnds[i],
          rotation: scatterRots[i] + extraRot[i],
          ease: 'none',
          duration: 1
        }, 0);
        travelTl.to(card, { autoAlpha: 0, duration: 0.15, ease: 'power1.in' }, 0.85);
      });
      ScrollTrigger.create({
        animation        : tl,
        trigger          : '.hero-travel-scene',
        start            : 'top top',
        end              : '+=100%',
        scrub            : 1,
        invalidateOnRefresh: true
      });
    })();
  }

  /* ================= THREE.js — Hero background (index only) ================= */
  (function heroScene() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas || !window.THREE) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 3.4, 7.2);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const geo     = new THREE.PlaneGeometry(16, 16, 64, 64);
    geo.rotateX(-Math.PI / 2.6);
    const mat     = new THREE.MeshBasicMaterial({ color: 0xB1FA20, wireframe: true, transparent: true, opacity: 0.45 });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.position.y = -1.6;
    scene.add(terrain);

    const pos  = geo.attributes.position;
    const base = new Float32Array(pos.array.length);
    base.set(pos.array);

    const pCount = 260;
    const pGeo   = new THREE.BufferGeometry();
    const pPos   = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3]     = (Math.random() - 0.5) * 14;
      pPos[i * 3 + 1] = Math.random() * 6 - 1;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat     = new THREE.PointsMaterial({ color: 0xf6f6f6, size: 0.03, transparent: true, opacity: 0.5 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    let targetX = 0, targetY = 0;
    window.addEventListener('mousemove', e => {
      targetX = e.clientX / window.innerWidth - 0.5;
      targetY = e.clientY / window.innerHeight - 0.5;
    });

    const clock = new THREE.Clock();
    let heroVisible = true;
    const heroIO = new IntersectionObserver(e => { heroVisible = e[0].isIntersecting; }, { threshold: 0 });
    heroIO.observe(canvas);

    function animate() {
      requestAnimationFrame(animate);
      if (window._rafPaused || !heroVisible) return;
      const t   = clock.getElapsedTime();
      const arr = pos.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], z = base[i + 2];
        arr[i + 1] = base[i + 1] + Math.sin(x * 0.5 + t * 0.6) * 0.35 + Math.cos(z * 0.5 + t * 0.4) * 0.35;
      }
      pos.needsUpdate = true;
      particles.rotation.y = t * 0.02;
      camera.position.x += (targetX * 1.6 - camera.position.x) * 0.02;
      camera.position.y += (3.4 - targetY * 1.0 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    resize();
    window.addEventListener('resize', resize);
    animate();
  })();

  /* ================= THREE.js — CTA particle field (shared, lightweight) ================= */
  (function ctaScene() {
    const canvas = document.getElementById('ctaCanvas');
    if (!canvas || !window.THREE) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 6);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const count  = 180;
    const geo    = new THREE.BufferGeometry();
    const posArr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      posArr[i * 3]     = (Math.random() - 0.5) * 12;
      posArr[i * 3 + 1] = (Math.random() - 0.5) * 7;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const mat    = new THREE.PointsMaterial({ color: 0xB1FA20, size: 0.045, transparent: true, opacity: 0.55 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const clock = new THREE.Clock();
    let visible = false;
    const io    = new IntersectionObserver(entries => {
      entries.forEach(e => visible = e.isIntersecting);
    }, { threshold: 0.05 });
    io.observe(canvas);

    function animate() {
      requestAnimationFrame(animate);
      if (!visible || window._rafPaused) return;
      const t = clock.getElapsedTime();
      points.rotation.y = t * 0.035;
      points.rotation.x = Math.sin(t * 0.1) * 0.05;
      renderer.render(scene, camera);
    }
    resize();
    window.addEventListener('resize', resize);
    animate();
  })();

  /* ================= THREE.js — Inner page hero particle (lightweight) ================= */
  (function pageHeroScene() {
    const canvas = document.getElementById('pageHeroCanvas');
    if (!canvas || !window.THREE) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 5);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const count  = 120;
    const geo    = new THREE.BufferGeometry();
    const posArr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      posArr[i * 3]     = (Math.random() - 0.5) * 10;
      posArr[i * 3 + 1] = (Math.random() - 0.5) * 6;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const mat    = new THREE.PointsMaterial({ color: 0xB1FA20, size: 0.04, transparent: true, opacity: 0.5 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const clock = new THREE.Clock();
    let pageHeroVisible = true;
    const phIO = new IntersectionObserver(e => { pageHeroVisible = e[0].isIntersecting; }, { threshold: 0 });
    phIO.observe(canvas);

    function animate() {
      requestAnimationFrame(animate);
      if (window._rafPaused || !pageHeroVisible) return;
      const t = clock.getElapsedTime();
      points.rotation.y = t * 0.025;
      renderer.render(scene, camera);
    }
    resize();
    window.addEventListener('resize', resize);
    animate();
  })();

  /* ================= THREE.js - recurring brand object ================= */
  (function initBrandObjects() {
    const canvases = document.querySelectorAll('[data-brand-object]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canvases.length || !window.THREE || reduced) return;

    const pointer = { x: 0, y: 0 };
    window.addEventListener('mousemove', e => {
      pointer.x = e.clientX / window.innerWidth - 0.5;
      pointer.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    canvases.forEach(canvas => {
      const variant = canvas.dataset.brandObject || 'footer';
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, variant === 'footer' ? 1.4 : 1.75));
      if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0, variant === 'hero' ? 5.4 : 5.8);

      const detail = variant === 'footer' ? 64 : 88;
      const geometry = new THREE.TorusKnotGeometry(1, 0.28, detail, 12, 2, 3);
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const wobble = 1 + Math.sin(x * 2.1 + y * 1.7 + z * 1.3) * 0.045;
        pos.setXYZ(i, x * wobble, y * wobble, z * wobble);
      }
      geometry.computeVertexNormals();

      const material = new THREE.MeshPhysicalMaterial({
        color: 0x0c1009,
        roughness: 0.34,
        metalness: 0.34,
        clearcoat: 0.82,
        clearcoatRoughness: 0.22,
        emissive: 0x142802,
        emissiveIntensity: 0.42
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.set(0.35, -0.6, 0.15);
      mesh.scale.setScalar(variant === 'shopify' ? 1.35 : 1.0);
      scene.add(mesh);

      const rimMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xB1FA20) },
          uPulse: { value: 0 }
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uPulse;
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float rim = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.3);
            float alpha = smoothstep(0.18, 1.0, rim) * (0.28 + uPulse * 0.16);
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const rim = new THREE.Mesh(geometry, rimMaterial);
      rim.scale.copy(mesh.scale).multiplyScalar(1.045);
      scene.add(rim);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 26),
        new THREE.LineBasicMaterial({ color: 0xB1FA20, transparent: true, opacity: variant === 'footer' ? 0.16 : 0.22 })
      );
      edges.scale.copy(mesh.scale).multiplyScalar(1.01);
      scene.add(edges);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const key = new THREE.DirectionalLight(0xB1FA20, 1.35);
      key.position.set(2.5, 2.2, 3.6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.55);
      fill.position.set(-2, -1.2, 2.5);
      scene.add(fill);

      let visible = false;
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => { visible = entry.isIntersecting; });
      }, { threshold: 0.05 });
      io.observe(canvas);

      function resize() {
        const w = Math.max(1, canvas.clientWidth);
        const h = Math.max(1, canvas.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      const clock = new THREE.Clock();
      function animate() {
        requestAnimationFrame(animate);
        if (!visible || window._rafPaused) return;
        const t = clock.getElapsedTime();
        const speed = variant === 'hero' ? 0.22 : 0.16;
        const tiltX = -pointer.y * (variant === 'footer' ? 0.22 : 0.36);
        const tiltY = pointer.x * (variant === 'footer' ? 0.26 : 0.42);
        mesh.rotation.x += (0.35 + tiltX - mesh.rotation.x) * 0.035;
        mesh.rotation.y += (-0.6 + t * speed + tiltY - mesh.rotation.y) * 0.035;
        mesh.rotation.z = 0.15 + Math.sin(t * 0.45) * 0.035;
        rim.rotation.copy(mesh.rotation);
        edges.rotation.copy(mesh.rotation);
        material.emissiveIntensity = 0.36 + Math.sin(t * 1.25) * 0.08;
        rimMaterial.uniforms.uPulse.value = (Math.sin(t * 1.1) + 1) * 0.5;
        renderer.render(scene, camera);
      }

      resize();
      window.addEventListener('resize', resize);
      animate();
    });
  })();
  /* =======================================================================
     CINEMATIC SYSTEM — page transitions · magnetic · tilt · spotlight
     ======================================================================= */

  /* ---------- Tab-visibility pause (all rAF & GSAP) ---------- */
  document.addEventListener('visibilitychange', () => {
    window._rafPaused = document.hidden;
    if (window.gsap) {
      document.hidden ? gsap.globalTimeline.pause() : gsap.globalTimeline.resume();
    }
  });

  /* ---------- Page transition system ---------- */
  (function initPageTransitions() {
    const overlay = document.getElementById('pageTransition');
    if (!overlay) return;
    const line    = overlay.querySelector('.pt-line');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Detect if this page was arrived at via our transition click
    const isNav = sessionStorage.getItem('gv_nav') === '1';
    sessionStorage.removeItem('gv_nav');

    if (isNav) {
      if (reduced || !window.gsap) {
        overlay.style.opacity = '0';
      } else {
        gsap.set(overlay, { scaleY: 1, transformOrigin: 'top center', pointerEvents: 'none' });
        gsap.to(overlay, { scaleY: 0, duration: 0.5, ease: 'power3.inOut', delay: 0.06 });
      }
    }

    document.addEventListener('click', e => {
      if (e.target.closest('[data-admin-ui], [data-admin-action], [data-admin-entry], .gv-admin-root, .gv-admin, .admin-shell, .growva-admin, .admin-panel')) return;
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      // Skip external, mailto, tel, hash-only, new-tab
      if (!href || /^(https?:|mailto:|tel:|\/\/|#)/.test(href) || link.target === '_blank') return;

      e.preventDefault();
      let gone = false;
      const go = () => {
        if (gone) return; gone = true;
        try {
          const adminIntent = document.body.classList.contains('admin-mode') || localStorage.getItem('growva_admin_mode_intent') === '1';
          if (adminIntent) {
            const supabaseStorageKeysCount = Object.keys(localStorage)
              .filter(key => key.includes('supabase') || key.startsWith('sb-')).length +
              Object.keys(sessionStorage)
                .filter(key => key.includes('supabase') || key.startsWith('sb-')).length;
            sessionStorage.setItem('growva_admin_nav_pending', '1');
            sessionStorage.setItem('growva_admin_last_navigation_handoff', JSON.stringify({
              source: 'public-page-transition',
              fromUrl: window.location.href,
              fromPath: window.location.pathname || '/',
              toPath: href,
              adminModeActive: document.body.classList.contains('admin-mode'),
              adminModeIntent: localStorage.getItem('growva_admin_mode_intent') === '1',
              supabaseStorageKeysCount,
              at: new Date().toISOString()
            }));
            if (window.GROWVA_ADMIN_DEBUG) console.info('[GROWVA Admin Nav]', 'handoff-set', { href, supabaseStorageKeysCount });
          }
        } catch (_) {}
        sessionStorage.setItem('gv_nav', '1');
        window.location.href = href;
      };
      // Hard timeout: overlay must never trap the user
      setTimeout(go, 1400);

      if (reduced || !window.gsap) { go(); return; }

      overlay.style.pointerEvents = 'all';
      const tl = gsap.timeline({ onComplete: go });
      if (line) {
        tl.set(overlay, { scaleY: 0, transformOrigin: 'bottom center' })
          .set(line, { width: '0%' })
          .to(line,    { width: '100%', duration: 0.22, ease: 'power2.inOut' })
          .to(overlay, { scaleY: 1,     duration: 0.38, ease: 'power3.inOut' }, '-=0.04');
      } else {
        tl.set(overlay, { scaleY: 0, transformOrigin: 'bottom center' })
          .to(overlay, { scaleY: 1, duration: 0.5, ease: 'power3.inOut' });
      }
    });
  })();

  /* ---------- Magnetic buttons ---------- */
  (function initMagneticButtons() {
    if (!window.matchMedia('(hover: hover)').matches || !window.gsap) return;
    document.querySelectorAll('.btn-primary, .btn-ghost, .btn-nav').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        if (document.body.classList.contains('admin-mode') || e.target.closest('[data-admin-ui], [data-admin-action], [data-admin-entry], .gv-admin-root, .gv-admin, .admin-shell, .growva-admin, .admin-panel')) return;
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width  - 0.5) * 2;
        const y = ((e.clientY - r.top)  / r.height - 0.5) * 2;
        gsap.to(btn, { x: x * 9, y: y * 5, duration: 0.32, ease: 'power2.out', overwrite: 'auto' });
      });
      btn.addEventListener('mouseleave', () => {
        if (document.body.classList.contains('admin-mode')) return;
        gsap.to(btn, { x: 0, y: 0, duration: 0.75, ease: 'elastic.out(1,0.4)', overwrite: 'auto' });
      });
    });
  })();

  /* ---------- Radial spotlight on dark sections ---------- */
  (function initSpotlight() {
    if (!window.matchMedia('(hover: hover)').matches) return;
    document.querySelectorAll('.hero, .final-cta, .footer').forEach(el => {
      const s = document.createElement('div');
      s.className = 'spotlight';
      s.setAttribute('aria-hidden', 'true');
      el.insertBefore(s, el.firstChild);
      el.addEventListener('mousemove', e => {
        if (document.body.classList.contains('admin-mode')) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sl-x', (e.clientX - r.left) + 'px');
        el.style.setProperty('--sl-y', (e.clientY - r.top)  + 'px');
      });
    });
  })();

  /* ---------- 3-D tilt on card-like elements (sitewide) ---------- */
  (function initTiltCards() {
    if (!window.matchMedia('(hover: hover)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const SEL = [
      '.why-card', '.service-compact-item', '.case-card',
      '.shopify-pillar', '.process-stage', '.pricing-card',
      '.value-card', '.faq-item', '.shopify-process-step',
      '.latest-project-card'
    ].join(',');
    document.querySelectorAll(SEL).forEach(card => {
      card.classList.add('has-tilt');
      card.addEventListener('mousemove', e => {
        if (document.body.classList.contains('admin-mode')) return;
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width  - 0.5;
        const y = (e.clientY - r.top)  / r.height - 0.5;
        card.style.setProperty('--tilt-x', (-y * 11) + 'deg');
        card.style.setProperty('--tilt-y', ( x * 11) + 'deg');
      });
      card.addEventListener('mouseleave', () => {
        if (document.body.classList.contains('admin-mode')) return;
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
      });
    });
  })();

  /* ---------- Case-study mask reveals + animated metric counters ---------- */
  (function initWorkPage() {
    const visuals = document.querySelectorAll('.case-visual');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (visuals.length && window.gsap && window.ScrollTrigger && !reduced) {
      visuals.forEach(visual => {
        gsap.set(visual, { clipPath: 'inset(0 0 100% 0)' });
        gsap.to(visual, {
          clipPath: 'inset(0 0 0% 0)',
          duration: 1.05,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: visual.closest('.case-card') || visual,
            start: 'top 85%',
            once: true
          }
        });
      });
    }

    // Metric counters: parse text → animate 0 → value on viewport entry
    const metrics = document.querySelectorAll('.case-metrics span');
    if (!metrics.length) return;
    const mIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el._counted) return;
        el._counted = true;
        mIO.unobserve(el);
        const raw = el.textContent.trim();
        const m   = raw.match(/^([^0-9]*)(\d+(?:\.\d+)?)([^0-9]*)$/);
        if (!m) return;
        const pre = m[1], num = parseFloat(m[2]), suf = m[3];
        const isF = m[2].includes('.');
        const dur = 1300, t0 = performance.now();
        (function step(now) {
          const p = Math.min((now - t0) / dur, 1);
          const v = num * (1 - Math.pow(1 - p, 3));
          el.textContent = pre + (isF ? v.toFixed(1) : Math.round(v)) + suf;
          if (p < 1) requestAnimationFrame(step);
        })(performance.now());
      });
    }, { threshold: 0.65 });
    metrics.forEach(el => mIO.observe(el));
  })();

  /* ---------- Shopify.html chapter scroll navigation ---------- */
  (function initShopifyChapters() {
    const nav = document.getElementById('shopifyChapterNav');
    if (!nav || !window.gsap || !window.ScrollTrigger) return;
    const reduced  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chapters = Array.from(document.querySelectorAll('[data-chapter]'));
    const dots     = Array.from(nav.querySelectorAll('.chapter-dot'));
    const LABELS   = ['Platform','Advantages','How We Build','Ecosystem','After Launch'];

    // Inject sticky chapter label into each section
    chapters.forEach((ch, i) => {
      const lbl = document.createElement('div');
      lbl.className = 'chapter-label container';
      lbl.innerHTML =
        `<span class="chapter-label-line"></span>${String(i + 1).padStart(2,'0')} — ${LABELS[i] || ''}`;
      ch.insertBefore(lbl, ch.firstChild);
    });

    // Nav visibility
    ScrollTrigger.create({
      trigger: chapters[0], start: 'top 60%',
      onEnter:     () => nav.classList.add('visible'),
      onLeaveBack: () => nav.classList.remove('visible')
    });
    if (chapters.length > 1) {
      ScrollTrigger.create({
        trigger: chapters[chapters.length - 1], start: 'bottom 40%',
        onEnter:     () => nav.classList.remove('visible'),
        onLeaveBack: () => nav.classList.add('visible')
      });
    }

    // Active dot per chapter + stagger reveal
    chapters.forEach((ch, i) => {
      ScrollTrigger.create({
        trigger: ch, start: 'top 44%', end: 'bottom 44%',
        onEnter:     () => { dots.forEach(d => d.classList.remove('active')); dots[i]?.classList.add('active'); },
        onEnterBack: () => { dots.forEach(d => d.classList.remove('active')); dots[i]?.classList.add('active'); }
      });
      if (!reduced) {
        ch.querySelectorAll('.shopify-pillar,.shopify-process-step,.integration-item').forEach((item, j) => {
          gsap.fromTo(item,
            { y: 26, opacity: 0 },
            { y: 0,  opacity: 1, duration: 0.6, delay: j * 0.04,
              ease: 'power2.out',
              scrollTrigger: { trigger: item, start: 'top 90%', once: true }
            }
          );
        });
      }
    });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        if (!chapters[i]) return;
        if (window._lenis) {
          window._lenis.scrollTo(chapters[i], { offset: 0 });
        } else {
          chapters[i].scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  })();

});
