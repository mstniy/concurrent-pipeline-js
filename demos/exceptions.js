const Pipeline = require('../index.js');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function f(index) {
  await sleep(250);
  if (index % 2) {
    throw 'Oh no! Exception';
  }
  return index*index;
}

const NUM_DATA = 5;

async function main_pipeline() {
  const ppl = new Pipeline(3);
  for (var i=0; i<NUM_DATA; i++) {
    await (ppl.pipelined(async (stage, i) => {
      const res = await f(i);
      console.log(res);
    })(i));
  }
  await ppl.finish();
}

main_pipeline().then(r => {process.exitCode = r;}).catch(e => {console.error(e); process.exitCode = 1;});

/*

Output:
0
4
PipelineExceptions(2) [
  { stageId: 1, exception: 'Oh no! Exception' },
  { stageId: 3, exception: 'Oh no! Exception' }
]

Should finish in ~0.5 seconds

*/
