export interface BargeInSnapshot {
  wasInterrupted: boolean;
  playedTextLength: number;
  heardText: string;
}

/**
 * Tracks agent speech playback and handles child barge-in.
 * Unplayed tail is excluded from heard context.
 */
export class BargeInTracker {
  private speakingText = '';
  private playedTextLength = 0;
  private isSpeaking = false;
  private interruptHandled = false;

  beginSpeaking(text: string): void {
    this.speakingText = text;
    this.playedTextLength = 0;
    this.isSpeaking = true;
    this.interruptHandled = false;
  }

  updatePlayedLength(length: number): void {
    if (!this.isSpeaking) return;
    this.playedTextLength = Math.min(Math.max(0, length), this.speakingText.length);
  }

  /** Idempotent interrupt — second call while already handled is a no-op. */
  handleInterrupt(playedLength?: number): BargeInSnapshot {
    if (!this.isSpeaking) {
      return { wasInterrupted: false, playedTextLength: 0, heardText: '' };
    }
    if (this.interruptHandled) {
      return {
        wasInterrupted: false,
        playedTextLength: this.playedTextLength,
        heardText: this.speakingText.slice(0, this.playedTextLength),
      };
    }

    if (playedLength !== undefined) {
      this.playedTextLength = Math.min(playedLength, this.speakingText.length);
    }

    this.interruptHandled = true;
    this.isSpeaking = false;
    const heardText = this.speakingText.slice(0, this.playedTextLength);
    return { wasInterrupted: true, playedTextLength: this.playedTextLength, heardText };
  }

  completeSpeaking(): BargeInSnapshot {
    this.isSpeaking = false;
    this.playedTextLength = this.speakingText.length;
    return {
      wasInterrupted: false,
      playedTextLength: this.playedTextLength,
      heardText: this.speakingText,
    };
  }

  getSpeakingText(): string {
    return this.speakingText;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}
