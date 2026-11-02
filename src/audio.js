export class AudioSystem {
  constructor() {
    this.context = null;
    this.enabled = true;
  }

  play(kind = 'spark') {
    if (!this.enabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.context ||= new AudioContextClass();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const notes = {
        correct: [660, 880],
        spell: [440, 760],
        hit: [180, 120],
        wrong: [260, 190],
        room: [523, 784],
        spark: [730, 980],
      };
      const [start, end] = notes[kind] || notes.spark;
      oscillator.type = kind === 'hit' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(start, now);
      oscillator.frequency.exponentialRampToValueAtTime(end, now + 0.13);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } catch {
      this.enabled = false;
    }
  }
}
