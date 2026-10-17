/**
 * Lightweight Web Audio API Synthesizer for UI sound effects & mobile haptics
 * 100% offline, 0 external network requests, zero bundle weight
 */

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('dorm_sound_fx_enabled');
      if (saved !== null) {
        this.soundEnabled = saved === 'true';
      }
    } catch {
      this.soundEnabled = true;
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('dorm_sound_fx_enabled', String(enabled));
    } catch {}
  }

  public toggle(): boolean {
    const next = !this.soundEnabled;
    this.setEnabled(next);
    if (next) {
      this.playRoomSwitch('jump');
    }
    return next;
  }

  /**
   * Room switch sound effect (custom synthesized micro-audio)
   */
  public playRoomSwitch(direction: 'next' | 'prev' | 'jump' = 'next'): void {
    // 1. Mobile haptic vibration
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (direction === 'next') {
          navigator.vibrate([15, 20, 25]);
        } else if (direction === 'prev') {
          navigator.vibrate([25, 20, 15]);
        } else {
          navigator.vibrate(30);
        }
      }
    } catch {}

    // 2. Synthesized sound
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';

      if (direction === 'next') {
        // Upward pleasant blip (e.g. 520Hz -> 780Hz)
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.09);
      } else if (direction === 'prev') {
        // Downward soft blip (e.g. 740Hz -> 480Hz)
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.09);
      } else {
        // Chime for jump (600Hz -> 880Hz)
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      }

      // Smooth envelope (instant attack, quick soft decay)
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // AudioContext blocked by browser policy until interaction
    }
  }

  /**
   * Check / Save sound (when marking present or save)
   */
  public playSuccessSound(): void {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(990, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.17);
    } catch {}
  }
}

export const soundEffects = new SoundEffectsManager();
