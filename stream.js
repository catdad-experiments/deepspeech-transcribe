#!/usr/bin/env node

/* jshint esversion: 6 */

//
// node stream.js --model models/output_graph.pbmm --alphabet models/alphabet.txt --lm models/lm.binary --trie models/trie --audio test.wav
//
// 0.3.0 output: missus disparinasentes a i had recorded hat i can test the thimg
// 0.4.0 output: missus displeasant as i had recorded that i can test the thing
//

const fs = require('fs');
const util = require('util');

const deepspeech = require('deepspeech');
const Wav = require('node-wav');

const encode = require('./stream-encode.js');
const recognize = require('./stream-recognize.js');


if (process.argv.includes('-v') || process.argv.includes('--version')) {
  deepspeech.printVersions();
  console.log(`${require('./package.json').name}: v${require('./package.json').version}`);
  process.exit(0);
}

const argv = require('yargs')
  .option('model', {
    demandOption: true,
    description: 'Path to the model (protocol buffer binary file)',
    type: 'string'
  })
  .option('alphabet', {
    demandOption: true,
    description: 'Path to the configuration file specifying the alphabet used by the network',
    type: 'string'
  })
  .option('lm', {
    description: 'Path to the language model binary file',
    type: 'string'
  })
  .option('trie', {
    description: 'Path to the language model trie file created with native_client/generate_trie',
    type: 'string'
  })
  .option('audio', {
    demandOption: true,
    description: 'Path to the audio file to run (WAV format)'
  })
  .version(false)
  .help('h')
  .argv;

function getSampleRate() {
  const buffer = fs.readFileSync(argv.audio);
  const result = Wav.decode(buffer);

  return { sampleRate: result.sampleRate, bytes: buffer.length };
}

const { sampleRate, bytes } = getSampleRate();

if (sampleRate < 16000) {
  console.error('Warning: original sample rate (' + sampleRate + ') is lower than 16kHz. Up-sampling might produce erratic speech recognition.');
}

// why divided by 2?
const projectedBytes = bytes * 16000 / sampleRate / 2;
let totalBytes = 0;
let lastLog = Date.now();

console.time('Done in');

fs.createReadStream(argv.audio)
  .pipe(encode())
  .on('error', err => console.log(1, err))
  .pipe(recognize(argv, { log: true, projectedBytes }))
  .on('error', err => console.log(2, err))
  .on('data', chunk => {
    console.log('------------------------------------------------');
    console.log(chunk.toString());
    console.log('------------------------------------------------');
  })
  .on('end', () => {
    console.timeEnd('Done in');
  });
