export type SpeechInputListener = (text: string) => void;
export interface SpeechInputProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(listener: SpeechInputListener): () => void;
}
export interface VoiceOutputProvider {
  speak(text: string, options?: { emotion?: string }): Promise<void>;
  stop(): Promise<void>;
}
