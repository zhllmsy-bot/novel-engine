/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Pure Web Audio API Synthesizer for Zen Ambient Sounds and Typewriter Click Feedback
// This bypasses the need for downloading external audio file assets and runs entirely on client-side DSP.

class ZenSynth {
  private ctx: AudioContext | null = null;
  private rainNode: AudioNode | null = null;
  private waveNode: AudioNode | null = null;
  private fireNode: AudioNode | null = null;
  private windNode: AudioNode | null = null;
  
  private rainGain: GainNode | null = null;
  private waveGain: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private windGain: GainNode | null = null;

  private isRunning = false;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Helper: Generates a buffer containing 2 seconds of pinkish noise
  private createNoiseBuffer(type: 'white' | 'pink' | 'brown'): AudioBuffer {
    if (!this.ctx) throw new Error('No audio context');
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; // for pink noise
    let lastOut = 0.0; // for brown noise

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      
      if (type === 'white') {
        data[i] = white;
      } else if (type === 'pink') {
        // Paul Kellet's refined method for pink noise approximation
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = pink * 0.11; // normalise roughly
      } else if (type === 'brown') {
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // normalise roughly
      }
    }
    return buffer;
  }

  // --- Rain Synthesizer ---
  private startRain() {
    if (!this.ctx) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('pink');
    noise.loop = true;

    // Filter to simulate raindrops hit on soft surfaces
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;

    noise.connect(filter);
    filter.connect(this.rainGain);
    this.rainGain.connect(this.ctx.destination);

    noise.start();
    this.rainNode = noise;
  }

  // --- Ocean Wave Synthesizer ---
  private startWaves() {
    if (!this.ctx) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('brown');
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 350;
    filter.Q.value = 1.0;

    this.waveGain = this.ctx.createGain();
    this.waveGain.gain.value = 0;

    // Modulation LFO for wave rolling swells
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12; // 8-second wave periods

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.15; // Swell depth

    lfo.connect(lfoGain);
    lfoGain.connect(this.waveGain.gain);

    noise.connect(filter);
    filter.connect(this.waveGain);
    this.waveGain.connect(this.ctx.destination);

    lfo.start();
    noise.start();

    this.waveNode = noise;
  }

  // --- Fire Synthesizer (Hiss + Crackles) ---
  private startFire() {
    if (!this.ctx) return;
    
    // Constant Hiss
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('pink');
    noise.loop = true;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;

    this.fireGain = this.ctx.createGain();
    this.fireGain.gain.value = 0;

    noise.connect(lp);
    lp.connect(this.fireGain);
    this.fireGain.connect(this.ctx.destination);
    noise.start();

    // Spontaneous Wood Popping Generator
    const fireTriggerInterval = setInterval(() => {
      if (!this.ctx || !this.isRunning || (this.fireGain && this.fireGain.gain.value < 0.01)) return;
      
      // Random fire pops
      if (Math.random() > 0.4) {
        const osc = this.ctx.createOscillator();
        const popGain = this.ctx.createGain();
        const lpPop = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(60 + Math.random() * 120, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.05);

        lpPop.type = 'lowpass';
        lpPop.frequency.setValueAtTime(400, this.ctx.currentTime);

        popGain.gain.setValueAtTime(0.01 + Math.random() * 0.08, this.ctx.currentTime);
        popGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);

        osc.connect(lpPop);
        lpPop.connect(popGain);
        popGain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.06);
      }
    }, 150);

    this.fireNode = {
      disconnect: () => {
        clearInterval(fireTriggerInterval);
        try { noise.stop(); } catch(e) {}
      }
    } as any;
  }

  // --- Wind Synthesizer (Howling filter) ---
  private startWind() {
    if (!this.ctx) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer('pink');
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 3.0;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;

    // LFO to make the wind drift and howl organically
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08; // slow drift

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 250; // howl sweep amount

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);

    lfo.start();
    noise.start();

    this.windNode = noise;
  }

  // --- Global Control ---
  public start() {
    try {
      this.initCtx();
      if (this.isRunning) return;
      this.isRunning = true;

      this.startRain();
      this.startWaves();
      this.startFire();
      this.startWind();
    } catch (e) {
      console.error('Failed to init ambient player:', e);
    }
  }

  public stop() {
    this.isRunning = false;
    
    const stopNode = (node: AudioNode | null) => {
      if (node) {
        try { (node as any).stop(); } catch(e) {}
        try { node.disconnect(); } catch(e) {}
      }
    };

    stopNode(this.rainNode);
    stopNode(this.waveNode);
    if (this.fireNode) {
      try { this.fireNode.disconnect(); } catch(e) {}
    }
    stopNode(this.windNode);

    this.rainNode = null;
    this.waveNode = null;
    this.fireNode = null;
    this.windNode = null;
  }

  public setVolume(track: 'rain' | 'wave' | 'fire' | 'wind', value: number) {
    this.initCtx();
    const g = 
      track === 'rain' ? this.rainGain :
      track === 'wave' ? this.waveGain :
      track === 'fire' ? this.fireGain : this.windGain;
    
    if (g && this.ctx) {
      g.gain.linearRampToValueAtTime(value * 0.4, this.ctx.currentTime + 0.1);
    }
  }

  // --- Satisfying Retro Typewriter Click Feedback ---
  public playTypeClick(isBackspace = false) {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Slightly lower frequency for backspace/return key to feel weighty
      const baseFreq = isBackspace ? 300 : (700 + Math.random() * 300);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.04);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      filter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      // Super snappy decay amplitude envelope
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.035);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);

      // Add a tiny wooden crackle pop for realistic spacey key weight
      if (Math.random() > 0.5) {
        const noise = this.ctx.createOscillator();
        const noiseGain = this.ctx.createGain();
        noise.type = 'triangle';
        noise.frequency.setValueAtTime(1200 + Math.random() * 400, this.ctx.currentTime);
        noiseGain.gain.setValueAtTime(0.004, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.015);
        noise.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start();
        noise.stop(this.ctx.currentTime + 0.02);
      }

    } catch (e) {
      // Audio context may not be allowed on non-gesture events, ignore gracefully
    }
  }
}

export const zenSynth = new ZenSynth();
