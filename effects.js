// Site-wide interactive animations (works on index, about, all-posts, and post pages)
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  // ---------- Scroll progress bar ----------
  const scrollProgress = document.getElementById('scroll-progress');
  if (scrollProgress) {
    function updateScrollProgress() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      scrollProgress.style.width = pct + '%';
    }
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress();
  }

  // ---------- Hero typing animation (index only) ----------
  const typeEls = document.querySelectorAll('.type-text');
  typeEls.forEach(el => {
    const text = el.dataset.text || '';
    if (prefersReducedMotion) {
      el.textContent = text;
      return;
    }
    el.textContent = '';
    let i = 0;
    function type() {
      if (i < text.length) {
        el.textContent += text.charAt(i);
        i++;
        setTimeout(type, 100);
      }
    }
    type();
  });

  // ---------- Hero constellation canvas (index only) ----------
  const canvas = document.getElementById('hero-canvas');
  if (canvas && !prefersReducedMotion && isFinePointer) {
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;
    let width, height;
    let particles = [];
    let mouse = { x: null, y: null };
    let rafId = null;
    const particleCount = 45;
    const connectionDistance = 110;
    const mouseDistance = 140;

    function resize() {
      const rect = hero.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      initParticles();
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 1.5 + 1
        });
      }
    }

    function hexToRgb(hex) {
      const clean = hex.replace('#', '');
      if (clean.length === 3) {
        return {
          r: parseInt(clean[0] + clean[0], 16),
          g: parseInt(clean[1] + clean[1], 16),
          b: parseInt(clean[2] + clean[2], 16)
        };
      }
      const bigint = parseInt(clean, 16);
      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
      };
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#006cac';
      const rgb = hexToRgb(accent);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        if (mouse.x !== null && mouse.y !== null) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouseDistance) {
            const force = (mouseDistance - dist) / mouseDistance;
            p.x += dx * force * 0.02;
            p.y += dy * force * 0.02;
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDistance) {
            const alpha = 1 - dist / connectionDistance;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.35})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      rafId = requestAnimationFrame(draw);
    }

    hero.addEventListener('mousemove', e => {
      const rect = hero.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    hero.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

    window.addEventListener('resize', resize);
    resize();
    draw();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else {
        draw();
      }
    });
  }

  // ---------- Back to top button with progress ring ----------
  function initBackToTop() {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.setAttribute('title', 'Back to top');
    btn.innerHTML = `
      <svg class="progress-ring" viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r="25"/>
      </svg>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    `;
    document.body.appendChild(btn);

    const circle = btn.querySelector('.progress-ring circle');
    const circumference = 2 * Math.PI * 25;
    circle.style.strokeDasharray = String(circumference);

    function update() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = docHeight > 0 ? scrollTop / docHeight : 0;
      circle.style.strokeDashoffset = String(circumference * (1 - pct));
      btn.classList.toggle('visible', scrollTop > 400);
    }

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ---------- Magnetic hover effect on buttons / logo ----------
  function initMagnetic() {
    if (prefersReducedMotion) return;
    const buttons = document.querySelectorAll('.icon-btn, .socials a, .logo');
    buttons.forEach(btn => {
      btn.classList.add('magnetic');
      btn.addEventListener('mousemove', e => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  // ---------- 3D tilt on post cards (delegated so it survives dynamic re-renders) ----------
  function initTiltCards() {
    if (prefersReducedMotion) return;
    document.querySelectorAll('.posts').forEach(list => {
      if (list.dataset.tiltBound) return;
      list.dataset.tiltBound = 'true';
      list.classList.add('tilt-card');

      list.addEventListener('mousemove', e => {
        const card = e.target.closest('li');
        if (!card || card.closest('.posts') !== list) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotateX = ((y - cy) / cy) * -5;
        const rotateY = ((x - cx) / cx) * 5;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      });

      list.addEventListener('mouseout', e => {
        const card = e.target.closest('li');
        if (!card) return;
        const related = e.relatedTarget;
        if (!related || !card.contains(related)) {
          card.style.transform = '';
        }
      });
    });
  }

  // ---------- Animated horizontal rules ----------
  function initAnimatedHrs() {
    if (prefersReducedMotion) return;
    const hrs = document.querySelectorAll('hr');
    hrs.forEach(hr => hr.classList.add('animated-hr'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    hrs.forEach(hr => observer.observe(hr));
  }

  // ---------- Cursor glow ----------
  function initCursorGlow() {
    if (prefersReducedMotion || !isFinePointer) return;
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);

    let raf = null;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;

    document.addEventListener('mousemove', e => {
      targetX = e.clientX;
      targetY = e.clientY;
      glow.classList.add('active');
      if (!raf) raf = requestAnimationFrame(animate);
    });

    document.addEventListener('mouseleave', () => {
      glow.classList.remove('active');
    });

    function animate() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      glow.style.left = currentX + 'px';
      glow.style.top = currentY + 'px';
      raf = requestAnimationFrame(animate);
    }
  }

  // ---------- Scroll reveal ----------
  function initReveals() {
    const revealEls = document.querySelectorAll('[data-reveal]');
    const revealChildren = document.querySelectorAll('[data-reveal-children]');

    revealEls.forEach(el => el.classList.add('reveal'));
    revealChildren.forEach(el => {
      el.classList.add('reveal-children');
      if (el.dataset.stagger !== undefined) el.classList.add('stagger');
    });

    if (prefersReducedMotion) {
      revealEls.forEach(el => el.classList.add('visible'));
      revealChildren.forEach(el => el.classList.add('visible'));
      initTiltCards();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealEls.forEach(el => observer.observe(el));
    revealChildren.forEach(el => observer.observe(el));

    initTiltCards();
  }

  // ---------- Orchestrate ----------
  function init() {
    initBackToTop();
    initMagnetic();
    initAnimatedHrs();
    initCursorGlow();
    initReveals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
