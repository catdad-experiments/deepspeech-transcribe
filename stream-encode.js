/* jshint esversion: 6, node: true */

const Sox = require('sox-stream');

module.exports = () => {
  return Sox({
    global: {
      'no-dither': true,
      guard: true
    },
    output: {
      bits: 16,
      rate: 16000,
      channels: 1,
      encoding: 'signed-integer',
      endian: 'little',
      compression: 0.0,
      type: 'raw'
    }
  });
};
