export interface JobDispatchResult {
  jobName: string;
  status: 'completed' | 'failed';
  durationMs: number;
}

export interface JobDispatcher {
  dispatch<TPayload>(jobName: string, payload: TPayload): Promise<JobDispatchResult>;
}

export const JOB_DISPATCHER = Symbol('JOB_DISPATCHER');

export type JobHandler<TPayload = unknown> = (payload: TPayload) => Promise<void> | void;
