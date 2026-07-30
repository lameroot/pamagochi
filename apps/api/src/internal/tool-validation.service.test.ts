import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentToolRequest } from '@pamagochi/contracts';
import { ToolValidationService } from './tool-validation.service.js';
import type { PrismaService } from '../database/prisma.service.js';

const activeSession = {
  id: 'conv-1',
  childId: 'child-1',
  status: 'active',
  child: { id: 'child-1' },
};

function mockPrisma() {
  return {
    client: {
      conversationSession: {
        findUnique: vi.fn(async () => activeSession),
      },
      agentToolCall: {
        create: vi.fn(async () => ({})),
      },
    },
  } as unknown as PrismaService;
}

describe('ToolValidationService', () => {
  let service: ToolValidationService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new ToolValidationService(prisma);
  });

  it('rejects unknown tools', async () => {
    const request = {
      name: 'execute_shell',
      callId: 'x1',
      arguments: {},
    } as unknown as AgentToolRequest;
    const result = await service.validateAndAudit({
      conversationSessionId: 'conv-1',
      sceneKey: 'talking-light',
      request,
    });
    expect(result.validation).toBe('rejected_unknown_tool');
  });

  it('rejects tools not on scene allowlist', async () => {
    const result = await service.validateAndAudit({
      conversationSessionId: 'conv-1',
      sceneKey: 'talking-light',
      request: {
        name: 'scene_request_event',
        callId: 'x2',
        arguments: { eventId: 'OPEN_CAPSULE' },
      },
    });
    expect(result.validation).toBe('rejected_allowlist');
  });

  it('accepts character_emote on talking-light scene', async () => {
    const result = await service.validateAndAudit({
      conversationSessionId: 'conv-1',
      sceneKey: 'talking-light',
      request: {
        name: 'character_emote',
        callId: 'x3',
        arguments: { emotion: 'happy' },
      },
    });
    expect(result.validation).toBe('accepted');
    expect(prisma.client.agentToolCall.create).toHaveBeenCalled();
  });

  it('scene_request_event only creates pending request on intro scene', async () => {
    const result = await service.validateAndAudit({
      conversationSessionId: 'conv-1',
      sceneKey: 'ship-capsule-intro',
      sceneState: 'POWER_RESTORED',
      request: {
        name: 'scene_request_event',
        callId: 'x4',
        arguments: { eventId: 'OPEN_CAPSULE' },
      },
    });
    expect(result.validation).toBe('accepted');
    expect(result.gamePayload).toMatchObject({ type: 'scene_event_request', status: 'pending' });
  });
});
