/* ===== scripts.js =====
   Client-side behavior for portfolio site
   - Place at /assets/js/scripts.js and include with `defer` in html.
   - Clean, well-documented, feature-rich, progressive enhancement friendly.

   This file includes:
   - Utility helpers
   - Theme (day/night) support (respects system prefs + persists choice)
   - DOM initializers (menu, smooth scroll, fade observer, contact)
   - Particle background
   - Image enhancements
   - Exports a small API on window.portfolioUtils
*/

/* ========================
   Utility helpers
   ======================== */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/** debounce(fn, wait) - common utility */
function debounce(fn, wait = 150) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
}

/** timeoutFetch - fetch wrapper that times out */
async function timeoutFetch(url, opts = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/* Email validation (simple, adequate for client-side) */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* Prefers reduced motion */
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Simple client-side rate limiter: disallow another submit for N seconds */
const SUBMIT_COOLDOWN_SECONDS = 25;

/* ========================
   THEME (day/night) SUPPORT
   - respects system preference
   - persists choice in localStorage ('site-theme' = 'light'|'dark')
   - toggle button id expected: #theme-toggle
   - icon id expected: #theme-icon (switches fa-moon / fa-sun)
   ======================== */
const THEME_KEY = 'site-theme';

/**
 * applyTheme(theme)
 * theme: 'dark' or 'light'
 */
function applyTheme(theme) {
  const html = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');

  if (theme === 'dark') {
    html.classList.add('dark');
    if (toggle) toggle.setAttribute('aria-pressed', 'true');
    if (icon) {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    }
  } else {
    html.classList.remove('dark');
    if (toggle) toggle.setAttribute('aria-pressed', 'false');
    if (icon) {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    }
  }
}

/** returns boolean whether OS prefers dark */
function systemPrefersDark() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    return false;
  }
}

/** Initialize theme on page load */
function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  // Load saved preference if present
  let saved;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { saved = null; }

  if (saved === 'dark' || saved === 'light') {
    applyTheme(saved);
  } else {
    // no saved pref: follow system
    applyTheme(systemPrefersDark() ? 'dark' : 'light');
  }

  // Toggle handler
  function toggleHandler() {
    const html = document.documentElement;
    const currentlyDark = html.classList.contains('dark');
    const next = currentlyDark ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
  }

  if (toggle) {
    toggle.addEventListener('click', toggleHandler);
    // keyboard accessibility: space/enter should toggle as well
    toggle.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        toggleHandler();
      }
    });
  }

  // If user hasn't explicitly set a preference, respond to system changes
  try {
    if (!saved && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        applyTheme(e.matches ? 'dark' : 'light');
      });
    }
  } catch (e) { /* ignore environments that don't support addEventListener on matchMedia */ }
}

/* ------------------------------
   DOMContentLoaded init
   ------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  setCurrentYear();
  initThemeToggle();       // initialize theme early
  initMobileMenu();
  initSmoothScroll();
  initFadeObserver();
  initContactForm();
  initParticles(); // starts background particles (no-op if reduced-motion)
  enhanceImages();
});

/* ========================
   Year in footer
   ======================== */
function setCurrentYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* ========================
   Mobile menu (accessible)
   ======================== */
function initMobileMenu() {
  const btn = $('#menu-toggle');
  const menu = $('#mobile-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', (!expanded).toString());
    menu.classList.toggle('hidden');
  });

  // close menu on resize -> restore state
  window.addEventListener('resize', debounce(() => {
    if (window.innerWidth >= 768) {
      btn.setAttribute('aria-expanded', 'false');
      menu.classList.add('hidden');
    }
  }, 120));
}

/* ========================
   Smooth scroll for anchor links
   ======================== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // close mobile menu if open
      const mobile = document.getElementById('mobile-menu');
      if (mobile && !mobile.classList.contains('hidden')) mobile.classList.add('hidden');
    });
  });
}

/* ========================
   IntersectionObserver for fade-in
   ======================== */
