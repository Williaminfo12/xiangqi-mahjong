
class AudioService {
  private bgm: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
      // Initialize Web Audio API for SFX
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContext();
      } catch (e) {
          console.error("Web Audio API not supported");
      }
      
      // BGM - Traditional Guzheng Track (Wild Geese Descending on the Sandbank)
      this.bgm = new Audio("https://upload.wikimedia.org/wikipedia/commons/6/6c/Guzheng_Pingshu_Luo_Yan.ogg"); 
      this.bgm.loop = true;
      this.bgm.volume = 0.2; // Low volume for background ambience
  }

  public playBGM() {
      // Resume AudioContext if suspended (browser autoplay policy)
      if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(e => console.error("AudioContext resume failed", e));
      }

      if (this.bgm && !this.isMuted) {
          this.bgm.play().catch(e => console.log("Audio play failed (user interaction required)", e));
      }
  }

  public stopBGM() {
      if (this.bgm) {
          this.bgm.pause();
          this.bgm.currentTime = 0;
      }
  }

  public toggleMute() {
      this.isMuted = !this.isMuted;
      
      // Handle BGM
      if (this.isMuted) {
          this.bgm?.pause();
      } else {
          // Only resume BGM if we are supposed to be playing (simplified: we try to play)
          this.bgm?.play().catch(() => {});
      }
      
      // Handle SFX Context
      if (this.ctx) {
          if (this.isMuted) {
              this.ctx.suspend();
          } else {
              this.ctx.resume();
          }
      }

      return this.isMuted;
  }

  // Simple Oscillator-based SFX generator to avoid external asset dependencies
  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
      if (!this.ctx || this.isMuted) return;
      
      try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = type;
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
          
          gain.gain.setValueAtTime(vol, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
          
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          
          osc.start();
          osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
          console.error("Error playing tone", e);
      }
  }

  public playClick() {
      this.playTone(800, 'sine', 0.1, 0.05);
  }

  public playDraw() {
      // A sliding sound simulation
      if (!this.ctx || this.isMuted) return;
      try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.frequency.setValueAtTime(300, this.ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(500, this.ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.1);
      } catch (e) {
          console.error(e);
      }
  }

  public playDiscard() {
     this.playTone(600, 'triangle', 0.1, 0.1);
  }

  public playWin() {
      if (!this.ctx || this.isMuted) return;
      // Victory Arpeggio
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          setTimeout(() => this.playTone(freq, 'sine', 0.3, 0.2), i * 100);
      });
  }
  
  public playCut() {
      this.playTone(200, 'sawtooth', 0.2, 0.1);
  }
}

const audioService = new AudioService();
export default audioService;
