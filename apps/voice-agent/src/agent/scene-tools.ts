import type { AgentToolName } from '@pamagochi/contracts';
import {
  introAllowlistFor,
  isIntroState,
  talkingLightAllowlist,
  type SceneAllowlist,
} from '@pamagochi/game-protocol';

const TOOL_DESCRIPTIONS: Record<AgentToolName, string> = {
  character_emote: 'Express an emotion visually on the character',
  character_look_at: 'Look at a visible scene object by id',
  character_gesture: 'Perform an allowlisted gesture',
  scene_highlight_object: 'Highlight a visible interactive object',
  scene_request_event: 'Request a scene-scoped world event (never force it)',
  request_parent_attention: 'Ask a parent for help with a short safe summary',
};

export function resolveSceneAllowlist(
  sceneKey: string | undefined,
  sceneState: string | undefined,
): SceneAllowlist {
  if (sceneKey === 'ship-capsule-intro' && sceneState && isIntroState(sceneState)) {
    return introAllowlistFor(sceneState);
  }
  return talkingLightAllowlist();
}

export function llmToolsForAllowlist(
  allowlist: SceneAllowlist,
): Array<{ name: string; description: string; parameters: Record<string, unknown> }> {
  return allowlist.allowedToolNames
    .filter((name): name is AgentToolName => name in TOOL_DESCRIPTIONS)
    .map((name) => ({
      name,
      description: TOOL_DESCRIPTIONS[name],
      parameters: { type: 'object', properties: {} },
    }));
}
