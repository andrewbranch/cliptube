const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const clip = require('./clip');
const download = require('./download');
const host = require('./nativeHost');
const {
  parseTimestamp,
  assertSuccess,
  or,
  parseDuration,
  validateYouTubeURL,
  getYouTubeIdFromURL,
  assertDefined,
  formatPath,
} = require('./utils');

async function main() {
  while (true) {
    const answers = await inquirer.prompt({
      type: 'list',
      name: 'main',
      message: 'What do you want to do?',
      choices: [
        {
          short: 'Save clips',
          value: 'clip',
          name: 'Extract clips from a YouTube video (downloading if necessary)',
        }, {
          short: 'Download',
          value: 'download',
          name: 'Download a YouTube video',
        },
        new inquirer.Separator(),
        {
          name: 'Exit',
          value: 'exit',
        },
      ],
    });

    switch (answers.main) {
      case 'clip': {
        const url = await promptURL();
        const outDir = await promptOutDir(url, host.config.getOutputDirectory());
        const clips = await promptClipRange().then(promptAdditionalClips);
        if (clips.length) {
          const result = await clip(url, clips, outDir);
        }
        break;
      }
      case 'download': {
        const url = await promptURL();
        const outDir = await promptOutDir(url, host.config.getOutputDirectory());
        const outFilePath = download.getOutFilePath(url, outDir);
        if (!outFilePath.success) {
          host.log.error(chalk.red(outFilePath.diagnostic.message));
          host.log();
          break;
        }
        const overwrite = await host.fs.exists(outFilePath.value) && await promptOverwrite(outFilePath.value);
        const result = await download({ url, outDir, overwrite }, host, download.createInteractiveHandlers(host));
        host.log(); // Space after progress bar
        if (result.success) {
          host.log(chalk.green(`Successfully downloaded ${chalk.dim(formatPath(result.value))}`));
        } else {
          host.log.error(chalk.red(result.diagnostic.message, result.error && result.error.stack || ''));
        }
        host.log();
        break;
      }
      case 'exit':
        return process.exit(0);
      default:
        host.log.error(chalk.red(`Unknown command '${answers.main}'`));
        host.log();
    }
  }
}

/** @returns {Promise<string>} */
async function promptURL() {
  const { url } = await inquirer.prompt({
    type: 'input',
    name: 'url',
    message: 'Full YouTube URL:',
    validate: input => {
      const result = validateYouTubeURL("" + input);
      return result.success || result.diagnostic.message;
    },
  });
  return url;
}

/**
 * @returns {Promise<ClipSelection | undefined>}
 */
async function promptClipRange() {
  const { start, end } = await inquirer.prompt([{
    type: 'input',
    name: 'start',
    message: `Start time for clip (e.g.  ${chalk.underline('11:23')} or ${chalk.underline('1:32:48')}). Leave blank to cancel.`,
    validate: input => {
      if (!input) return true;
      const result = parseTimestamp(input);
      return result.success || result.diagnostic.message;
    },
  }, {
    type: 'input',
    name: 'end',
    message: `End time for clip or length in seconds (e.g. ${chalk.underline('11:28')} or ${chalk.underline('5')}). Leave blank to cancel.`,
    when: answers => answers.start,
    validate: input => {
      if (!input) return true;
      const result = or(() => parseDuration(input), () => parseTimestamp(input));
      return result.success || result.diagnostic.message;
    },
  }]);

  if (!start || !end) return;
  return {
    start: assertSuccess(parseTimestamp(start)).value,
    end: assertSuccess(or(() => parseDuration(end), () => parseTimestamp(end))).value,
  };
}

/**
 * @param {ClipSelection | undefined} clipSelection
 * @returns {Promise<ClipSelection[]>}
 */
async function promptAdditionalClips(clipSelection) {
  if (!clipSelection) return [];
  const clips = [clipSelection];
  while (true) {
    const { more } = await inquirer.prompt({
      type: 'confirm',
      name: 'more',
      message: 'Select another clip?',
    });
    if (!more) break;
    const clip = await promptClipRange();
    if (clip) clips.push(clip);
  }
  return clips;
}

/**
 * @param {string} url
 * @param {string} defaultOutDir
 * @returns {Promise<string>}
 */
async function promptOutDir(url, defaultOutDir) {
  const { outDir } = await inquirer.prompt({
    type: 'input',
    name: 'outDir',
    message: 'Output directory location',
    default: path.join(defaultOutDir, assertDefined(getYouTubeIdFromURL(url))),
  });
  return path.resolve(outDir);
}

/**
 * @param {string} outFilePath
 * @returns {Promise<boolean>}
 */
 async function promptOverwrite(outFilePath) {
  const { overwrite } = await inquirer.prompt({
    type: 'confirm',
    name: 'overwrite',
    message: `${chalk.dim(formatPath(outFilePath))} exists. Overwrite?`,
  });
  return !!overwrite;
}

module.exports = main;
