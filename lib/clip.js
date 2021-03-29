import download from './download.js';

/**
 * @param {ClipOptions} options
 * @param {Host} host
 */
async function clip(options, host) {
  await download(options, host);
}

export default clip;
