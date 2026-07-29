/**
 * Provider factory interfaces for the voice runtime.
 * Concrete adapters live in apps/voice-agent; this package stays framework-free.
 */

export type SttProviderId = string;
export type LlmProviderId = string;
export type TtsProviderId = string;

export interface SttConfig {
  provider: SttProviderId;
}

export interface LlmConfig {
  provider: LlmProviderId;
}

export interface TtsConfig {
  provider: TtsProviderId;
}

export interface StreamingSttProvider {
  readonly providerId: SttProviderId;
}

export interface ToolCallingLlm {
  readonly providerId: LlmProviderId;
}

export interface StreamingTtsProvider {
  readonly providerId: TtsProviderId;
}

export interface SttProviderFactory {
  create(config: SttConfig): StreamingSttProvider;
}

export interface LlmProviderFactory {
  create(config: LlmConfig): ToolCallingLlm;
}

export interface TtsProviderFactory {
  create(config: TtsConfig): StreamingTtsProvider;
}
