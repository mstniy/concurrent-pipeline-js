const assert = require('node:assert').strict;

const ref = new Date();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function dataGenerator(cb) {
  for (var i=0; i<5; i++) {
    await sleep(100); // Fetching data from DB...
    try {
      await cb(i);
    }
    catch (e) {
      console.error(e);
    }
    //await sleep(100000); // Fetching data from DB...
  }
}

async function f(data) {
  await sleep(300); // Processing data... (NB: this step would be CPU-intensive in real life)
  return data*data;
}

async function g(data) {
  await sleep(200); // Writing data to DB...
  console.log(data);
}

async function main_naive() {
  await dataGenerator(async (data) => {
    const res = await f(data);
    await g(res);
  });
}

// ---------------------------------------------------------------------

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
      await this.pipeline.numConcurrencyDecreased[stageName];
      if (this.pipeline.numConcurrencyDecreasedResolver[stageName]) {
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
  
  pipelined(cb) {
    const pipeline = this;
    return async function () {
      const stream = new Stream(pipeline);
      if (pipeline.numStreams >= pipeline.maxNumStreams) {
        if (! pipeline.numStreamsDecreasedResolver) {
          pipeline.numStreamsDecreased =
            new Promise((resolve) =>
              pipeline.numStreamsDecreasedResolver = resolve);
        }
        await pipeline.numStreamsDecreased;
        if (pipeline.numStreamsDecreasedResolver) {
          delete pipeline.numStreamsDecreasedResolver;
          delete pipeline.numStreamsDecreased;
        }
      }
      pipeline.numStreams++;
      cb.apply(null, [stream, ...arguments]).then(() => {
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
      await this.numStreamsDecreased;
      if (this.numStreamsDecreasedResolver) {
        delete this.numStreamsDecreasedResolver;
        delete this.numStreamsDecreased;
      }
    }
  }
}

async function main_pipeline() {
  const ppl = new Pipeline(4);
  await dataGenerator(ppl.pipelined(async (s, data) => {
    await s.stage('process', 2);
    const res = await f(data);
    await s.stage('db push', 2);
    await g(res);
  }));
  await ppl.finish();
}

main_pipeline().then(r => {process.exitCode = r;}).catch(e => {console.error(e); process.exitCode = 1;});
