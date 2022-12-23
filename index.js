const assert = require('node:assert').strict;

const ref = new Date();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function dataGenerator(cb) {
  for (var i=0; i<4; i++) {
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
  await sleep(100); // Writing data to DB...
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
    this.curResName = null;
  }
  
  releaseCurRes() { // Relinguish the current resource
    if (this.curResName) {
      this.pipeline.numConcurrency[this.curResName]--;
      console.log((new Date()-ref) + ' relinguishing ' + this.curResName + '. current numcon: ' + JSON.stringify(this.pipeline.numConcurrency));
      if (this.pipeline.numConcurrencyDecreasedResolver[this.curResName]) {
        this.pipeline.numConcurrencyDecreasedResolver[this.curResName]();
      }
    }
  }
  
  async alloc(resName, maxConcurrency) {
    assert(maxConcurrency > 0);
    this.releaseCurRes();
    console.log((new Date()-ref) + ' current numcon: ' + JSON.stringify(this.pipeline.numConcurrency));
    console.log((new Date()-ref) + ' requesting to alloc ' + resName);
    while ((this.pipeline.numConcurrency[resName] ?? 0) >= maxConcurrency) {
      if (! this.pipeline.numConcurrencyDecreasedResolver[resName]) {
        this.pipeline.numConcurrencyDecreased[resName] =
          new Promise((resolve) =>
            this.pipeline.numConcurrencyDecreasedResolver[resName] = resolve);
      }
      await this.pipeline.numConcurrencyDecreased[resName];
      if (this.pipeline.numConcurrencyDecreasedResolver[resName]) {
        delete this.pipeline.numConcurrencyDecreasedResolver[resName];
        delete this.pipeline.numConcurrencyDecreased[resName];
      }
    }
    this.curResName = resName;
    this.pipeline.numConcurrency[resName] = this.pipeline.numConcurrency[resName] || 0;
    this.pipeline.numConcurrency[resName]++;
    console.log((new Date()-ref) + ' allocated ' + resName + '. current numcon: ' + JSON.stringify(this.pipeline.numConcurrency));
  }
}

class Pipeline {
  constructor(maxConcurrency) {
    this.numStreams = [];
    this.numStreamsDecreased = null;
    this.numStreamsDecreasedResolver = null;
    this.numConcurrency = {};
    this.numConcurrencyDecreased = {};
    this.numConcurrencyDecreasedResolver = {};
    this.maxConcurrency = maxConcurrency;
  }
  
  stream(cb) {
    const pipeline = this;
    return async function () {
      const stream = new Stream(pipeline);
      if (pipeline.numStreams >= pipeline.maxConcurrency) {
        console.log((new Date()-ref) + ' blocking on new stream creation');
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
      console.log((new Date()-ref) + ' new stream created');
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
  await dataGenerator(ppl.stream(async (s, data) => {
    console.log((new Date()-ref) + ' received ' + data);
    await s.alloc('cpu', 2);
    const res = await f(data);
    console.log((new Date()-ref) + ' processed ' + data + ' result ' + res);
    await s.alloc('db', 2);
    await g(res);
    console.log((new Date()-ref) + ' uploaded ' + data);
  }));
  await ppl.finish();
}

main_pipeline().then(r => {process.exitCode = r;}).catch(e => {console.error(e); process.exitCode = 1;});
