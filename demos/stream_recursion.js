const Pipeline = require('../index.js');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const NUM_DATA = 5;

async function task(stage, ppl, index) {
  await sleep(100);
  console.log(index);
  if (index < NUM_DATA) {
    ppl.pipelined(task)(ppl, index+1); // Do not await here to avoid deadlock
  }
}

async function main_pipeline() {
  const ppl = new Pipeline(1);
  await ppl.pipelined(task)(ppl, 0);
  await ppl.finish();
}

main_pipeline().then(r => {process.exitCode = r;}).catch(e => {console.error(e); process.exitCode = 1;});
