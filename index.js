function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function dataGenerator(cb) {
  for (var i=0; i<5; i++) {
    await sleep(1000); // Fetching data from DB...
    try {
      await cb(i);
    }
    catch (e) {
      console.error(e);
    }
  }
}

async function f(data) {
  await sleep(250); // Processing data... (NB: this step would be CPU-intensive in real life)
  return data*data;
}

async function g(data) {
  await sleep(250); // Writing data to DB...
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
  constructor(pipeline, data) {
    this.pipeline = pipeline;
    this.feature = Promise.resolve(data);
  }
  
  pipe(cb, resName, maxConcurrency) {
    this.feature.then(async (value) => {
      if ((this.pipeline.promisesByResName[resName] ?? []).length >= maxConcurrency) {
        const winnerIndex = await Promise.race(this.pipeline.promisesByResName[resName].map(async (promise, index) => {
          await promise;
          return index;
        }));
        this.pipeline.promisesByResName[resName].splice(winnerIndex, 1);
      }
      this.feature = cb(value);
      this.pipeline.promisesByResName[resName] = this.pipeline.promisesByResName[resName] || [];
      this.pipeline.promisesByResName[resName].push(this.feature);
    });
  }
  
  async finish() {
    return this.feature;
  }
}

class Pipeline {
  constructor() {
    this.streams = [];
    this.promisesByResName = {};
  }
  
  async push(data, maxConcurrency) {
    const stream = new Stream(this, data);
    if (this.streams.length >= maxConcurrency) {
      const winnerIndex = await Promise.race(this.streams.map(async (stream, index) => {
        await stream.finish();
        return index;
      }));
      this.streams.splice(winnerIndex, 1);
    }
    this.streams.push(stream);
    return stream;
  }
  
  async finish() {
    for (var stream of this.streams) {
      await stream.finish();
    }
  }
}

async function main_pipeline() {
  const ppl = new Pipeline();
  await dataGenerator(async (data) => {
    const s = await ppl.push(data, 3);
    s.pipe(f, 'transform', 1);
    s.pipe(g, 'db_write');
  });
  await ppl.finish();
}

main_pipeline().then(r => {process.exitCode = r;}).catch(e => {console.error(e); process.exitCode = 1;});
