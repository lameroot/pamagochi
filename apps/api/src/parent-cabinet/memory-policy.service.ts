import { BadRequestException, Injectable } from '@nestjs/common';
import { memoryPolicyValidator } from '@pamagochi/agent-core';
import type { MemoryCategory } from '@pamagochi/contracts';

export interface MemoryPolicyInput {
  category: MemoryCategory;
  fact: string;
  source: 'parent' | 'automatic';
}

@Injectable()
export class MemoryPolicyService {
  validate(input: MemoryPolicyInput): void {
    if (input.source === 'parent' && input.category !== 'parent_note') {
      throw new BadRequestException('Parents may only create parent_note memories');
    }

    const result = memoryPolicyValidator.validate(
      {
        category: input.category,
        fact: input.fact,
        confidence: input.source === 'parent' ? 1 : 0.85,
        sourceTurnIds: [],
        rationale: input.source === 'parent' ? 'parent provided' : 'automatic',
      },
      { existingFacts: [], childTurnTexts: input.source === 'parent' ? [input.fact] : [] },
    );

    if (!result.accepted) {
      throw new BadRequestException(
        result.rejectionReason ?? 'Memory fact contains disallowed content',
      );
    }
  }
}
