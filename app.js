// ============================================================
// 1. PARTICLE NETWORK CANVAS (Data Pipeline Visualization)
// ============================================================
(function initCanvas() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let width, height, dpr;
    let nodes = [];
    let pulses = [];
    let mouseX = -9999;
    let mouseY = -9999;
    let animationId;

    class Node {
        constructor(x, y, isHub = false) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 0.25;
            this.vy = (Math.random() - 0.5) * 0.25;
            this.radius = isHub ? Math.random() * 2.5 + 2.5 : Math.random() * 1.5 + 1;
            this.isHub = isHub;
            this.baseRadius = this.radius;
            this.glowPhase = Math.random() * Math.PI * 2;
            this.glowSpeed = Math.random() * 0.02 + 0.01;
            this.hue = isHub ?
                Math.random() * 40 + 170 :
                Math.random() * 60 + 220;
            this.saturation = 85;
            this.lightness = 65;
        }

        update(bounds) {
            this.x += this.vx;
            this.y += this.vy;
            this.glowPhase += this.glowSpeed;

            const margin = 20;
            if (this.x < margin || this.x > bounds.width - margin) {
                this.vx *= -1;
                this.x = Math.max(margin, Math.min(bounds.width - margin, this.x));
            }
            if (this.y < margin || this.y > bounds.height - margin) {
                this.vy *= -1;
                this.y = Math.max(margin, Math.min(bounds.height - margin, this.y));
            }

            const dx = this.x - mouseX;
            const dy = this.y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const repelRadius = 120;
            if (dist < repelRadius && dist > 0.1) {
                const force = (repelRadius - dist) / repelRadius * 0.8;
                this.vx += (dx / dist) * force * 0.3;
                this.vy += (dy / dist) * force * 0.3;
                const maxV = 1.2;
                const v = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                if (v > maxV) {
                    this.vx = (this.vx / v) * maxV;
                    this.vy = (this.vy / v) * maxV;
                }
            } else {
                this.vx *= 0.998;
                this.vy *= 0.998;
            }

            const pulse = Math.sin(this.glowPhase) * 0.4 + 1;
            this.radius = this.baseRadius * pulse;
        }

        draw(ctx) {
            const glow = 0.5 + Math.sin(this.glowPhase) * 0.3;
            const alpha = this.isHub ? 0.9 * glow : 0.55 * glow;
            const r = this.radius;

            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 4);
            gradient.addColorStop(0,
                `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${alpha * 0.6})`);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle =
                `hsla(${this.hue}, ${this.saturation}%, ${Math.min(this.lightness + 15, 90)}%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    class Pulse {
        constructor(nodeA, nodeB) {
            this.nodeA = nodeA;
            this.nodeB = nodeB;
            this.t = Math.random();
            this.speed = Math.random() * 0.012 + 0.006;
            this.size = Math.random() * 2 + 1.2;
            this.hue = Math.random() * 40 + 170;
            this.active = true;
        }

        update() {
            this.t += this.speed;
            if (this.t >= 1) {
                this.active = false;
                if (Math.random() < 0.4) {
                    createPulseFromRandomConnection();
                }
            }
        }

        draw(ctx) {
            if (!this.active || !this.nodeA || !this.nodeB) return;
            const x = this.nodeA.x + (this.nodeB.x - this.nodeA.x) * this.t;
            const y = this.nodeA.y + (this.nodeB.y - this.nodeA.y) * this.t;

            const trailGrad = ctx.createRadialGradient(x, y, 0, x, y, this.size * 5);
            trailGrad.addColorStop(0, `hsla(${this.hue}, 100%, 80%, 0.7)`);
            trailGrad.addColorStop(0.4, `hsla(${this.hue}, 100%, 70%, 0.25)`);
            trailGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = trailGrad;
            ctx.beginPath();
            ctx.arc(x, y, this.size * 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `hsla(${this.hue}, 100%, 85%, 0.9)`;
            ctx.beginPath();
            ctx.arc(x, y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    let connections = [];

    function createPulseFromRandomConnection() {
        if (connections.length === 0) return;
        const conn = connections[Math.floor(Math.random() * connections.length)];
        const pulse = new Pulse(conn[0], conn[1]);
        pulses.push(pulse);
    }

    function resizeCanvas() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        initNodes();
    }

    function initNodes() {
        nodes = [];
        pulses = [];
        connections = [];
        const nodeCount = width < 768 ? 35 : 65;
        const hubCount = Math.max(3, Math.floor(nodeCount * 0.12));

        for (let i = 0; i < nodeCount; i++) {
            const isHub = i < hubCount;
            const x = Math.random() * width;
            const y = Math.random() * height;
            nodes.push(new Node(x, y, isHub));
        }

        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                if (connections.length > 0) {
                    createPulseFromRandomConnection();
                }
            }, i * 300);
        }
    }

    function findConnections() {
        connections = [];
        const maxDist = width < 768 ? 110 : 150;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < maxDist) {
                    connections.push([nodes[i], nodes[j], dist]);
                }
            }
        }
    }

    function drawConnections() {
        const maxDist = width < 768 ? 110 : 150;
        for (const conn of connections) {
            const [nodeA, nodeB, dist] = conn;
            const opacity = Math.max(0, 1 - dist / maxDist) * 0.4;
            const lineGrad = ctx.createLinearGradient(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
            lineGrad.addColorStop(0, `hsla(200, 90%, 65%, ${opacity})`);
            lineGrad.addColorStop(0.5, `hsla(260, 70%, 70%, ${opacity})`);
            lineGrad.addColorStop(1, `hsla(320, 80%, 65%, ${opacity})`);
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(nodeA.x, nodeA.y);
            ctx.lineTo(nodeB.x, nodeB.y);
            ctx.stroke();
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        for (const node of nodes) {
            node.update({ width, height });
        }

        if (Math.floor(Math.random() * 10) === 0) {
            findConnections();
        }

        drawConnections();

        for (const pulse of pulses) {
            pulse.update();
            pulse.draw(ctx);
        }
        pulses = pulses.filter(p => p.active);

        if (pulses.length > 25) {
            pulses = pulses.slice(-25);
        }

        for (const node of nodes) {
            node.draw(ctx);
        }

        if (Math.random() < 0.02 && connections.length > 0) {
            createPulseFromRandomConnection();
        }

        animationId = requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            mouseX = e.touches[0].clientX;
            mouseY = e.touches[0].clientY;
        }
    });
    window.addEventListener('mouseleave', () => {
        mouseX = -9999;
        mouseY = -9999;
    });
    window.addEventListener('touchend', () => {
        mouseX = -9999;
        mouseY = -9999;
    });

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            cancelAnimationFrame(animationId);
            resizeCanvas();
            animate();
        }, 200);
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(animationId);
        } else {
            cancelAnimationFrame(animationId);
            animate();
        }
    });

    resizeCanvas();
    animate();
})();

// ============================================================
// 2. TYPING ANIMATION
// ============================================================
(function initTyping() {
    const phrases = [
        'Data Engineering, Reimagined.',
        'Build Better Data Pipelines.',
        'Transform Raw Data into Insights.',
        'Scalable Data Infrastructure.',
        'Clean Data. Fast Decisions.',
        'Your Data, Engineered to Scale.',
    ];
    const typingElement = document.querySelector('.typing-text');
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeSpeed = 70;
    let deleteSpeed = 40;
    let pauseBetween = 2000;

    function typeLoop() {
        const currentPhrase = phrases[phraseIndex];

        if (!isDeleting) {
            charIndex++;
            typingElement.textContent = currentPhrase.substring(0, charIndex);
            if (charIndex === currentPhrase.length) {
                isDeleting = true;
                setTimeout(typeLoop, pauseBetween);
                return;
            }
            setTimeout(typeLoop, typeSpeed + Math.random() * 40);
        } else {
            charIndex--;
            typingElement.textContent = currentPhrase.substring(0, charIndex);
            if (charIndex === 0) {
                isDeleting = false;
                phraseIndex = (phraseIndex + 1) % phrases.length;
                setTimeout(typeLoop, 400);
                return;
            }
            setTimeout(typeLoop, deleteSpeed);
        }
    }

    setTimeout(typeLoop, 1200);
})();

// ============================================================
// 3. COUNTDOWN TIMER
// ============================================================
(function initCountdown() {
    const launchDate = new Date();
    launchDate.setDate(launchDate.getDate() + 90);
    launchDate.setHours(23, 59, 59, 999);

    function updateCountdown() {
        const now = new Date();
        const diff = launchDate - now;

        if (diff <= 0) {
            document.getElementById('cd-days').textContent = '00';
            document.getElementById('cd-hours').textContent = '00';
            document.getElementById('cd-minutes').textContent = '00';
            document.getElementById('cd-seconds').textContent = '00';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('cd-days').textContent = String(days).padStart(2, '0');
        document.getElementById('cd-hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('cd-minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('cd-seconds').textContent = String(seconds).padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
})();

// ============================================================
// 4. EMAIL FORM HANDLER
// ============================================================
function handleNotify(event) {
    event.preventDefault();
    const emailInput = document.getElementById('email-input');
    const submitBtn = document.getElementById('submit-btn');
    const successMsg = document.getElementById('form-success');

    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
        emailInput.style.borderColor = 'rgba(255, 45, 95, 0.7)';
        emailInput.style.boxShadow = '0 0 20px rgba(255, 45, 95, 0.25)';
        setTimeout(() => {
            emailInput.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            emailInput.style.boxShadow = 'none';
        }, 1500);
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    submitBtn.style.opacity = '0.6';

    setTimeout(() => {
        submitBtn.textContent = 'Notify Me ⚡';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.display = 'none';
        emailInput.style.display = 'none';
        successMsg.classList.add('show');

        console.log(`📧 Early access request: ${email}`);

        setTimeout(() => {
            successMsg.classList.remove('show');
            submitBtn.style.display = 'inline-flex';
            emailInput.style.display = 'block';
            emailInput.value = '';
        }, 6000);
    }, 1200);
}