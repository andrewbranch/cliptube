const chalk = require('chalk');
const progress = require('cli-progress');
const download = require('./download');

/**
 * @param {ClipOptions} options
 * @param {Host} host
 */
async function clip(options, host) {
  await download(options, host);
}

module.exports = clip;
