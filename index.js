const assert = require('node:assert').strict;

class Stream {
  constructor(pipeline) {
    this.pipeline = pipeline;
    this.curStage = null;
  }
  
  releaseCurRes() { // Relinguish the current resource
    if (this.curStage) {
      this.pipeline.numConcurrency[this.curStage]--;
      if (this.pipeline.numConcurrencyDecreasedResolver[this.curStage]) {
        this.pipeline.numConcurrencyDecreasedResolver[this.curStage]();
      }
    }
  }
  
  async stage(stageName, maxConcurrency) {
    assert(maxConcurrency > 0);
    this.releaseCurRes();
    while ((this.pipeline.numConcurrency[stageName] ?? 0) >= maxConcurrency) {
      if (! this.pipeline.numConcurrencyDecreasedResolver[stageName]) {
        this.pipeline.numConcurrencyDecreased[stageName] =
          new Promise((resolve) =>
            this.pipeline.numConcurrencyDecreasedResolver[stageName] = resolve);
      }
      const promise = this.pipeline.numConcurrencyDecreased[stageName];
      await promise;
      if (this.pipeline.numConcurrencyDecreased[stageName] === promise) {
        delete this.pipeline.numConcurrencyDecreasedResolver[stageName];
        delete this.pipeline.numConcurrencyDecreased[stageName];
      }
    }
    this.curStage = stageName;
    this.pipeline.numConcurrency[stageName] = this.pipeline.numConcurrency[stageName] || 0;
    this.pipeline.numConcurrency[stageName]++;
  }
}

class Pipeline {
  constructor(maxNumStreams) {
    this.numStreams = [];
    this.numStreamsDecreased = null;
    this.numStreamsDecreasedResolver = null;
    this.numConcurrency = {};
    this.numConcurrencyDecreased = {};
    this.numConcurrencyDecreasedResolver = {};
    this.maxNumStreams = maxNumStreams;
  }
  
  pipelined(cb, catch_cb) {
    const pipeline = this;
    return async function () {
      const stream = new Stream(pipeline);
      if (pipeline.numStreams >= pipeline.maxNumStreams) {
        if (! pipeline.numStreamsDecreasedResolver) {
          pipeline.numStreamsDecreased =
            new Promise((resolve) =>
              pipeline.numStreamsDecreasedResolver = resolve);
        }
        const promise = pipeline.numStreamsDecreased;
        await promise;
        if (pipeline.numStreamsDecreased === promise) {
          delete pipeline.numStreamsDecreasedResolver;
          delete pipeline.numStreamsDecreased;
        }
      }
      pipeline.numStreams++;
      var asyncPromise = cb.apply(null, [stream, ...arguments]);
      if (catch_cb) {
        asyncPromise = asyncPromise.catch(catch_cb);
      }
      asyncPromise.finally(() => {
        pipeline.numStreams--;
        if (pipeline.numStreamsDecreasedResolver) {
          pipeline.numStreamsDecreasedResolver();
        }
        stream.releaseCurRes();
      });
    };
  }

  async finish() {
    while (this.numStreams > 0) {
      if (! this.numStreamsDecreasedResolver) {
        this.numStreamsDecreased =
          new Promise((resolve) =>
            this.numStreamsDecreasedResolver = resolve);
      }
      const promise = this.numStreamsDecreased;
      await promise;
      if (this.numStreamsDecreased === promise) {
        delete this.numStreamsDecreasedResolver;
        delete this.numStreamsDecreased;
      }
    }
  }
}

module.exports = Pipeline;
