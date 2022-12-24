const Pipeline = require('../index.js');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function dataGenerator(cb) {
  for (var i=0; i<5; i++) {
    await sleep(100); // Fetching data from DB...
    await cb(i);
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
