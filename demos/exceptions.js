const Pipeline = require('../index.js');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function f(index) {
  await sleep(100);
  if (index % 2) {
    throw 'Oh no! Exception';
  }
  return index*index;
}

const NUM_DATA = 5;

async function main_naive() {
  for (var i=0; i<NUM_DATA; i++) {
    try {
      const res = await f(i);
      console.log(res);
    }
    catch (e) {
      console.error(e);
    }
  };
}

async function main_pipeline() {
  const ppl = new Pipeline(3);
  for (var i=0; i<NUM_DATA; i++) {
    await (ppl.pipelined(async (stage, i) => {
      const res = await f(i);
      console.log(res);
    }, (e) => {
      console.error(e);
    })(i));
  }
  await ppl.finish();
}

main_pipeline().then(r => {process.exitCode = r;}).catch(e => {console.error(e); process.exitCode = 1;});
