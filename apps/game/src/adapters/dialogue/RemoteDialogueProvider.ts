import {
  dialogueResponseSchema,
  type DialogueProvider,
  type DialogueRequest,
  type DialogueResponse,
} from './DialogueProvider.js';

/** Network adapter for voice/cloud modes. It is never constructed by mock scenes. */
export class RemoteDialogueProvider implements DialogueProvider {
  constructor(private readonly sendRequest: (request: DialogueRequest) => Promise<unknown>) {}
  async send(request: DialogueRequest): Promise<DialogueResponse> {
    return dialogueResponseSchema.parse(await this.sendRequest(request));
  }
}
