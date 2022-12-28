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

async function main_naive() {
  for (var i=0; i<NUM_DATA; i++) {
    try {
      const res = await f(i);
      console.log(res);
    }
    catch (e) {
      await sleep(500);
      console.error(e);
    }
  };
}

async function main_pipeline() {
  const ppl = new Pipeline(3);
  for (var i=0; i<NUM_DATA; i++) {
    await (ppl.pipelined(async (stage, i) => {
      await stage('a', 1);
      const res = await f(i);
      console.log(res);
    }, async (e) => {
      await sleep(500);
      console.error(e);
    })(i));
  }
  await ppl.finish();
}

main_pipeline().then(r => {process.exitCode = r;}).catch(e => {console.error(e); process.exitCode = 1;});

/*

Output:
0
4
Oh no! Exception
16
Oh no! Exception

Should finish in ~1.5 seconds

*/
