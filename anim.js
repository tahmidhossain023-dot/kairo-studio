/* ============================================================
   anim.js — the animation layer for the studio site.
   Reads the data-animate hooks already in the markup, so the
   structure stays the single source of truth. Idempotent: safe to
   run again after a re-render (a MutationObserver re-wires new nodes).
   Every effect is gated on prefers-reduced-motion.
   ============================================================ */
(function () {
  if (window.__studioAnim) return;
  window.__studioAnim = true;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HIDE_ID = '__anim_prehide';

  /* ---- pre-hide: stop the flash of final state before GSAP lands ---- */
  function prehide() {
    if (REDUCED || document.hidden || document.getElementById(HIDE_ID)) return;
    var s = document.createElement('style');
    s.id = HIDE_ID;
    s.textContent =
      '[data-animate="fade-up"]:not([data-anim-wired]),' +
      '[data-animate="fade-down"]:not([data-anim-wired]),' +
      '[data-animate="fade-right"]:not([data-anim-wired]),' +
      '[data-animate="fade-in"]:not([data-anim-wired]),' +
      '[data-animate="scale-in"]:not([data-anim-wired]),' +
      '[data-animate="mask-up"]:not([data-anim-wired]),' +
      '[data-animate="counter"]:not([data-anim-wired])' +
      '{opacity:0}' +
      '[data-animate="clip-reveal"]:not([data-anim-wired])' +
      '{clip-path:inset(0 100% 0 0)}';
    document.head.appendChild(s);
    // Fail-safe: if GSAP never arrives, reveal everything.
    setTimeout(function () {
      if (!window.gsap) unhide();
    }, 3500);
  }
  function unhide() {
    var s = document.getElementById(HIDE_ID);
    if (s) s.remove();
  }

  /* ---- interaction styling that can only live in CSS ---- */
  function injectStyle() {
    if (document.getElementById('__anim_css')) return;
    var s = document.createElement('style');
    s.id = '__anim_css';
    s.textContent = [
      '@keyframes anim-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}',
      '@keyframes anim-pulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.12)}}',
      'nav a{position:relative}',
      'nav a::after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:2px;background:var(--color-accent);transform:scaleX(0);transform-origin:left;transition:transform .38s cubic-bezier(.22,1,.36,1)}',
      'nav a:hover{text-decoration:none}',
      'nav a:hover::after{transform:scaleX(1)}',
      'a[href]:not(nav a),button{transition:background-color .3s ease,color .3s ease,border-color .3s ease,transform .3s cubic-bezier(.22,1,.36,1)}',
      'a[href]:not(nav a):hover,button:hover{transform:translateY(-2px)}',
      'a[href]:not(nav a):active,button:active{transform:translateY(0)}',
      '.media-zoom{overflow:hidden}',
      '.media-zoom>*{transition:transform .7s cubic-bezier(.22,1,.36,1)}',
      'a:hover .media-zoom>*,li:hover .media-zoom>*{transform:scale(1.06)}',
      '.grayscale{filter:grayscale(1) contrast(1.04);transition:filter .5s ease}',
      'a:hover .grayscale,li:hover .grayscale{filter:grayscale(0) contrast(1.04)}',
      '#mobile-nav{overflow:hidden}',
      '.cursor-follower{position:fixed;top:0;left:0;width:34px;height:34px;margin:-17px 0 0 -17px;border:2px solid var(--color-accent);border-radius:50%;pointer-events:none;z-index:9999;opacity:0;mix-blend-mode:multiply;box-shadow:0 0 18px 4px color-mix(in srgb,var(--color-accent) 45%,transparent)}',
      '.cursor-dot{position:fixed;top:0;left:0;width:6px;height:6px;margin:-3px 0 0 -3px;background:var(--color-accent);border-radius:50%;pointer-events:none;z-index:9999;opacity:0}',
      '@media (hover:none){.cursor-follower,.cursor-dot{display:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---- effect definitions ---- */
  var FROM = {
    'fade-up': { opacity: 0, y: 44 },
    'fade-down': { opacity: 0, y: -22 },
    'fade-right': { opacity: 0, x: -44 },
    'fade-in': { opacity: 0 },
    'scale-in': { opacity: 0, scale: 0.86 },
    'mask-up': { opacity: 0, yPercent: 60, clipPath: 'inset(0 0 100% 0)' },
    'clip-reveal': { clipPath: 'inset(0 100% 0 0)' },
    'counter': { opacity: 0, y: 20 }
  };
  var EASE = 'power3.out';

  function baseTween(el, kind) {
    var from = FROM[kind];
    if (!from) return null;
    var to = { duration: kind === 'clip-reveal' ? 1.05 : 0.85, ease: EASE, overwrite: 'auto' };
    Object.keys(from).forEach(function (k) {
      to[k] = k === 'opacity' ? 1 : k === 'scale' ? 1 : k === 'clipPath' ? 'inset(0% 0% 0% 0%)' : 0;
    });
    if (kind === 'mask-up') to.clipPath = 'inset(0% 0% 0% 0%)';
    return { from: from, to: to };
  }

  /* digit scramble — animates without inventing real numbers */
  function scramble(el) {
    var final = el.textContent;
    if (!/\d/.test(final) || REDUCED) return;
    var ticks = 12, i = 0;
    var id = setInterval(function () {
      el.textContent = final.replace(/\d/g, function () {
        return String(Math.floor(Math.random() * 10));
      });
      if (++i >= ticks) { clearInterval(id); el.textContent = final; }
    }, 45);
  }

  function wire(root) {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    if (!gsap) return;
    root = root || document;

    /* --- load-in groups (hero, page openers): one timeline, no scroll --- */
    root.querySelectorAll('[data-anim-load-group]:not([data-anim-load-wired])').forEach(function (group) {
      group.setAttribute('data-anim-load-wired', '');
      var items = Array.prototype.slice.call(group.querySelectorAll('[data-animate]'));
      var tl = gsap.timeline({ delay: 0.12 });
      items.forEach(function (el, idx) {
        el.setAttribute('data-anim-wired', '');
        var kind = el.getAttribute('data-animate');
        if (kind === 'counter') scramble(el);
        var t = baseTween(el, kind);
        if (!t) return;
        if (REDUCED) { gsap.set(el, { opacity: 1, clearProps: 'transform,clipPath' }); return; }
        tl.fromTo(el, t.from, t.to, idx * 0.07);
      });
    });

    /* --- staggered groups --- */
    root.querySelectorAll('.stagger-group:not([data-anim-group-wired])').forEach(function (group) {
      if (group.closest('[data-anim-load-group]')) return;
      group.setAttribute('data-anim-group-wired', '');
      var items = Array.prototype.slice.call(group.children).filter(function (c) {
        return c.hasAttribute('data-animate') || c.classList.contains('stagger-item');
      }).map(function (c) {
        /* If the cell paints an opaque background over a divider field, the
           reveal target is an inner wrapper — never the cell itself. */
        return c.querySelector(':scope > [data-anim-inner]') || c;
      });
      if (!items.length) return;
      items.forEach(function (el) { el.setAttribute('data-anim-wired', ''); });
      var kind = items[0].getAttribute('data-animate') || 'fade-up';
      var t = baseTween(el0(items), kind) || baseTween(items[0], 'fade-up');
      if (REDUCED) { gsap.set(items, { opacity: 1, clearProps: 'transform,clipPath' }); return; }
      gsap.fromTo(items, t.from, Object.assign({}, t.to, {
        stagger: 0.085,
        scrollTrigger: ST ? { trigger: group, start: 'top 88%', once: true } : undefined
      }));
      items.forEach(function (el) {
        if (el.getAttribute('data-animate') === 'counter') {
          if (ST) ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: function () { scramble(el); } });
        }
      });
    });
    function el0(a) { return a[0]; }

    /* --- individual scroll reveals --- */
    root.querySelectorAll('[data-animate]:not([data-anim-wired])').forEach(function (el) {
      el.setAttribute('data-anim-wired', '');
      var kind = el.getAttribute('data-animate');
      var t = baseTween(el, kind);
      if (!t) return;
      if (REDUCED) { gsap.set(el, { opacity: 1, clearProps: 'transform,clipPath' }); return; }
      var delay = parseFloat(el.getAttribute('data-anim-delay') || 0);
      gsap.fromTo(el, t.from, Object.assign({}, t.to, {
        delay: delay,
        scrollTrigger: ST ? { trigger: el, start: 'top 90%', once: true } : undefined
      }));
      if (kind === 'counter' && ST) {
        ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: function () { scramble(el); } });
      }
    });

    /* --- marquee: duplicate the track, transform-only loop --- */
    root.querySelectorAll('[data-animate="marquee"]:not([data-anim-marquee])').forEach(function (track) {
      track.setAttribute('data-anim-marquee', '');
      track.style.flexWrap = 'nowrap';
      Array.prototype.slice.call(track.children).forEach(function (c) { c.style.flex = '0 0 auto'; });
      if (REDUCED) { track.parentElement.style.overflow = 'hidden'; return; }
      var gap = getComputedStyle(track).gap;
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;overflow:hidden;gap:' + gap;
      track.parentElement.insertBefore(wrap, track);
      wrap.appendChild(track);
      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('data-animate');
      clone.removeAttribute('data-anim-marquee');
      wrap.appendChild(clone);
      gsap.set([track, clone], { flex: '0 0 auto' });
      gsap.set(clone.children, { opacity: 1, clearProps: 'transform' });
      var loop = gsap.to([track, clone], {
        xPercent: -100, duration: 26, ease: 'none', repeat: -1,
        modifiers: { xPercent: function (v) { return (parseFloat(v) % 100) + '%'; } }
      });
      wrap.addEventListener('mouseenter', function () { loop.timeScale(0.2); });
      wrap.addEventListener('mouseleave', function () { loop.timeScale(1); });
    });

    /* --- scroll cue bob --- */
    root.querySelectorAll('[data-animate="bob"]:not([data-anim-bob])').forEach(function (el) {
      el.setAttribute('data-anim-bob', '');
      if (REDUCED) return;
      gsap.to(el, { y: 9, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    });

    /* --- scrubbed rule draw --- */
    root.querySelectorAll('[data-animate="scrub-draw"]:not([data-anim-draw])').forEach(function (el) {
      el.setAttribute('data-anim-draw', '');
      if (REDUCED || !ST) return;
      el.style.transformOrigin = 'left center';
      el.style.background = 'var(--color-accent)';
      gsap.fromTo(el, { scaleX: 0 }, {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top 75%', end: 'bottom 60%', scrub: 0.4 }
      });
    });

    /* --- reading progress rail --- */
    root.querySelectorAll('[data-animate="scrub-progress"]:not([data-anim-prog])').forEach(function (el) {
      el.setAttribute('data-anim-prog', '');
      if (!ST) return;
      gsap.fromTo(el, { width: '0%' }, {
        width: '100%', ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.2 }
      });
    });

    /* --- header shrink on scroll --- */
    root.querySelectorAll('[data-animate="header-pin"]:not([data-anim-header])').forEach(function (header) {
      header.setAttribute('data-anim-header', '');
      if (!ST || REDUCED) return;
      var bar = header.querySelector(':scope > div');
      ST.create({
        start: 'top -40', end: 99999,
        onUpdate: function (self) {
          var down = self.progress > 0 || window.scrollY > 40;
          gsap.to(bar, { minHeight: down ? 52 : 64, duration: 0.4, ease: 'power2.out' });
          gsap.to(header, { boxShadow: down ? 'var(--shadow-md)' : 'none', duration: 0.4 });
        }
      });
    });

    /* --- hero media parallax --- */
    root.querySelectorAll('[data-animate="clip-reveal"]:not([data-anim-par])').forEach(function (fig) {
      fig.setAttribute('data-anim-par', '');
      if (!ST || REDUCED) return;
      var media = fig.querySelector('div');
      if (!media) return;
      gsap.fromTo(media, { yPercent: -4 }, {
        yPercent: 4, ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    /* --- pinned horizontal gallery (wide screens only) --- */
    root.querySelectorAll('[data-animate="pin-horizontal"]:not([data-anim-pin])').forEach(function (section) {
      section.setAttribute('data-anim-pin', '');
      if (!ST || REDUCED || window.innerWidth < 900) return;
      var track = section.querySelector('.stagger-group');
      if (!track) return;
      track.style.display = 'flex';
      track.style.flexWrap = 'nowrap';
      Array.prototype.slice.call(track.children).forEach(function (c) {
        c.style.flex = '0 0 clamp(280px, 34vw, 460px)';
      });
      var overflow = function () { return track.scrollWidth - track.parentElement.clientWidth; };
      gsap.to(track, {
        x: function () { return -overflow(); }, ease: 'none',
        scrollTrigger: {
          trigger: section, start: 'top top', pin: true, scrub: 0.6, invalidateOnRefresh: true,
          end: function () { return '+=' + Math.max(overflow(), 1); }
        }
      });
    });

    /* --- mobile drawer --- */
    root.querySelectorAll('[data-animate="drawer-toggle"]:not([data-anim-drawer])').forEach(function (btn) {
      btn.setAttribute('data-anim-drawer', '');
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      gsap.set(panel, { height: 0, opacity: 0 });
      var links = panel.querySelectorAll('a');
      var open = false;
      btn.addEventListener('click', function () {
        open = !open;
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        if (REDUCED) { gsap.set(panel, { height: open ? 'auto' : 0, opacity: open ? 1 : 0 }); return; }
        gsap.to(panel, { height: open ? 'auto' : 0, opacity: open ? 1 : 0, duration: 0.45, ease: 'power3.inOut' });
        if (open) gsap.fromTo(links, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, stagger: 0.06, delay: 0.1, ease: EASE });
      });
    });

    /* --- glowing cursor follower --- */
    if (!REDUCED && !document.querySelector('.cursor-follower') && window.matchMedia('(hover:hover)').matches) {
      var ring = document.createElement('div');
      ring.className = 'cursor-follower';
      var dot = document.createElement('div');
      dot.className = 'cursor-dot';
      document.body.appendChild(ring);
      document.body.appendChild(dot);
      var rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
      var ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
      var dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
      var dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
      window.addEventListener('mousemove', function (e) {
        rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
        gsap.to([ring, dot], { opacity: 1, duration: 0.3, overwrite: 'auto' });
      });
      document.addEventListener('mouseleave', function () {
        gsap.to([ring, dot], { opacity: 0, duration: 0.3 });
      });
      document.addEventListener('mouseover', function (e) {
        var over = e.target.closest('a,button,input,textarea,select');
        gsap.to(ring, { scale: over ? 2.1 : 1, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      });
    }

    unhide();
    if (ST) ST.refresh();
  }

  prehide();
  injectStyle();

  function boot() {
    if (!window.gsap) { setTimeout(boot, 60); return; }
    if (window.ScrollTrigger && window.gsap.registerPlugin) window.gsap.registerPlugin(window.ScrollTrigger);

    function start() {
      window.gsap.ticker.wake();
      wire(document);
      var pending = null;
      new MutationObserver(function () {
        clearTimeout(pending);
        pending = setTimeout(function () { wire(document); }, 120);
      }).observe(document.body || document.documentElement, { childList: true, subtree: true });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
          window.gsap.ticker.wake();
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        }
      });
    }

    // A page opened in a background tab gets no animation frames: show it
    // as-is and wire the motion the moment it becomes visible.
    if (document.hidden) {
      unhide();
      document.addEventListener('visibilitychange', function onVis() {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', onVis);
        start();
      });
      return;
    }
    start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
