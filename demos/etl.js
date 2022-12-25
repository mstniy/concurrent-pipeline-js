const Pipeline = require('../index.js');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function extract(index) {
  await sleep(100); // Reading data from DB...
  return 2*index+1;
}

async function transform(data) {
  await sleep(300); // NB: this step would be CPU-intensive in a real application
  return data*data;
}

async function load(data) {
  await sleep(200); // Writing data to DB...
  console.log(data);
}

const NUM_DATA = 5;

async function main_naive() {
  for (var i=0; i<NUM_DATA; i++) {
    const data = await extract(i);
    const res = await transform(data);
    await load(res);
  };
}

async function main_pipeline() {
  const ppl = new Pipeline(5);
  for (var i=0; i<NUM_DATA; i++) {
    await (ppl.pipelined(async (stage, i) => {
      await stage('extract', 2);
      const data = await extract(i);
      await stage('transform', 1);
      const res = await transform(data);
      await stage('load', 2);
      await load(res);
    })(i));
  }
  await ppl.finish();
}

main_pipeline().then(r => {process.exitCode = r;}).catch(e => {console.error(e); process.exitCode = 1;});
