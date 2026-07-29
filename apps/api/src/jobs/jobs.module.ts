import { Global, Module } from '@nestjs/common';
import { InlineJobDispatcher } from './inline-job-dispatcher.js';
import { JOB_DISPATCHER } from './job-dispatcher.js';

@Global()
@Module({
  providers: [InlineJobDispatcher, { provide: JOB_DISPATCHER, useExisting: InlineJobDispatcher }],
  exports: [JOB_DISPATCHER, InlineJobDispatcher],
})
export class JobsModule {}
