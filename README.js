# concurrent-pipeline-js
Painless concurrent pipelines for Node.js

Easily create concurrent pipelines for faster applications.

### Terminology

A _pipeline_ has _streams_, and each _stream_ progresses through a number of _stages_.

### Usage

It all starts by creating a `Pipeline`:

    const ppl = new Pipeline(5);

The argument passed to `Pipeline` controls the maximum number of streams that can ever exist concurrently. This allows easy implementation of back pressure.

To start a new `Stream`, pass your code to  `Pipeline.pipelined` and `await` on the function it returns:

    await ppl.pipelined(async (stage, ...your args) => {
      ... your code here
    }(... your pipeline args);
    
| :warning: Make sure the data belonging to the stream is passed as arguments, as in the snippet above, to make sure different streams do not share the same data. |
|-----------------------------------------|

Inside the stream code, you can define stages:

    await stage('process data', 3);
    
Diving the work into stages allows you to set different concurrency limits to different stages, in this snippet, 3.

Finally, to block execution until all the streams in the pipeline have finished:

    await ppl.finish();

