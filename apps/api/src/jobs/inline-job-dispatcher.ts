import { Injectable, Logger } from '@nestjs/common';
import type { JobDispatcher, JobDispatchResult, JobHandler } from './job-dispatcher.js';

/**
 * Executes registered job handlers synchronously, in-process. This is the
 * only background-job mechanism used today — no Redis/BullMQ/worker
 * process. Handlers are registered up front (e.g. in a module's
 * onModuleInit) via `registerHandler`.
 */
@Injectable()
export class InlineJobDispatcher implements JobDispatcher {
  private readonly logger = new Logger(InlineJobDispatcher.name);
  private readonly handlers = new Map<string, JobHandler>();

  registerHandler<TPayload>(jobName: string, handler: JobHandler<TPayload>): void {
    this.handlers.set(jobName, handler as JobHandler);
  }

  async dispatch<TPayload>(jobName: string, payload: TPayload): Promise<JobDispatchResult> {
    const start = Date.now();
    const handler = this.handlers.get(jobName);

    if (!handler) {
      this.logger.warn(`No handler registered for job "${jobName}"`);
      return { jobName, status: 'failed', durationMs: Date.now() - start };
    }

    try {
      await handler(payload);
      return { jobName, status: 'completed', durationMs: Date.now() - start };
    } catch (error) {
      this.logger.error(
        `Job "${jobName}" failed`,
        error instanceof Error ? error.stack : undefined,
      );
      return { jobName, status: 'failed', durationMs: Date.now() - start };
    }
  }
}
