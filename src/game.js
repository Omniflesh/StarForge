import { Renderer } from './renderer.js';
import { Star } from './star.js';
import { Economy } from './economy.js';
import { SaveManager } from './save.js';
import { UIManager } from './ui.js';
import { AudioManager } from './audio.js';

export class Game {
    constructor({ canvas, hud, buttons, notifications }) {
        this.canvas = canvas;
        this.hud = hud;
        this.buttons = buttons;
        this.notifications = notifications;

        this.renderer = new Renderer(canvas);
        this.audio = new AudioManager();
        this.save = new SaveManager();
        this.economy = new Economy();
        this.ui = new UIManager({ hud, buttons, notifications, game: this });
        this.star = new Star();

        this.state = {
            dust: 0,
            power: 1,
            level: 1,
            combo: 0,
            flareAngle: 0,
            satellites: [],
            drones: [],
            particles: [],
            comets: [],
            lastTime: performance.now(),
            running: false,
            shake: 0,
            pulse: 0,
            autosaveTimer: 0
        };

        this._loop = this._loop.bind(this);
        this._onResize = this._onResize.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
    }

    start() {
        this.renderer.resize();
        window.addEventListener('resize', this._onResize);
        this.canvas.addEventListener('pointerdown', this._onPointerDown);
        this.ui.bind();

        const saved = this.save.load();
        if (saved) this.restore(saved);

        this.state.running = true;
        requestAnimationFrame(this._loop);
        this.notify('Star Forge online.');
    }

    restore(saved) {
        this.state.dust = saved.dust ?? this.state.dust;
        this.state.power = saved.power ?? this.state.power;
        this.state.level = saved.level ?? this.state.level;
        this.state.combo = saved.combo ?? this.state.combo;
        this.state.satellites = Array.isArray(saved.satellites) ? saved.satellites : [];
        this.state.drones = Array.isArray(saved.drones) ? saved.drones : [];
        this.economy.restore(saved.economy);
    }

    serialize() {
        return {
            dust: this.state.dust,
            power: this.state.power,
            level: this.state.level,
            combo: this.state.combo,
            satellites: this.state.satellites,
            drones: this.state.drones,
            economy: this.economy.serialize()
        };
    }

    notify(message) {
        this.ui.notify(message);
    }

    buildSatellite() {
        if (this.state.dust < 50) return false;
        this.state.dust -= 50;
        this.state.satellites.push({
            angle: Math.random() * Math.PI * 2,
            radius: 135 + Math.random() * 50,
            speed: 0.35 + Math.random() * 0.2
        });
        this.audio.playUpgrade();
        this.notify('Satellite launched.');
        return true;
    }

    buildDrone() {
        if (this.state.dust < 150) return false;
        this.state.dust -= 150;
        this.state.drones.push({
            angle: Math.random() * Math.PI * 2,
            radius: 180 + Math.random() * 30,
            speed: 0.5 + Math.random() * 0.25
        });
        this.audio.playUpgrade();
        this.notify('Drone deployed.');
        return true;
    }

    upgradeClickPower() {
        if (this.state.dust < 75) return false;
        this.state.dust -= 75;
        this.economy.clickBonus += 0.35;
        this.audio.playUpgrade();
        this.notify('Click power improved.');
        return true;
    }

    clickAt(x, y) {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > 95) return;

        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += Math.PI * 2;
        const good = angle > this.state.flareAngle && angle < this.state.flareAngle + 0.55;

        this.state.combo = good ? this.state.combo + 1 : 0;
        const gain = this.economy.getClickValue(this.state.combo) * (good ? 5 : 1);
        this.state.dust += gain;
        this.state.pulse = 0.4;
        this.state.shake = 8;
        this.audio.playClick(good);

        for (let i = 0; i < 32; i++) {
            this.state.particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1,
                hue: good ? 30 + Math.random() * 30 : 190 + Math.random() * 20
            });
        }

        this.ui.floatingText(x, y, `+${gain.toFixed(1)}`);
    }

    _onPointerDown(e) {
        this.clickAt(e.clientX, e.clientY);
    }

    _onResize() {
        this.renderer.resize();
    }

    _loop(now) {
        if (!this.state.running) return;
        requestAnimationFrame(this._loop);

        const dt = Math.min((now - this.state.lastTime) / 1000 || 0, 0.05);
        this.state.lastTime = now;

        this.state.flareAngle = (this.state.flareAngle + dt * 0.8) % (Math.PI * 2);
        this.state.level = this.economy.getLevel(this.state.dust);
        this.state.power = this.economy.getPower(this.state);
        this.state.dust += this.economy.getPassiveIncome(this.state) * dt;
        this.state.pulse *= 0.92;
        this.state.shake *= 0.9;

        this._updateOrbits(dt);
        this._updateParticles(dt);
        this._updateComets(dt);

        this.renderer.render({
            now,
            dt,
            state: this.state,
            star: this.star,
            satellites: this.state.satellites,
            drones: this.state.drones,
            particles: this.state.particles,
            comets: this.state.comets
        });

        this.ui.sync(this.state, this.economy);

        this.state.autosaveTimer += dt;
        if (this.state.autosaveTimer > 8) {
            this.state.autosaveTimer = 0;
            this.save.save(this.serialize());
        }
    }

    _updateOrbits(dt) {
        for (const sat of this.state.satellites) sat.angle += sat.speed * dt;
        for (const drone of this.state.drones) drone.angle += drone.speed * dt;
    }

    _updateParticles(dt) {
        this.state.particles = this.state.particles.filter(p => p.life > 0);
        for (const p of this.state.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.025;
        }
    }

    _updateComets(dt) {
        this.state.comets = this.state.comets.filter(c => c.x < this.canvas.width + 50 && !c.hit);
        for (const comet of this.state.comets) comet.x += comet.v * dt;

        if (Math.random() < dt * 0.2) {
            this.state.comets.push({ x: -40, y: 80 + Math.random() * (this.canvas.height - 160), v: 220 + Math.random() * 100, hit: false });
        }
    }
}
