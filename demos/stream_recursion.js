const Pipeline = require('../index.js');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const NUM_DATA = 5;

async function task(stage, ppl, index) {
  await stage('a', 1);
  await sleep(100);
  if (index+1 < NUM_DATA) {
    ppl.pipelined(task)(ppl, index+1); // Do not await here to avoid deadlock
  }
  await stage('b', 3);
  await sleep(100);
  console.log(index);
}

async function main_pipeline() {
  const ppl = new Pipeline(5);
  await ppl.pipelined(task)(ppl, 0);
  await ppl.finish();
}

main_pipeline().then(r => {process.exitCode = r;}).catch(e => {console.error(e); process.exitCode = 1;});

/*

Output:
0
1
2
3
4

Should finish in ~0.6 seconds

*/
