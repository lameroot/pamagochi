import { mockDialogues } from '../../data/mock-dialogues.js';
import type { DialogueProvider, DialogueRequest, DialogueResponse } from './DialogueProvider.js';

export class MockDialogueProvider implements DialogueProvider {
  async send(request: DialogueRequest): Promise<DialogueResponse> {
    return (
      mockDialogues[request.objectId ?? ''] ?? {
        text: 'Давай осмотрим капсулу вместе.',
        emotion: 'neutral',
        actions: [],
      }
    );
  }
}
