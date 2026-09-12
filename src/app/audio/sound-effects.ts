class SoundEffectsManager {
  private ctx: AudioContext | undefined;
  private muted = false;
  private engineOsc: OscillatorNode | undefined;
  private engineGain: GainNode | undefined;

  public constructor() {
    this.muted = localStorage.getItem("stem_sound_muted") === "true";
  }

  private initCtx(): AudioContext | undefined {
    if (this.muted) return undefined;
    if (this.ctx === undefined) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem("stem_sound_muted", muted ? "true" : "false");
    if (muted) {
      this.stopMotor();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public playClick(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch { /* AudioContext might be unavailable or blocked */ }
  }

  public playSnap(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch { /* AudioContext might be unavailable or blocked */ }
  }

  public playVictory(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      // Fanfare: C5 -> E5 -> G5 -> C6
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        const startTime = ctx.currentTime + index * 0.12;
        const duration = index === notes.length - 1 ? 0.4 : 0.12;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } catch { /* AudioContext might be unavailable or blocked */ }
  }

  public playBoing(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch { /* AudioContext might be unavailable or blocked */ }
  }

  public updateMotor(throttle: number): void {
    const ctx = this.initCtx();
    if (!ctx || this.muted) {
      this.stopMotor();
      return;
    }
    const abs = Math.abs(throttle);
    if (abs < 0.05) {
      this.stopMotor();
      return;
    }
    try {
      if (this.engineOsc === undefined || this.engineGain === undefined) {
        this.engineOsc = ctx.createOscillator();
        this.engineGain = ctx.createGain();
        this.engineOsc.type = "sawtooth";
        this.engineOsc.frequency.setValueAtTime(70, ctx.currentTime);
        this.engineGain.gain.setValueAtTime(0.05, ctx.currentTime);
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(ctx.destination);
        this.engineOsc.start();
      }
      const targetFreq = 70 + abs * 120;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);
      this.engineGain.gain.setTargetAtTime(0.06 + abs * 0.06, ctx.currentTime, 0.05);
    } catch { /* AudioContext might be unavailable */ }
  }

  public stopMotor(): void {
    if (this.engineOsc !== undefined) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch { /* ignore */ }
      this.engineOsc = undefined;
      this.engineGain = undefined;
    }
  }
}

export const soundEffects = new SoundEffectsManager();
