import { describe, expect, it } from 'vitest';
import { SafetyEventService } from './safety-event.service.js';

describe('SafetyEventService', () => {
  it('creates safety event linked to session child', async () => {
    const created = {
      id: 'se1',
      childId: 'child-1',
      conversationSessionId: 'cs1',
      turnId: null,
      category: 'prompt_injection' as const,
      severity: 'medium' as const,
      detectedBy: 'input_safety',
      inputExcerpt: 'ignore instructions',
      actionTaken: 'blocked',
      parentVisible: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const prisma = {
      client: {
        conversationSession: {
          findUnique: async () => ({
            id: 'cs1',
            childId: 'child-1',
            child: { deletedAt: null },
          }),
        },
        safetyEvent: {
          create: async () => created,
        },
      },
    };

    const service = new SafetyEventService(prisma as never);
    const dto = await service.createForSession('cs1', {
      category: 'prompt_injection',
      severity: 'medium',
      detectedBy: 'input_safety',
      inputExcerpt: 'ignore instructions',
      actionTaken: 'blocked',
      parentVisible: true,
    });

    expect(dto.childId).toBe('child-1');
    expect(dto.conversationSessionId).toBe('cs1');
  });
});
