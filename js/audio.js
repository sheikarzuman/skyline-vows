/* ============================================================
   audio.js — procedural placeholder audio (Web Audio API)
   No audio files needed: every sound is synthesized, so the
   game loads instantly. Swap these for real assets later by
   dropping files into /assets/audio and loading them here.
   ============================================================ */

class AudioMan {
  constructor() {
    this.enabled = true;
    this.ctx = null;          // created lazily on first user gesture
    this.master = null;
    this.windGain = null;
    this._musicTimer = null;
    this._climbTick = 0;
  }

  /** Must be called from a user gesture (button tap) to unlock audio. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.5 : 0;
    this.master.connect(this.ctx.destination);

    // --- wind ambience: looping filtered noise ---
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.4;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.04;
    src.connect(bp).connect(this.windGain).connect(this.master);
    src.start();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master)
      this.master.gain.linearRampToValueAtTime(this.enabled ? 0.5 : 0, this.ctx.currentTime + 0.1);
    return this.enabled;
  }

  /** 0..1 wind intensity — rises with altitude and gusts. */
  setWind(v) {
    if (this.windGain)
      this.windGain.gain.setTargetAtTime(0.03 + v * 0.14, this.ctx.currentTime, 0.4);
  }

  /* ---------------- tiny synth helpers ---------------- */
  _tone(freq, dur, type = 'sine', vol = 0.25, slide = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol = 0.2, freq = 800) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
  }

  /* ---------------- sound effects ---------------- */
  sfx(name) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'jump':    this._tone(300, .18, 'square', .12, 260); break;
      case 'land':    this._noise(.12, .25, 500); break;
      case 'climb':   // alternating soft ticks
        this._climbTick ^= 1;
        this._tone(this._climbTick ? 520 : 470, .05, 'triangle', .07); break;
      case 'grab':    this._tone(240, .1, 'triangle', .12, 80); break;
      case 'hit':     this._tone(140, .25, 'sawtooth', .2, -60); this._noise(.15, .2, 700); break;
      case 'ui':      this._tone(660, .07, 'sine', .12); break;
      case 'checkpoint': this._tone(523, .12, 'sine', .15); this._tone(784, .25, 'sine', .12); break;
      case 'alarm':   this._tone(880, .3, 'square', .1, -330); break;
      case 'whoosh':  this._noise(.5, .18, 350); break;
      case 'crumble': this._noise(.4, .3, 300); break;
      case 'propose': [523, 659, 784, 1047].forEach((f, i) =>
                        setTimeout(() => this._tone(f, .5, 'sine', .14), i * 160)); break;
      case 'firework': this._noise(.3, .22, 1200); this._tone(900 + Math.random() * 500, .3, 'sine', .07, -300); break;
      case 'sad':     this._tone(392, .4, 'sine', .14, -60);
                      setTimeout(() => this._tone(330, .7, 'sine', .14, -40), 350); break;
    }
  }

  /* ---------------- music placeholders ----------------
     A slow synth-pad chord loop; the "ending" variant is a
     brighter arpeggio. Replace with real tracks later. */
  music(on, bright = false) {
    clearInterval(this._musicTimer);
    this._musicTimer = null;
    if (!on || !this.ctx) return;

    const chords = bright
      ? [[523, 659, 784], [587, 740, 880], [659, 784, 988], [587, 740, 880]]
      : [[131, 196, 262], [117, 175, 233], [98, 147, 196], [110, 165, 220]];
    let step = 0;
    const playChord = () => {
      if (!this.enabled) return;
      const notes = chords[step % chords.length];
      notes.forEach((f, i) => this._tone(f, bright ? 0.6 : 3.2,
        bright ? 'triangle' : 'sine', bright ? 0.06 : 0.05));
      step++;
    };
    playChord();
    this._musicTimer = setInterval(playChord, bright ? 700 : 3200);
  }
}
