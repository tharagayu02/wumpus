/**
 * Wumpus World - Particle & Visual Effects Engine
 * Renders ambient floating cave dust, glowing fiery embers, torch flames,
 * gold sparkles, and screen shake impacts.
 */

class ParticleEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.burstParticles = [];
        this.animFrameId = null;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.density = 'ultra'; // 'low' | 'medium' | 'ultra'
        this.running = false;
    }

    init(canvasId = 'ambientCanvas') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        if (window.GameStorage && window.GameStorage.settings) {
            this.density = window.GameStorage.settings.particleDensity || 'ultra';
        }

        this.spawnAmbientParticles();
        this.start();
    }

    resize() {
        if (!this.canvas) return;
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
    }

    getParticleCount() {
        switch (this.density) {
            case 'low': return 25;
            case 'medium': return 60;
            case 'ultra':
            default: return 120;
        }
    }

    setDensity(level) {
        this.density = level;
        this.spawnAmbientParticles();
    }

    spawnAmbientParticles() {
        this.particles = [];
        const count = this.getParticleCount();
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createAmbientParticle());
        }
    }

    createAmbientParticle() {
        const isEmber = Math.random() < 0.35; // 35% are glowing amber/red embers, 65% are soft cave dust
        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            size: isEmber ? Math.random() * 2.5 + 1.0 : Math.random() * 2.0 + 0.5,
            vx: (Math.random() - 0.5) * 0.4,
            vy: isEmber ? -(Math.random() * 0.6 + 0.2) : (Math.random() - 0.5) * 0.3,
            alpha: Math.random() * 0.7 + 0.2,
            maxAlpha: Math.random() * 0.8 + 0.3,
            fadeSpeed: Math.random() * 0.008 + 0.002,
            fadingIn: Math.random() > 0.5,
            isEmber: isEmber,
            color: isEmber
                ? (Math.random() > 0.4 ? '255, 175, 45' : '255, 85, 30')
                : '160, 180, 210'
        };
    }

    start() {
        if (this.running) return;
        this.running = true;

        const loop = () => {
            if (!this.running) return;
            this.update();
            this.render();
            this.animFrameId = requestAnimationFrame(loop);
        };
        this.animFrameId = requestAnimationFrame(loop);
    }

    stop() {
        this.running = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    update() {
        // Update ambient particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;

            // Fade oscillations
            if (p.fadingIn) {
                p.alpha += p.fadeSpeed;
                if (p.alpha >= p.maxAlpha) {
                    p.fadingIn = false;
                }
            } else {
                p.alpha -= p.fadeSpeed;
                if (p.alpha <= 0.05) {
                    p.fadingIn = true;
                }
            }

            // Wrap around screen boundaries
            if (p.x < -10) p.x = this.width + 10;
            if (p.x > this.width + 10) p.x = -10;
            if (p.y < -10) {
                p.y = this.height + 10;
                p.x = Math.random() * this.width;
            }
            if (p.y > this.height + 10) p.y = -10;
        }

        // Update burst / impact particles
        for (let i = this.burstParticles.length - 1; i >= 0; i--) {
            const bp = this.burstParticles[i];
            bp.x += bp.vx;
            bp.y += bp.vy;
            bp.vy += bp.gravity;
            bp.alpha -= bp.fade;
            bp.size = Math.max(0.1, bp.size * 0.98);

            if (bp.alpha <= 0 || bp.size <= 0.2) {
                this.burstParticles.splice(i, 1);
            }
        }
    }

    render() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw ambient particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

            if (p.isEmber) {
                this.ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
                this.ctx.shadowColor = `rgba(${p.color}, 0.8)`;
                this.ctx.shadowBlur = 8;
            } else {
                this.ctx.fillStyle = `rgba(${p.color}, ${p.alpha * 0.4})`;
                this.ctx.shadowBlur = 0;
            }

            this.ctx.fill();
        }

        // Draw burst particles
        for (let i = 0; i < this.burstParticles.length; i++) {
            const bp = this.burstParticles[i];
            this.ctx.beginPath();
            this.ctx.arc(bp.x, bp.y, bp.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${bp.color}, ${Math.max(0, bp.alpha)})`;
            this.ctx.shadowColor = `rgba(${bp.color}, 0.9)`;
            this.ctx.shadowBlur = bp.glow ? 12 : 0;
            this.ctx.fill();
        }

        this.ctx.shadowBlur = 0; // reset
    }

    // Sparkle burst at a specific screen coordinate (e.g. gold pickup)
    spawnGoldSparkles(x, y, count = 35) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            this.burstParticles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                gravity: 0.1,
                size: Math.random() * 3.5 + 1.5,
                alpha: 1.0,
                fade: Math.random() * 0.025 + 0.015,
                glow: true,
                color: Math.random() > 0.3 ? '255, 215, 0' : '255, 245, 160' // Gold/bright sparkle
            });
        }
    }

    // Blood / Hit impact sparks (e.g. Wumpus attack or killed)
    spawnHitImpact(x, y, count = 30, isWumpusDeath = false) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 1.5;
            this.burstParticles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.15,
                size: Math.random() * 4 + 1.5,
                alpha: 1.0,
                fade: Math.random() * 0.03 + 0.02,
                glow: true,
                color: isWumpusDeath ? '74, 222, 128' : '239, 68, 68' // Green venom or crimson blood
            });
        }
    }

    // Dramatic Screen Shake
    shake(element = document.body, intensity = 10, duration = 400) {
        if (window.GameStorage && window.GameStorage.settings && !window.GameStorage.settings.screenShake) {
            return;
        }

        element.classList.add('screen-shake');
        setTimeout(() => {
            element.classList.remove('screen-shake');
        }, duration);
    }
}

// Global instance
window.GameParticles = new ParticleEngine();
