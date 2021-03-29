import chalk from 'chalk';
import Yargs from 'yargs';
import download from './lib/download.js';
import interactive from './lib/interactive.js';
import createHost from './lib/nativeHost.js';
import { validateYouTubeURL } from './lib/utils.js';

// @ts-ignore
const yargs = /** @type {typeof import('yargs')} */ (Yargs(process.argv.slice(2)));

const url = {
  type: /** @type {'string'}*/ ('string'),
  required: /** @type {true} */ (true),
  description: 'The full YouTube URL of the video to clip',
};

const outDir = {
  type: /** @type {'string'} */ ('string'),
  description: 'Directory to save clips',
  normalize: true,
};

const compress = {
  type: /** @type {'boolean'} */ ('boolean'),
  default: true,
  description: 'Compresses clips before saving',
};

const overwrite = {
  type: /** @type {'boolean'} */ ('boolean'),
  description: 'Overwrite existing video file',
};

const downloadOptions = {
  outDir,
  overwrite,
};

yargs
  .scriptName('splyt')
  .usage('Tools for processing YouTube videos')
  .command('start', 'Launch interactive mode', {}, interactive)
  .command('clip <url> <clips>', 'Save clips from a video', yargs => {
    
    return yargs
      .positional('url', url)
      .positional('clips', {
        type: 'string',
        description: 'Comma-separated list of clip ranges to save, e.g. `23:42-23:57,32:08-33:17`',
      })
      .options(downloadOptions);
  }, argv => {
    argv
  })
  .command('download <url>', 'Download a video', yargs => {
    return yargs
      .positional('url', url)
      .options(downloadOptions)
  }, argv => {
    const urlValidation = validateYouTubeURL(argv.url);
    if (!urlValidation.success) {
      console.error(chalk.red(urlValidation.diagnostic.message));
      process.exit(urlValidation.diagnostic.code);
    }

    return download({
      url: argv.url,
      outDir: argv.outDir || urlValidation.value,
      overwrite: argv.overwrite,
    }, createHost());
  })
  .demandCommand(1, '')
  .recommendCommands()
  .strict()
  .help()
  .argv;