function initFadeObserver() {
  if (prefersReducedMotion) {
    // Immediately mark fade-in elements visible
    $$('.animate-fade-in').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    return;
  }

  const items = $$('.animate-fade-in');
  if (!items.length) return;

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  items.forEach(i => io.observe(i));
}

/* ========================
   Contact form handling
   - supports Netlify progressive enhancement
   - AJAX POST to action (or /api/contact)
   - client-side validation + autosave + cooldown
   ======================== */
function initContactForm() {
  const form = $('#contact-form');
  if (!form) return;

  const submitBtn = $('#contact-submit');
  const spinner = $('#submit-spinner');
  const feedback = $('#contact-feedback');
  const resetBtn = $('#contact-reset');

  // attempt to restore saved form data (autosave)
  try {
    const saved = localStorage.getItem('contact_form_draft');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.name) form.name.value = data.name;
      if (data.email) form.email.value = data.email;
      if (data.subject) form.subject.value = data.subject;
      if (data.message) form.message.value = data.message;
    }
  } catch (e) {
    console.warn('Could not restore draft:', e);
  }

  // autosave on change (debounced)
  form.addEventListener('input', debounce(() => {
    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      subject: form.subject.value.trim(),
      message: form.message.value.trim(),
      savedAt: new Date().toISOString()
    };
    try { localStorage.setItem('contact_form_draft', JSON.stringify(payload)); }
    catch (e) { /* ignore storage errors */ }
  }, 500));

  // quick helper to show/hide error nodes
  function showError(id, show, text) {
    const el = document.getElementById(id + '-error');
    if (!el) return;
    el.textContent = text || el.textContent;
    el.classList.toggle('hidden', !show);
  }

  // simple validation
  function validate() {
    let ok = true;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    if (!name) { showError('name', true, 'Please enter your name.'); ok = false; } else showError('name', false);
    if (!isValidEmail(email)) { showError('email', true, 'Please enter a valid email.'); ok = false; } else showError('email', false);
    if (!message) { showError('message', true, 'Please write a message.'); ok = false; } else showError('message', false);

    return ok;
  }

  // client-side cooldown check
  function isOnCooldown() {
    const last = localStorage.getItem('contact_last_sent_at');
    if (!last) return false;
    const diff = (Date.now() - Number(last)) / 1000;
    return diff < SUBMIT_COOLDOWN_SECONDS;
  }

  // handle form reset
  resetBtn?.addEventListener('click', () => {
    form.reset();
    showError('name', false); showError('email', false); showError('message', false);
    feedback.textContent = '';
    try { localStorage.removeItem('contact_form_draft'); } catch (e) {}
  });

  // submit handler
  form.addEventListener('submit', async (e) => {
    // allow native submit if JS disabled — but here JS is enabled so intercept
    e.preventDefault();
    feedback.textContent = '';
    if (!validate()) return;

    if (isOnCooldown()) {
      feedback.innerHTML = `<span class="text-error">Please wait a few seconds before sending another message.</span>`;
      return;
    }

    submitBtn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      subject: (form.subject && form.subject.value.trim()) || '(no subject)',
      message: form.message.value.trim(),
      sentAt: new Date().toISOString()
    };

    try {
      // prefer action attribute if present, else /api/contact
      const endpoint = form.getAttribute('action') || '/api/contact';
      const res = await timeoutFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 9000);

      if (res.ok) {
        feedback.innerHTML = '<span class="text-success">Thanks — your message has been sent. I will reply soon.</span>';
        form.reset();
        try { localStorage.removeItem('contact_form_draft'); }
        catch (e) {}
        localStorage.setItem('contact_last_sent_at', Date.now().toString());
      } else {
        // if the server returned an error (e.g., 404 on /api/contact), fallback to Netlify form (if present)
        const text = await res.text().catch(()=>null);
        console.warn('Form endpoint returned non-OK:', res.status, text);
        feedback.innerHTML = `<span class="text-muted">Form endpoint returned an error. As a fallback, please email <a href="mailto:contact@example.com" class="text-blue-600">contact@example.com</a>.</span>`;
      }
    } catch (err) {
      // network error or timeout -> fallback to mailto link or Netlify progressive fallback
      console.error('Error submitting contact form:', err);
      feedback.innerHTML = `<span class="text-muted">Could not submit. You can alternatively email <a href="mailto:contact@example.com?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.message)}" class="text-blue-600">contact@example.com</a>.</span>`;
    } finally {
      submitBtn.disabled = false;
      if (spinner) spinner.classList.add('hidden');
    }
  });
}

