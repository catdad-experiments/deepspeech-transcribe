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

const argparse = require('argparse');
const deepspeech = require('deepspeech');
const Wav = require('node-wav');

const encode = require('./stream-encode.js');
const recognize = require('./stream-recognize.js');

var VersionAction = function VersionAction(options) {
  options = options || {};
  options.nargs = 0;
  argparse.Action.call(this, options);
};
util.inherits(VersionAction, argparse.Action);

VersionAction.prototype.call = function(parser) {
  deepspeech.printVersions();
  process.exit(0);
};

var parser = new argparse.ArgumentParser({addHelp: true, description: 'Running DeepSpeech inference.'});
parser.addArgument(['--model'], {required: true, help: 'Path to the model (protocol buffer binary file)'});
parser.addArgument(['--alphabet'], {required: true, help: 'Path to the configuration file specifying the alphabet used by the network'});
parser.addArgument(['--lm'], {help: 'Path to the language model binary file', nargs: '?'});
parser.addArgument(['--trie'], {help: 'Path to the language model trie file created with native_client/generate_trie', nargs: '?'});
parser.addArgument(['--audio'], {required: true, help: 'Path to the audio file to run (WAV format)'});
parser.addArgument(['--version'], {action: VersionAction, help: 'Print version and exits'});
var args = parser.parseArgs();

function getSampleRate() {
  const buffer = fs.readFileSync(args.audio);
  const result = Wav.decode(buffer);

  console.log('original total bytes:', buffer.length);
  console.log('original sample rate:', result.sampleRate);

  return { sampleRate: result.sampleRate, bytes: buffer.length };
}

const { sampleRate, bytes } = getSampleRate();

if (sampleRate < 16000) {
  console.error('Warning: original sample rate (' + sampleRate + ') is lower than 16kHz. Up-sampling might produce erratic speech recognition.');
}

const projectedBytes = bytes * 16000 / sampleRate;
let totalBytes = 0;
let lastLog = Date.now();

fs.createReadStream(args.audio)
  .pipe(encode())
  .on('error', err => console.log(1, err))
  .pipe(recognize(args, { log: true, projectedBytes }))
  .on('error', err => console.log(2, err))
  .on('data', chunk => {
    console.log('------------------------------------------------');
    console.log(chunk.toString());
    console.log('------------------------------------------------');
  })
  .on('end', () => {
    console.log('done');
  });
