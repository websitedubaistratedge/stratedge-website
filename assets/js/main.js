/* =========================================================================
   STRATEDGE CONSULTANCY — Interaction Engine v2 (vanilla, no dependencies)
   One scroll listener, one rAF, transform/opacity only.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     CONFIGURATION
     Paste your GA4 Measurement ID below to switch analytics on
     site-wide. Left empty, no analytics script is loaded at all and
     no cookies are set.
  --------------------------------------------------------------- */
  var GA4_ID = '';            // e.g. 'G-XXXXXXXXXX'

  function analytics() {
    if (!GA4_ID) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA4_ID, { anonymize_ip: true });
  }

  var RM   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var isDesk = function () { return window.innerWidth > 900; };

  /* ---------------------------------------------------------------
     0. SHARED SCROLL / RESIZE SCHEDULER
     Every scroll-linked feature registers here, so the page has one
     listener and one rAF no matter how many effects are running.
  --------------------------------------------------------------- */
  var scrollJobs = [], resizeJobs = [], ticking = false;
  function onScroll(fn) { scrollJobs.push(fn); }
  function onResize(fn) { resizeJobs.push(fn); }
  function runScroll() {
    for (var i = 0; i < scrollJobs.length; i++) scrollJobs[i]();
    ticking = false;
  }
  function requestScroll() { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }
  window.addEventListener('scroll', requestScroll, { passive: true });
  var rzT = null;
  window.addEventListener('resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () {
      for (var i = 0; i < resizeJobs.length; i++) resizeJobs[i]();
      runScroll();
    }, 140);
  }, { passive: true });

  /* ---------------------------------------------------------------
     1. PRELOADER
  --------------------------------------------------------------- */
  function preloader() {
    var pl = $('.preload');
    if (!pl) { document.body.classList.remove('is-loading'); return; }
    /* Only on the first arrival of a session. A view transition captures the
       incoming page's first frame, so a preloader running on every internal
       navigation would mean every navigation morphs into a loading screen. */
    var seen = false;
    try { seen = sessionStorage.getItem('sx.seen') === '1'; sessionStorage.setItem('sx.seen', '1'); } catch (e) {}
    if (seen) {
      pl.remove();
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
      return;
    }
    var bar = $('.preload__bar i', pl), p = 0, done = false;
    var tick = setInterval(function () {
      p = Math.min(p + Math.random() * 16 + 6, 92);
      if (bar) bar.style.width = p + '%';
    }, 130);
    function finish() {
      if (done) return; done = true;
      clearInterval(tick);
      if (bar) bar.style.width = '100%';
      setTimeout(function () {
        pl.classList.add('is-done');
        document.body.classList.remove('is-loading');
        document.body.classList.add('is-ready');
        runScroll();
      }, 340);
    }
    if (document.readyState === 'complete') setTimeout(finish, 520);
    else window.addEventListener('load', function () { setTimeout(finish, 450); });
    setTimeout(finish, 4000);
  }

  /* ---------------------------------------------------------------
     2. SPLIT TEXT
  --------------------------------------------------------------- */
  function splitText(el) {
    if (el.dataset.split === 'done') return;

    /* Word-aware split that survives inline markup. A heading may contain a
       <span class="triA">A</span>, and that letter belongs INSIDE its word —
       splitting it out would break the word into separately animating boxes
       and lose the kerning across the seam. So collect a flat token stream
       first, then rebuild whole words that can hold both text and elements. */
    var words = [], cur = null;
    function open() { if (!cur) { cur = []; words.push(cur); } return cur; }
    function close() { cur = null; }
    (function collect(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { close(); words.push(' '); return; }
            open().push(document.createTextNode(w));
          });
        } else if (n.nodeType === 1) {
          if (n.classList.contains('triA')) open().push(n.cloneNode(true));
          else collect(n);
        }
      });
    })(el);

    var frag = document.createDocumentFragment();
    words.forEach(function (w) {
      if (w === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
      var m = document.createElement('span'); m.className = 'wm';
      var d = document.createElement('span'); d.className = 'wd';
      w.forEach(function (part) { d.appendChild(part); });
      m.appendChild(d); frag.appendChild(m);
    });
    el.textContent = '';
    el.appendChild(frag);

    lineStagger(el);
    el.dataset.split = 'done';
  }

  /*
    Stagger by LINE, not by word.

    Word-by-word is the tell of a template — it reads as an effect applied to
    text rather than as typesetting. Grouping the words by the line they
    actually landed on and giving a whole line one delay makes each line wipe up
    as a unit, which is the quieter, more editorial version of the same idea.
    Every word is still clipped by its own .wm, so the masks stay tight to the
    letterforms instead of leaving a slab-shaped gap.

    Line membership depends on where the text wrapped, so it is recomputed when
    the width changes — and only when the width changes, since a mobile URL bar
    collapsing changes the height on every scroll.
  */
  function lineStagger(el) {
    var words = $$('.wd', el), line = -1, top = null;
    words.forEach(function (w) {
      var t = Math.round(w.offsetTop / 4);   /* tolerate sub-pixel drift */
      if (t !== top) { top = t; line++; }
      w.style.setProperty('--wd', (line * 0.085).toFixed(3) + 's');
    });
  }

  function restagger() {
    $$('[data-split="done"]').forEach(lineStagger);
  }


  /* ---------------------------------------------------------------
     3. REVEALS
  --------------------------------------------------------------- */
  function reveals() {
    var items = $$('[data-reveal], .split, .eyebrow, .chart, .steps-mini');
    $$('.split').forEach(splitText);

    if (RM || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    $$('[data-stagger]').forEach(function (par) {
      var step = parseFloat(par.dataset.stagger) || 0.07;
      $$(':scope > *', par).forEach(function (ch, i) {
        ch.style.setProperty('--d', (i * step).toFixed(3) + 's');
      });
    });
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });

    /* safety net if IntersectionObserver never reports */
    setTimeout(function () {
      var vh = window.innerHeight;
      items.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.95 && r.bottom > -40) el.classList.add('is-in');
      });
    }, 1500);
  }

  /* ---------------------------------------------------------------
     4. NAVIGATION
  --------------------------------------------------------------- */
  function navigation() {
    var nav = $('.nav'), bar = $('.progress i'), burger = $('.burger');
    var wa = $('.wa'), mbar = $('.mbar');
    var last = window.scrollY;

    onScroll(function () {
      var y = window.scrollY;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? clamp(y / h, 0, 1) : 0) + ')';
      if (nav) {
        nav.classList.toggle('is-stuck', y > 20);
        if (!document.body.classList.contains('menu-open')) {
          nav.classList.toggle('is-hidden', y > last && y > 420);
        }
      }
      if (wa) wa.classList.toggle('on', y > 520);
      if (mbar) mbar.classList.toggle('on', y > 240);
      last = y;
    });

    if (bar) { bar.style.width = '100%'; bar.style.transformOrigin = 'left'; bar.style.transform = 'scaleX(0)'; }

    if (burger) {
      $$('.menu__item a').forEach(function (a, i) {
        a.style.transitionDelay = (0.16 + i * 0.06).toFixed(2) + 's';
      });
      burger.addEventListener('click', function () {
        var open = document.body.classList.toggle('menu-open');
        document.body.classList.toggle('is-locked', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (nav) nav.classList.remove('is-hidden');
      });
      $$('.menu a').forEach(function (a) {
        a.addEventListener('click', function () {
          document.body.classList.remove('menu-open', 'is-locked');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
          document.body.classList.remove('menu-open', 'is-locked');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        window.scrollTo({
          top: t.getBoundingClientRect().top + window.scrollY - (isDesk() ? 86 : 78),
          behavior: RM ? 'auto' : 'smooth'
        });
      });
    });
  }

  /* ---------------------------------------------------------------
     5. CURSOR + MAGNETIC
  --------------------------------------------------------------- */
  function cursor() {
    if (!FINE || RM) return;
    var ring = $('.cursor'), dot = $('.cursor-dot');
    if (!ring || !dot) return;
    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, raf = null;

    function loop() {
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      ring.style.transform = 'translate3d(' + (rx - 16) + 'px,' + (ry - 16) + 'px,0)';
      if (Math.abs(mx - rx) < 0.35 && Math.abs(my - ry) < 0.35) { raf = null; return; }
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate3d(' + (mx - 2) + 'px,' + (my - 2) + 'px,0)';
      if (!document.body.classList.contains('cursor-ready')) document.body.classList.add('cursor-ready');
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    var HOVER = 'a,button,input,textarea,select,.card,.ex-item,.sector,.acc__h,.value,.phase';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(HOVER)) document.body.classList.add('cursor-hover');
    }, { passive: true });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(HOVER)) document.body.classList.remove('cursor-hover');
    }, { passive: true });

    $$('[data-magnetic], .btn--lg').forEach(function (el) {
      var str = parseFloat(el.dataset.magnetic) || 0.22, r = null, pending = false, tx = 0, ty = 0;
      el.addEventListener('mouseenter', function () { r = el.getBoundingClientRect(); });
      el.addEventListener('mousemove', function (e) {
        if (!r) r = el.getBoundingClientRect();
        tx = (e.clientX - r.left - r.width / 2) * str;
        ty = (e.clientY - r.top - r.height / 2) * str;
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          el.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)';
          pending = false;
        });
      }, { passive: true });
      el.addEventListener('mouseleave', function () { r = null; el.style.transform = ''; });
    });
  }

  /* ---------------------------------------------------------------
     6. POINTER-REACTIVE CARDS
  --------------------------------------------------------------- */
  function cards() {
    if (!FINE || RM) return;
    $$('.card').forEach(function (c) {
      var tilt = c.classList.contains('card--tilt');
      var r = null, pending = false, x = 0, y = 0;
      c.addEventListener('mouseenter', function () { r = c.getBoundingClientRect(); });
      c.addEventListener('mousemove', function (e) {
        if (!r) r = c.getBoundingClientRect();
        x = e.clientX - r.left; y = e.clientY - r.top;
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          c.style.setProperty('--mx', x + 'px');
          c.style.setProperty('--my', y + 'px');
          if (tilt) {
            c.style.setProperty('--ry', ((x / r.width - 0.5) * 6).toFixed(2) + 'deg');
            c.style.setProperty('--rx', ((0.5 - y / r.height) * 6).toFixed(2) + 'deg');
            c.style.setProperty('--ty', '-5px');
          }
          pending = false;
        });
      }, { passive: true });
      c.addEventListener('mouseleave', function () {
        r = null;
        if (!tilt) return;
        c.style.setProperty('--ry', '0deg'); c.style.setProperty('--rx', '0deg');
        c.style.setProperty('--ty', '0px');
      });
    });
  }

  /* ---------------------------------------------------------------
     7. COUNTERS
  --------------------------------------------------------------- */
  function counters() {
    var els = $$('[data-count]');
    if (!els.length) return;
    if (RM || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.textContent = el.dataset.count; });
      return;
    }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, target = parseFloat(el.dataset.count), pad = el.dataset.pad === 'true';
        var t0 = performance.now(), dur = 1300;
        (function run(now) {
          var p = clamp((now - t0) / dur, 0, 1);
          var v = Math.round(target * (1 - Math.pow(1 - p, 4)));
          el.textContent = pad && v < 10 ? '0' + v : String(v);
          if (p < 1) requestAnimationFrame(run);
        })(t0);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------
     8. SCROLL-LINKED: word fade + parallax
  --------------------------------------------------------------- */
  function scrollFX() {
    var fades = $$('.wordfade');
    fades.forEach(function (el) {
      if (el.dataset.split === 'done') return;
      var words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      words.forEach(function (w) {
        var s = document.createElement('span');
        s.className = 'wd'; s.textContent = w;
        el.appendChild(s); el.appendChild(document.createTextNode(' '));
      });
      el.dataset.split = 'done';
    });
    var pars = $$('[data-par]');
    if (RM) {
      fades.forEach(function (el) { $$('.wd', el).forEach(function (w) { w.classList.add('on'); }); });
      return;
    }
    onScroll(function () {
      var vh = window.innerHeight, i, r, jobs = [];
      for (i = 0; i < fades.length; i++) {
        r = fades[i].getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) continue;
        jobs.push({ t: 'f', el: fades[i], p: clamp((vh * 0.84 - r.top) / (r.height + vh * 0.3), 0, 1) });
      }
      for (i = 0; i < pars.length; i++) {
        r = pars[i].getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        jobs.push({ t: 'p', el: pars[i],
          v: (r.top + r.height / 2 - vh / 2) * -(parseFloat(pars[i].dataset.par) || 0.08) });
      }
      for (i = 0; i < jobs.length; i++) {
        var j = jobs[i];
        if (j.t === 'f') {
          var ws = j.el._w || (j.el._w = $$('.wd', j.el));
          var n = Math.round(j.p * ws.length * 1.16);
          for (var k = 0; k < ws.length; k++) {
            var on = k < n;
            if (ws[k]._on !== on) { ws[k].classList.toggle('on', on); ws[k]._on = on; }
          }
        } else {
          j.el.style.transform = 'translate3d(0,' + j.v.toFixed(1) + 'px,0)';
        }
      }
    });
  }

  /* ---------------------------------------------------------------
     9. SERVICE EXPLORER
  --------------------------------------------------------------- */
  function explorer() {
    var root = $('.explorer');
    if (!root) return;
    var items = $$('.ex-item', root), panes = $$('.ex-pane', root);
    if (!items.length) return;
    var current = 0, auto = null, touched = false;

    var panel = $('.ex-panel', root);
    function show(i, scrollTo) {
      if (i === current) {
        if (scrollTo) revealPanel();
        return;
      }
      items[current].classList.remove('is-on');
      items[current].setAttribute('aria-selected', 'false');
      panes[current].classList.remove('is-on');
      current = i;
      items[i].classList.add('is-on');
      items[i].setAttribute('aria-selected', 'true');
      panes[i].classList.add('is-on');
      panes[i].classList.add('is-in');            /* replay the chart draw */
      if (scrollTo) revealPanel();
    }
    /* on small screens the detail sits below the list, so bring it into view */
    function revealPanel() {
      if (isDesk() || !panel) return;
      var top = panel.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: top, behavior: RM ? 'auto' : 'smooth' });
    }
    function stopAuto() { if (auto) { clearInterval(auto); auto = null; } touched = true; }

    items.forEach(function (it, i) {
      it.addEventListener('click', function () { stopAuto(); show(i, true); });
      it.addEventListener('mouseenter', function () { if (FINE) { stopAuto(); show(i); } });
      it.addEventListener('focus', function () { stopAuto(); show(i); });
      it.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault(); stopAuto(); items[(i + 1) % items.length].focus();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault(); stopAuto(); items[(i - 1 + items.length) % items.length].focus();
        }
      });
    });

    /* gentle auto-advance until the visitor takes over */
    if (!RM && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting && !touched && !auto) {
          auto = setInterval(function () { show((current + 1) % items.length); }, 5200);
        } else if (!en[0].isIntersecting && auto && !touched) {
          clearInterval(auto); auto = null;
        }
      }, { threshold: 0.35 }).observe(root);
    }
  }

  /* ---------------------------------------------------------------
     10. PINNED HORIZONTAL SECTION
  --------------------------------------------------------------- */
  function rail() {
    $$('.pin').forEach(function (pin) {
      var vp = $('.pin__vp', pin), track = $('.pin__track', pin), pg = $('.pin__pg b', pin);
      var prev = $('[data-rail="prev"]', pin), next = $('[data-rail="next"]', pin);
      if (!vp || !track) return;

      function step() {
        var card = $('.phase', track);
        return card ? card.offsetWidth + 18 : vp.clientWidth * 0.8;
      }
      function update() {
        var max = vp.scrollWidth - vp.clientWidth;
        if (pg) pg.style.setProperty('--p', (max > 0 ? vp.scrollLeft / max : 0).toFixed(3));
        if (prev) prev.disabled = vp.scrollLeft <= 2;
        if (next) next.disabled = vp.scrollLeft >= max - 2;
      }
      function go(dir) {
        vp.scrollBy({ left: dir * step(), behavior: RM ? 'auto' : 'smooth' });
      }
      if (prev) prev.addEventListener('click', function () { go(-1); });
      if (next) next.addEventListener('click', function () { go(1); });
      vp.addEventListener('scroll', update, { passive: true });
      onResize(update);
      update();

      /* drag to pan on desktop — trackpads already scroll horizontally */
      if (!FINE || RM) return;
      var down = false, startX = 0, startLeft = 0, moved = 0;
      vp.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse') return;
        down = true; moved = 0;
        startX = e.clientX; startLeft = vp.scrollLeft;
        vp.classList.add('is-dragging');
      });
      window.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - startX;
        moved = Math.max(moved, Math.abs(dx));
        vp.scrollLeft = startLeft - dx;
      });
      window.addEventListener('pointerup', function () {
        if (!down) return;
        down = false;
        vp.classList.remove('is-dragging');
      });
      /* a drag should not fire the link underneath it */
      vp.addEventListener('click', function (e) {
        if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
      }, true);
    });
  }

  /* ---------------------------------------------------------------
     11. HERO MESH CANVAS
  --------------------------------------------------------------- */
  function heroCanvas() {
    var cv = $('.hero__canvas');
    if (!cv || RM) return;
    var ctx = cv.getContext('2d');
    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var pts = [], mouse = { x: -9999, y: -9999 }, raf = null, last = 0;
    var FRAME = 1000 / 40, B = 4;

    function build() {
      var r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      if (!w || !h) return;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = clamp(Math.round((w * h) / (w < 760 ? 40000 : 26000)), 10, 40);
      pts = [];
      for (var i = 0; i < n; i++) pts.push({
        x: Math.random() * w, y: Math.random() * h, dx: 0, dy: 0,
        vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.16,
        r: Math.random() < 0.16 ? 2 : 1.2, red: Math.random() < 0.16
      });
    }
    function draw(now) {
      raf = requestAnimationFrame(draw);
      if (now - last < FRAME) return;
      last = now;
      ctx.clearRect(0, 0, w, h);
      var LINK = w < 760 ? 124 : 160, i, j, p;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -30) p.x = w + 30; else if (p.x > w + 30) p.x = -30;
        if (p.y < -30) p.y = h + 30; else if (p.y > h + 30) p.y = -30;
        var ax = p.x - mouse.x, ay = p.y - mouse.y, d2 = ax * ax + ay * ay;
        if (d2 < 22500) {
          var dm = Math.sqrt(d2) || 1, f = (1 - dm / 150) * 22;
          p.dx = p.x + (ax / dm) * f; p.dy = p.y + (ay / dm) * f;
        } else { p.dx = p.x; p.dy = p.y; }
      }
      var ink = [], red = [], b;
      for (b = 0; b < B; b++) { ink.push(new Path2D()); red.push(new Path2D()); }
      for (i = 0; i < pts.length; i++) for (j = i + 1; j < pts.length; j++) {
        var dx = pts[i].dx - pts[j].dx, dy = pts[i].dy - pts[j].dy, dd = dx * dx + dy * dy;
        if (dd > LINK * LINK) continue;
        var t = 1 - Math.sqrt(dd) / LINK;
        b = Math.min(B - 1, (t * B) | 0);
        var pa = (pts[i].red || pts[j].red) ? red[b] : ink[b];
        pa.moveTo(pts[i].dx, pts[i].dy); pa.lineTo(pts[j].dx, pts[j].dy);
      }
      ctx.lineWidth = 1;
      for (b = 0; b < B; b++) {
        var al = ((b + 0.5) / B) * 0.3;
        ctx.strokeStyle = 'rgba(10,12,15,' + (al * 0.5).toFixed(3) + ')'; ctx.stroke(ink[b]);
        ctx.strokeStyle = 'rgba(209,58,69,' + (al * 0.85).toFixed(3) + ')'; ctx.stroke(red[b]);
      }
      var di = new Path2D(), dr = new Path2D();
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        var tg = p.red ? dr : di;
        tg.moveTo(p.dx + p.r, p.dy); tg.arc(p.dx, p.dy, p.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(10,12,15,.28)'; ctx.fill(di);
      ctx.fillStyle = 'rgba(209,58,69,.7)'; ctx.fill(dr);
    }
    function start() { if (!raf) raf = requestAnimationFrame(draw); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    build(); start(); onResize(build);
    if (FINE) {
      window.addEventListener('mousemove', function (e) {
        var r = cv.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      }, { passive: true });
      window.addEventListener('mouseout', function () { mouse.x = -9999; mouse.y = -9999; });
    }
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); },
        { threshold: 0 }).observe(cv);
    }
  }

  /* ---------------------------------------------------------------
     12. PAUSE OFF-SCREEN ANIMATION
  --------------------------------------------------------------- */
  function pauseOffscreen() {
    if (!('IntersectionObserver' in window)) return;
    var els = $$('.ticker__track,.art .dash,.art .pulse,.art .slow,.art .slow-rev,.glow--float');
    if (!els.length) return;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        e.target.style.animationPlayState = e.isIntersecting ? 'running' : 'paused';
      });
    }, { rootMargin: '120px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------
     13. ACCORDION
  --------------------------------------------------------------- */
  function accordion() {
    $$('.acc').forEach(function (acc) {
      var items = $$('.acc__i', acc);
      items.forEach(function (it) {
        var head = $('.acc__h', it), body = $('.acc__c', it);
        if (!head || !body) return;
        head.addEventListener('click', function () {
          var open = it.classList.contains('on');
          items.forEach(function (o) {
            o.classList.remove('on');
            var b = $('.acc__c', o); if (b) b.style.height = '0px';
            var hh = $('.acc__h', o); if (hh) hh.setAttribute('aria-expanded', 'false');
          });
          if (!open) {
            it.classList.add('on');
            body.style.height = body.scrollHeight + 'px';
            head.setAttribute('aria-expanded', 'true');
          }
        });
      });
    });
    onResize(function () {
      $$('.acc__i.on .acc__c').forEach(function (b) { b.style.height = b.scrollHeight + 'px'; });
    });
  }

  /* ---------------------------------------------------------------
     14. SCROLLSPY
  --------------------------------------------------------------- */
  function scrollspy() {
    var links = $$('.snav a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) {
      var t = document.querySelector(a.getAttribute('href'));
      if (t) map[t.id] = a;
    });
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('on'); });
        if (map[e.target.id]) map[e.target.id].classList.add('on');
      });
    }, { rootMargin: '-20% 0px -62% 0px' });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* ---------------------------------------------------------------
     15. FORMS
  --------------------------------------------------------------- */
  function forms() {
    $$('form[data-validate]').forEach(function (form) {
      var ok = $('.form-ok', form.parentNode) || $('.form-ok', form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var valid = true;
        $$('[required]', form).forEach(function (f) {
          var wrap = f.closest('.field') || f.closest('.consent');
          var v = (f.type === 'checkbox') ? f.checked : f.value.trim() !== '';
          if (v && f.type === 'email') v = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.value.trim());
          if (v && f.dataset.min) v = f.value.trim().length >= parseInt(f.dataset.min, 10);
          if (wrap) wrap.classList.toggle('err', !v);
          if (!v && valid) { f.focus(); valid = false; }
          if (!v) valid = false;
        });
        if (!valid) return;

        var btn = $('button[type="submit"]', form), label = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = 'Sending…'; }
        var data = {};
        $$('input,textarea,select', form).forEach(function (f) {
          if (f.type === 'checkbox' || !f.name) return;
          data[f.name] = f.value.trim();
        });
        function done() {
          if (btn) { btn.disabled = false; btn.innerHTML = label; }
          form.reset();
          if (ok) { ok.classList.add('on'); ok.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); }
        }
        var endpoint = form.dataset.endpoint;
        if (endpoint) {
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).then(done).catch(done);
        } else {
          var to = form.dataset.mailto || 'sayed.dahdah@stratededgeconcultancy.com';
          var body = [
            'Name: ' + (data.name || '-'), 'Company: ' + (data.company || '-'),
            'Email: ' + (data.email || '-'), 'Phone: ' + (data.phone || '-'),
            'Area of interest: ' + (data.service || '-'), '', 'Message:', (data.message || '-')
          ].join('\n');
          window.location.href = 'mailto:' + to +
            '?subject=' + encodeURIComponent('Website enquiry — ' + (data.name || 'New enquiry')) +
            '&body=' + encodeURIComponent(body);
          setTimeout(done, 600);
        }
      });
      $$('input,textarea,select', form).forEach(function (f) {
        f.addEventListener('input', function () {
          var wrap = f.closest('.field') || f.closest('.consent');
          if (wrap) wrap.classList.remove('err');
        });
      });
    });
  }

  /* ---------------------------------------------------------------
     16. CHROME
  --------------------------------------------------------------- */
  function chrome() {
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
    // Cloudflare serves /about where GitHub Pages served /about.html, so compare
    // page names with the extension stripped. Service subpages count as Services.
    function page(p) {
      p = (p || '').split('#')[0].split('?')[0];
      if (/(^|\/)services\/[^/]+\/(index(\.html)?)?$/.test(p)) return 'services';
      p = p.split('/').pop().replace(/\.html$/, '').toLowerCase();
      return p === '' ? 'index' : p;
    }
    var here = page(location.pathname);
    $$('.nav__link, .menu__item a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('#')[0];
      if (!href || /\/$/.test(href)) return;   // links into a service subpage are never the current nav item
      if (page(href) === here) a.setAttribute('aria-current', 'page');
    });
  }

  /* ---------------------------------------------------------------
     VIEW TRANSITIONS
     Cross-document transitions are declared in CSS; all this does is decide,
     per navigation, WHICH element on each side is the same thing — the service
     card you clicked and the heading you land on — so the pair morphs instead
     of cross-fading. Names have to be unique per document, so they are applied
     for the one navigation and cleared again rather than sitting in the markup.
     --------------------------------------------------------------- */
  var VT_NAME = 'svc-title';

  function vtPath(u) {
    try { return new URL(u, location.href).pathname.replace(/index\.html$/, ''); }
    catch (e) { return ''; }
  }
  function vtClear() {
    $$('[data-vt]').forEach(function (el) {
      el.style.viewTransitionName = '';
      el.removeAttribute('data-vt');
    });
  }
  function vtMark(el) {
    if (!el) return;
    el.style.viewTransitionName = VT_NAME;
    el.setAttribute('data-vt', '');
  }
  /* `other` is the far side of the navigation — where we are going, or where we
     came from. On a service page the counterpart is its own H1; on a hub it is
     the card pointing at that service. */
  function vtCounterpart(other) {
    var here = vtPath(location.href), there = vtPath(other);
    if (!there || there === here) return null;
    if (/\/services\/[^/]+\/$/.test(here)) return $('.hero3 h1');
    if (!/\/services\/[^/]+\/$/.test(there)) return null;
    var hit = null;
    $$('a.bs').forEach(function (a) {
      if (vtPath(a.getAttribute('href')) === there) hit = a;
    });
    return hit && $('h3', hit);
  }

  function viewTransitions() {
    if (!('startViewTransition' in document)) return;
    window.addEventListener('pageswap', function (e) {
      if (!e.viewTransition || !e.activation || !e.activation.entry) return;
      vtClear();
      vtMark(vtCounterpart(e.activation.entry.url));
    });
    window.addEventListener('pagereveal', function (e) {
      if (!e.viewTransition) return;
      vtClear();
      var nav = window.navigation, from = nav && nav.activation && nav.activation.from;
      vtMark(vtCounterpart(from && from.url));
    });
  }
  /* registered immediately: pagereveal can fire before DOMContentLoaded */
  viewTransitions();

  function init() {
    var lastW = window.innerWidth;
    onResize(function () {
      if (window.innerWidth === lastW) return;   /* height-only change: ignore */
      lastW = window.innerWidth;
      restagger();
    });
    analytics();
    chrome(); preloader(); navigation(); reveals(); cursor(); cards();
    counters(); scrollFX(); explorer(); rail(); heroCanvas();
    pauseOffscreen(); accordion(); scrollspy(); forms();
    runScroll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