/* ========================
   Particle background
   - encapsulated in a class to allow stop/start
   - auto-adapts to device memory and DPR
   ======================== */
function initParticles() {
  if (prefersReducedMotion) {
    // Do not start heavy animation if user prefers reduced motion
    console.info('Reduced motion: particle background disabled.');
    return;
  }

  const canvas = document.getElementById('bg-canvas');
  if (!canvas || !canvas.getContext) return;

  class ParticleBG {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = {
        baseColor: '59,130,246',
        particleMin: 60,
        particleDensity: 0.00012,
        maxLineDistance: 120,
        maxParticleSize: 3.2,
        minParticleSize: 0.9,
        speedFactor: 0.35,
        mouseRepelRadius: 80,
        fpsThrottle: 60
      };
      this.particles = [];
      this.mouse = { x: null, y: null };
      this.lastFrame = 0;
      this._running = false;
      this.resize = this.resize.bind(this);
      this.animate = this.animate.bind(this);
      this.onMove = this.onMove.bind(this);
      this.onLeave = this.onLeave.bind(this);
      this.adjustForPerformance = this.adjustForPerformance.bind(this);
      this.computeCount();
      this.resize();
      this.adjustForPerformance();
      this.initParticles();
      window.addEventListener('resize', debounce(this.resize, 120));
      window.addEventListener('mousemove', this.onMove);
      window.addEventListener('mouseout', this.onLeave);
      window.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) this.onMove(e.touches[0]);
      }, { passive: true });
      window.addEventListener('touchend', this.onLeave, { passive: true });
    }

    computeCount() {
      const area = window.innerWidth * window.innerHeight;
      this.particleCount = Math.max(this.cfg.particleMin, Math.round(area * this.cfg.particleDensity));
      this.particleCount = Math.min(this.particleCount, 220);
    }

    resize() {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      this.dpr = dpr;
      this.canvas.width = Math.floor(window.innerWidth * dpr);
      this.canvas.height = Math.floor(window.innerHeight * dpr);
      this.canvas.style.width = window.innerWidth + 'px';
      this.canvas.style.height = window.innerHeight + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.computeCount();
      this.initParticles();
    }

    rand(min, max) { return Math.random() * (max - min) + min; }

    initParticles() {
      this.particles = [];
      for (let i = 0; i < this.particleCount; i++) {
        this.particles.push(this.makeParticle());
      }
    }

    makeParticle() {
      const p = {
        x: Math.random() * (this.canvas.width / (this.dpr || 1)),
        y: Math.random() * (this.canvas.height / (this.dpr || 1)),
        vx: (Math.random() - 0.5) * this.cfg.speedFactor * this.rand(0.5, 1.6),
        vy: (Math.random() - 0.5) * this.cfg.speedFactor * this.rand(0.5, 1.6),
        size: this.rand(this.cfg.minParticleSize, this.cfg.maxParticleSize),
        alpha: this.rand(0.35, 0.9)
      };
      return p;
    }

    updateParticle(p) {
      p.x += p.vx; p.y += p.vy;
      if (p.x > (this.canvas.width)) p.x = 0;
      if (p.x < 0) p.x = this.canvas.width;
      if (p.y > (this.canvas.height)) p.y = 0;
      if (p.y < 0) p.y = this.canvas.height;

      if (this.mouse.x !== null && this.mouse.y !== null) {
        const dx = p.x - this.mouse.x; const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.cfg.mouseRepelRadius && dist > 0) {
          const force = (this.cfg.mouseRepelRadius - dist) / this.cfg.mouseRepelRadius;
          p.vx += (dx / dist) * 0.6 * force;
          p.vy += (dy / dist) * 0.6 * force;
        }
      }
      p.vx *= 0.995; p.vy *= 0.995;
    }

    drawParticle(p) {
      this.ctx.beginPath();
      this.ctx.fillStyle = `rgba(${this.cfg.baseColor}, ${p.alpha})`;
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    connect() {
      const len = this.particles.length;
      for (let a = 0; a < len; a++) {
        const pa = this.particles[a];
        for (let b = a + 1; b < len; b++) {
          const pb = this.particles[b];
          const dx = pa.x - pb.x, dy = pa.y - pb.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < this.cfg.maxLineDistance) {
            const alpha = 1 - dist / this.cfg.maxLineDistance;
            this.ctx.beginPath();
            this.ctx.strokeStyle = `rgba(${this.cfg.baseColor}, ${alpha * 0.14})`;
            this.ctx.lineWidth = 1;
            this.ctx.moveTo(pa.x, pa.y);
            this.ctx.lineTo(pb.x, pb.y);
            this.ctx.stroke();
          }
        }
      }
    }

    animate(ts) {
      if (!this._running) return;
      requestAnimationFrame(this.animate);
      const elapsed = ts - this.lastFrame;
      const fpsInterval = 1000 / this.cfg.fpsThrottle;
      if (elapsed < fpsInterval) return;
      this.lastFrame = ts;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const g = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
      g.addColorStop(0, 'rgba(8,17,43,0.02)');
      g.addColorStop(1, 'rgba(8,17,43,0.02)');
      this.ctx.fillStyle = g;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      for (let p of this.particles) { this.updateParticle(p); this.drawParticle(p); }
      this.connect();
    }

    onMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left);
      this.mouse.y = (e.clientY - rect.top);
    }

    onLeave() { this.mouse.x = null; this.mouse.y = null; }

    adjustForPerformance() {
      const mem = navigator.deviceMemory || 4;
      if (mem <= 1) this.cfg.particleDensity = Math.max(this.cfg.particleDensity * 0.5, 0.00006);
      else if (mem <= 2) this.cfg.particleDensity *= 0.75;
      this.computeCount();
      this.initParticles();
    }

    start() {
      if (this._running) return;
      this._running = true;
      requestAnimationFrame(this.animate);
    }

    stop() {
      this._running = false;
    }
  }

  try {
    const bg = new ParticleBG(canvas);
    bg.start();
    // expose for debug if needed:
    window.__particleBG = bg;
  } catch (e) {
    console.error('Particle init failed', e);
  }
}

/* ========================
   Image enhancements
   - lazy loading (native + intersection fallback)
   - add loading="lazy" to images if not present
   ======================== */
function enhanceImages() {
  const imgs = $$('img');
  imgs.forEach(img => {
    if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
    // add decoding if available
    if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');

    // small progressive enhancement: add a fade-in when loaded
    img.style.transition = 'opacity .45s ease';
    if (img.complete) img.style.opacity = '1'; else img.style.opacity = '0.01';
    img.addEventListener('load', () => { img.style.opacity = '1'; });
  });
}

/* ========================
   Exported helpers (optional)
   ======================== */
window.portfolioUtils = {
  debounce,
  timeoutFetch,
  isValidEmail,
  applyTheme,        // allow external calls if needed
  initThemeToggle    // expose init so external scripts can re-init if DOM changes
};

/* End of scripts.js */
