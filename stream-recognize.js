/* jshint esversion: 6, node: true */

const through = require('through2');
const deepspeech = require('deepspeech');

const createLogger = (log) => {
  return (...args) => log ? console.log(...args) : null;
};

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

module.exports = ({ model, alphabet, lm = null, trie = null }, { log = false, projectedBytes = 1 } = {}) => {
  const logger = createLogger(log);

  const dsModel = new deepspeech.Model(model, N_FEATURES, N_CONTEXT, alphabet, BEAM_WIDTH);

  if (lm && trie) {
    dsModel.enableDecoderWithLM(alphabet, lm, trie, LM_ALPHA, LM_BETA);
  }

  const sctx = dsModel.setupStream(150, 16000);
  let totalBytes = 0;
  let lastLog = Date.now();

  return through(function onData(chunk, enc, cb) {
    totalBytes += chunk.length;

    if (Date.now() - lastLog > 1000 * 30) {
      logger(`${(new Date()).toISOString()} current total: ${totalBytes} of ${projectedBytes | 1}, ${(totalBytes / projectedBytes * 100).toFixed(2)}%`);
      lastLog = Date.now();
    }

    dsModel.feedAudioContent(sctx, chunk.slice(0, chunk.length / 2));

    cb();
  }, function onEnd(cb) {
    logger(`finished reading ${totalBytes} bytes of projected ${projectedBytes | 1} bytes`);

    const output = dsModel.finishStream(sctx);

    cb(null, output);
  });
};
