// =========================================================
// INFERREACH — main script
// =========================================================

(function () {
  'use strict';

  // ============ NAV TOGGLE ============
  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      const expanded = this.getAttribute('aria-expanded') === 'true' ? false : true;
      this.setAttribute('aria-expanded', expanded);
      mainNav.style.display = expanded ? 'flex' : '';
      if (expanded) {
        mainNav.style.flexDirection = 'column';
        mainNav.style.position = 'absolute';
        mainNav.style.top = '68px';
        mainNav.style.left = '0';
        mainNav.style.right = '0';
        mainNav.style.background = 'var(--bg-panel)';
        mainNav.style.padding = '20px 28px';
        mainNav.style.borderBottom = '1px solid var(--border-soft)';
        mainNav.style.gap = '16px';
        mainNav.style.alignItems = 'flex-start';
      } else {
        mainNav.style.display = '';
        mainNav.style.flexDirection = '';
        mainNav.style.position = '';
        mainNav.style.top = '';
        mainNav.style.left = '';
        mainNav.style.right = '';
        mainNav.style.background = '';
        mainNav.style.padding = '';
        mainNav.style.borderBottom = '';
        mainNav.style.gap = '';
        mainNav.style.alignItems = '';
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 720 && mainNav.style.display === 'flex') {
        mainNav.style.display = '';
        mainNav.style.flexDirection = '';
        mainNav.style.position = '';
        mainNav.style.top = '';
        mainNav.style.left = '';
        mainNav.style.right = '';
        mainNav.style.background = '';
        mainNav.style.padding = '';
        mainNav.style.borderBottom = '';
        mainNav.style.gap = '';
        mainNav.style.alignItems = '';
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ============ SCROLL REVEAL ============
  const revealElements = document.querySelectorAll('[data-reveal]');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -20px 0px' });

  revealElements.forEach(el => revealObserver.observe(el));

  // ============ STATS COUNTER ANIMATION ============
  const statNumbers = document.querySelectorAll('.stat-number');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.getAttribute('data-count'));
        const suffix = el.getAttribute('data-suffix') || '';
        const duration = 2000;
        const startTime = performance.now();

        function updateCounter(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = eased * target;
          let display;
          if (Number.isInteger(target)) {
            display = Math.floor(current);
          } else {
            display = current.toFixed(1);
          }
          el.textContent = display + suffix;
          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          } else {
            el.textContent = target + suffix;
          }
        }
        requestAnimationFrame(updateCounter);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  statNumbers.forEach(el => counterObserver.observe(el));

  // ============ FLOW CANVAS ============
  const canvas = document.getElementById('flow-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;
    const dpr = window.devicePixelRatio || 1;

    const nodes = [
      { id: 'source', label: 'Source', x: 0.15, y: 0.5 },
      { id: 'transform', label: 'Transform', x: 0.5, y: 0.5 },
      { id: 'sink', label: 'Sink', x: 0.85, y: 0.5 },
    ];

    let particles = [];
    const MAX_PARTICLES = 20;
    const PARTICLE_SPEED = 0.003;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(dpr, dpr);
    }

    function getNodePos(node) {
      return { x: node.x * width, y: node.y * height };
    }

    function drawNode(node, color = '#ffb454') {
      const pos = getNodePos(node);
      const radius = Math.min(width, height) * 0.045;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#212a31';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#8b96a3';
      ctx.font = `${Math.min(width, height) * 0.028}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(node.label, pos.x, pos.y - radius - 8);
    }

    function drawEdge(from, to, color = '#212a31') {
      const p1 = getNodePos(from);
      const p2 = getNodePos(to);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function drawParticles() {
      particles.forEach(p => {
        const pos = p.position;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#4fd1c5';
        ctx.shadowColor = '#4fd1c5';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const seg = Math.floor(Math.random() * 2);
        const t = Math.random();
        const from = seg === 0 ? nodes[0] : nodes[1];
        const to = seg === 0 ? nodes[1] : nodes[2];
        const p1 = getNodePos(from);
        const p2 = getNodePos(to);
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        particles.push({
          segment: seg,
          t: t,
          position: { x, y },
          speed: PARTICLE_SPEED * (0.8 + Math.random() * 0.4),
        });
      }
    }

    function updateParticles() {
      particles.forEach(p => {
        p.t += p.speed;
        if (p.t >= 1) {
          if (p.segment === 0) {
            p.segment = 1;
            p.t = 0;
          } else {
            p.segment = 0;
            p.t = 0;
          }
        }
        const from = p.segment === 0 ? nodes[0] : nodes[1];
        const to = p.segment === 0 ? nodes[1] : nodes[2];
        const p1 = getNodePos(from);
        const p2 = getNodePos(to);
        p.position.x = p1.x + (p2.x - p1.x) * p.t;
        p.position.y = p1.y + (p2.y - p1.y) * p.t;
      });
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      drawEdge(nodes[0], nodes[1]);
      drawEdge(nodes[1], nodes[2]);

      drawParticles();

      drawNode(nodes[0], '#ffb454');
      drawNode(nodes[1], '#b79cfa');
      drawNode(nodes[2], '#4fd1c5');

      ctx.fillStyle = '#576068';
      ctx.font = `${Math.min(width, height) * 0.025}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('source → transform → sink', 16, height - 12);
    }

    function animate() {
      updateParticles();
      draw();
      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
      resize();
      initParticles();
    });

    resize();
    initParticles();
    animate();
  }

  // ============ LIVE STATS ============
  const throughputEl = document.getElementById('stat-throughput');
  const latencyEl = document.getElementById('stat-latency');

  if (throughputEl && latencyEl) {
    setInterval(() => {
      const throughput = Math.floor(800 + Math.random() * 400);
      const latency = Math.floor(80 + Math.random() * 70);
      throughputEl.textContent = throughput;
      latencyEl.textContent = latency;
    }, 1000);
  }

})();