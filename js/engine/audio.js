/**
 * Wumpus World - Audio System
 * High-fidelity procedural Web Audio API sound synthesizer and ambient music generator.
 * Zero external asset dependencies required - 100% reliable in all browsers.
 */

class AudioManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.masterVolume = 0.8;
        this.musicVolume = 0.5;
        this.sfxVolume = 0.85;

        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;

        // Music state
        this.isMusicPlaying = false;
        this.ambientInterval = null;
        this.ambientNodes = [];

        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            console.warn('AudioManager: Web Audio API not supported.');
            return;
        }

        try {
            this.ctx = new AudioContextClass();

            // Load settings
            const settings = window.GameStorage ? window.GameStorage.settings : null;
            if (settings) {
                this.isMuted = !!settings.muted;
                this.masterVolume = settings.masterVolume !== undefined ? settings.masterVolume : 0.8;
                this.musicVolume = settings.musicVolume !== undefined ? settings.musicVolume : 0.5;
                this.sfxVolume = settings.sfxVolume !== undefined ? settings.sfxVolume : 0.85;
            }

            // Create Master Gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            // Music Gain
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
            this.musicGain.connect(this.masterGain);

            // SFX Gain
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);

            this.initialized = true;

            // Start ambient music if not muted
            if (!this.isMuted) {
                this.startAmbientMusic();
            }
        } catch (e) {
            console.error('AudioManager init failed', e);
        }
    }

    resumeContext() {
        if (!this.initialized) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (this.masterGain && this.ctx) {
            const target = muted ? 0 : this.masterVolume;
            this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
        }
        if (window.GameStorage) {
            window.GameStorage.saveSettings({ muted });
        }
        if (!muted && !this.isMusicPlaying) {
            this.startAmbientMusic();
        }
    }

    toggleMute() {
        this.setMuted(!this.isMuted);
        return this.isMuted;
    }

    setMasterVolume(val) {
        this.masterVolume = Math.max(0, Math.min(1, val));
        if (this.masterGain && this.ctx && !this.isMuted) {
            this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
        }
        if (window.GameStorage) {
            window.GameStorage.saveSettings({ masterVolume: this.masterVolume });
        }
    }

    setMusicVolume(val) {
        this.musicVolume = Math.max(0, Math.min(1, val));
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
        }
        if (window.GameStorage) {
            window.GameStorage.saveSettings({ musicVolume: this.musicVolume });
        }
    }

    setSfxVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
        }
        if (window.GameStorage) {
            window.GameStorage.saveSettings({ sfxVolume: this.sfxVolume });
        }
    }

    // ==================== PROCEDURAL SOUND EFFECTS ====================

    // Tactile UI click
    playClick() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.04);
    }

    // Footstep thud inside stone cave
    playFootstep() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        // Low frequency thud
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(95 + Math.random() * 20, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.08);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, now);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.09);
    }

    // Arrow shooting whoosh & bow twang
    playArrowShoot() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;

        // String twang
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        // White noise whoosh
        const bufferSize = this.ctx.sampleRate * 0.25;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(900, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(2500, now + 0.12);
        noiseFilter.Q.value = 3;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.15);
        noise.start(now);
        noise.stop(now + 0.25);
    }

    // Arrow hits cave stone wall
    playArrowHitWall() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    // Wumpus Roar / Attack
    playWumpusRoar() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;

        // Distorted low frequency growl
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const distortion = this.ctx.createWaveShaper();

        // Curve for monster distortion
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        const k = 40;
        for (let i = 0; i < n_samples; ++i) {
            let x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        distortion.curve = curve;
        distortion.oversample = '4x';

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(110, now);
        osc1.frequency.linearRampToValueAtTime(65, now + 0.5);
        osc1.frequency.linearRampToValueAtTime(45, now + 0.9);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(115, now);
        osc2.frequency.linearRampToValueAtTime(70, now + 0.5);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.65, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

        osc1.connect(distortion);
        osc2.connect(distortion);
        distortion.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.95);
        osc2.stop(now + 0.95);
    }

    // Wumpus Death Scream (Cave echo)
    playWumpusDeath() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 1.2);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 1.2);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 1.4);
    }

    // Breeze percept sound (whistling cave wind)
    playBreeze() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.linearRampToValueAtTime(750, now + 0.4);
        filter.frequency.linearRampToValueAtTime(350, now + 0.8);
        filter.Q.value = 6;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.2);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.8);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start(now);
        noise.stop(now + 0.8);
    }

    // Stench percept sound (eerie bubbling tone)
    playStench() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);

        lfo.frequency.setValueAtTime(8, now); // bubbling rate
        lfoGain.gain.setValueAtTime(25, now);

        lfo.connect(osc.frequency);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        lfo.start(now);
        osc.start(now);
        lfo.stop(now + 0.7);
        osc.stop(now + 0.7);
    }

    // Subtle combination of wind whisper and ominous tone for Breeze + Stench
    playBreezeAndStench() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;
        this.playBreeze();
        this.playStench();
    }

    // Subtle mysterious chamber pulse on entering a cell
    playChamberPulse() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(85, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.22);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, now);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.22);
    }

    // Gold Glitter sound (crystalline sparkle)
    playGlitter() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const notes = [587.33, 739.99, 880.0, 1174.66, 1479.98]; // D5, F#5, A5, D6, F#6
        notes.forEach((freq, idx) => {
            const time = this.ctx.currentTime + idx * 0.06;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(time);
            osc.stop(time + 0.35);
        });
    }

    // Gold Collection fanfare (euphoric treasure pickup)
    playGoldCollect() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const chord = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C major flourish
        chord.forEach((freq, idx) => {
            const time = this.ctx.currentTime + idx * 0.07;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.35, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(time);
            osc.stop(time + 0.6);
        });
    }

    // Falling into Deadly Pit (sinister descending tone)
    playPitFall() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 1.2);
    }

    // Subtle mysterious success sound on level completion
    playVictory() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const root = 146.83; // D3
        const chords = [root, root * 1.5, root * 2, root * 3]; // D3, A3, D4, A4

        chords.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);

            gain.gain.setValueAtTime(0.01, now + idx * 0.12);
            gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.12 + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 1.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 1.25);
        });
    }

    // Mysterious chime on claiming level reward
    playRewardClaim() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
            const time = this.ctx.currentTime + idx * 0.08;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.18, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(time);
            osc.stop(time + 0.45);
        });
    }

    // Atmospheric descent tone when entering cave
    playEnterCave() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.6);
    }

    // Defeat sound
    playDefeat() {
        this.resumeContext();
        if (!this.ctx || this.isMuted) return;

        const notes = [
            { f: 311.13, dur: 0.35, t: 0.0 },  // Eb4
            { f: 293.66, dur: 0.35, t: 0.3 },  // D4
            { f: 277.18, dur: 0.35, t: 0.6 },  // C#4
            { f: 261.63, dur: 0.8, t: 0.9 }    // C4
        ];

        notes.forEach(s => {
            const start = this.ctx.currentTime + s.t;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(s.f, start);

            gain.gain.setValueAtTime(0.35, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + s.dur);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(start);
            osc.stop(start + s.dur);
        });
    }

    // ==================== PROCEDURAL AMBIENT MUSIC ====================

    startAmbientMusic() {
        if (!this.ctx || this.isMusicPlaying) return;
        this.isMusicPlaying = true;

        this.scheduleAmbientDrone();
    }

    scheduleAmbientDrone() {
        if (!this.ctx || !this.isMusicPlaying) return;

        // Create deep dark cavern sub-drone with subtle harmony
        const now = this.ctx.currentTime;
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(55, now); // A1 note
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, now);

        bassGain.gain.setValueAtTime(0.01, now);
        bassGain.gain.linearRampToValueAtTime(0.2, now + 3);

        bassOsc.connect(filter);
        filter.connect(bassGain);
        bassGain.connect(this.musicGain);

        bassOsc.start(now);
        this.ambientNodes.push({ osc: bassOsc, gain: bassGain });

        // Periodically play ethereal cave resonant chords
        const chords = [
            [220, 261.63, 329.63], // Am
            [174.61, 220, 261.63], // F
            [196, 246.94, 293.66], // G
            [164.81, 196, 246.94]  // Em
        ];

        let chordIdx = 0;
        this.ambientInterval = setInterval(() => {
            if (!this.ctx || !this.isMusicPlaying || this.isMuted) return;

            const t = this.ctx.currentTime;
            const currentChord = chords[chordIdx % chords.length];
            chordIdx++;

            currentChord.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const padFilter = this.ctx.createBiquadFilter();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, t);

                padFilter.type = 'lowpass';
                padFilter.frequency.setValueAtTime(450, t);

                // Very gentle swell
                gain.gain.setValueAtTime(0.001, t);
                gain.gain.linearRampToValueAtTime(0.06, t + 2.5);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 7.5);

                osc.connect(padFilter);
                padFilter.connect(gain);
                gain.connect(this.musicGain);

                osc.start(t);
                osc.stop(t + 7.8);
            });
        }, 8000);
    }

    stopAmbientMusic() {
        this.isMusicPlaying = false;
        if (this.ambientInterval) {
            clearInterval(this.ambientInterval);
            this.ambientInterval = null;
        }
        if (this.ctx) {
            this.ambientNodes.forEach(node => {
                try {
                    node.gain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.5);
                    setTimeout(() => {
                        try { node.osc.stop(); } catch (e) {}
                    }, 600);
                } catch (e) {}
            });
            this.ambientNodes = [];
        }
    }
}

// Global instance
window.GameAudio = new AudioManager();
