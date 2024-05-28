type Stage = (name: string, concurrency: number) => Promise<void>;

export class PipelineExceptions extends Array {}

export class Pipeline {
  constructor(concurrency: number);
  pipelined<T, R>(
    cb: (stage: Stage, ...params: T) => Promise<R>
  ): (...params: T) => Promise<void>;
  finish(): Promise<void>;

  exceptions: PipelineExceptions;
}

export = Pipeline;
