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
const Duplex = require('stream').Duplex;

const argparse = require('argparse');
const deepspeech = require('deepspeech');
const MemoryStream = require('memory-stream');
const Wav = require('node-wav');

const encode = require('./stream-encode.js');

// These constants control the beam search decoder

// Beam width used in the CTC decoder when building candidate transcriptions
const BEAM_WIDTH = 500;

// The alpha hyperparameter of the CTC decoder. Language Model weight
const LM_ALPHA = 0.75;

// The beta hyperparameter of the CTC decoder. Word insertion bonus.
const LM_BETA = 1.85;

// These constants are tied to the shape of the graph used (changing them changes
// the geometry of the first layer), so make sure you use the same constants that
// were used during training

// Number of MFCC features to use
const N_FEATURES = 26;

// Size of the context window used for producing timesteps in the input vector
const N_CONTEXT = 9;

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

function totalTime(hrtimeValue) {
  return (hrtimeValue[0] + hrtimeValue[1] / 1000000000).toPrecision(4);
}

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

function setupModel() {
  const model = new deepspeech.Model(args.model, N_FEATURES, N_CONTEXT, args.alphabet, BEAM_WIDTH);

  if (args.lm && args.trie) {
    console.error('Loading language model from files %s %s', args.lm, args.trie);
    const lm_load_start = process.hrtime();
    model.enableDecoderWithLM(args.alphabet, args.lm, args.trie, LM_ALPHA, LM_BETA);
    const lm_load_end = process.hrtime(lm_load_start);
    console.error('Loaded language model in %ds.', totalTime(lm_load_end));
  }

  return model;
}

const model = setupModel();
const sctx = model.setupStream(150, 16000);
const projectedBytes = bytes * 16000 / sampleRate;
let totalBytes = 0;
let lastLog = Date.now();

fs.createReadStream(args.audio)
  .pipe(encode())
  .on('error', err => {
    console.log('ERROR:', err);
  })
  .on('data', chunk => {
    totalBytes += chunk.length;

    if (Date.now() - lastLog > 1000 * 30) {
      console.log(`${(new Date()).toISOString()} current total: ${totalBytes} of ${projectedBytes | 1}, ${(totalBytes / projectedBytes).toFixed(2)}%`);
      lastLog = Date.now();
    }

    model.feedAudioContent(sctx, chunk.slice(0, chunk.length / 2));
  })
  .on('finish', () => {
    console.log('finish, total bytes', totalBytes);
    const output = model.finishStream(sctx);

    console.log('------------------------------------------------------');
    console.log(output);
  //  processSplit(model, audioBuffer.slice(0, audioBuffer.length / 2));
    console.log('------------------------------------------------------');
  });


function processSplit(model, buffer) {
  const rate = 16000;
  let copy = Buffer.concat([buffer]);

  while (copy.length) {
    console.log(model.stt(copy.slice(0, rate * 5), rate));
    copy = copy.slice(rate * 5);
  }
}
