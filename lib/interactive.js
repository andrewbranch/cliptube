import { join, resolve } from 'path';
import boxen from 'boxen';
import progress from 'cli-progress';
import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import clip, { createInteractiveClipHandlers } from './clip.js';
import download, { getOutFilePath, createInteractiveDownloadHandlers } from './download.js';
import update from './update.js';
import createHost from './nativeHost.js';
import {
  parseTimestamp,
  assertSuccess,
  validateYouTubeURL,
  getYouTubeIdFromURL,
  assertDefined,
  formatPath,
} from './utils.js';

export default async function main() {
  const host = createHost();
  let { updateAvailable } = await setup(host);

  while (true) {
    host.log();
    const answers = await inquirer.prompt({
      type: 'list',
      name: 'main',
      message: 'What do you want to do?',
      choices: [
        ...updateAvailable ? [{
          short: 'Install update',
          value: 'update',
          name: `Install update (${updateAvailable})`
        }] : [],
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
      case 'update': {
        const result = await update({ force: true, shouldInstall: () => true }, host);
        if (result.success) {
          if (result.value) {
            host.log(chalk.green(`Successfully installed cliptube ${result.value}`));
            process.exit(0);
          } else {
            host.log(`No update was available. You are running the latest version of cliptube.`);
            updateAvailable = undefined;
          }
        } else {
          host.log.error(chalk.red(result.diagnostic.message, result.error?.stack || ''));
          process.exit(result.diagnostic.code);
        }
      }
      case 'clip': {
        const url = await promptURL();
        const outDir = await promptOutDir(url, host.config.getOutputDirectory());
        const clips = await promptClipRange().then(clips => promptAdditionalClips(clips, host));
        if (clips.length) {
          const result = await clip({ url, selections: clips, outDir }, host, createInteractiveClipHandlers(host));
          if (!result.success) {
            host.log.error(chalk.red(result.diagnostic.message, result.error?.stack || ''));
            process.exit(result.diagnostic.code);
          }
          host.log();
          for (const filename in result.value) {
            const fileResult = result.value[filename];
            const icon = fileResult.success ? chalk.green('✔︎') : chalk.red('✘');
            host.log(`${icon} ${formatPath(filename)}`);
            if (!fileResult.success) {
              host.log.error(chalk.red(fileResult.diagnostic.message, fileResult.error?.message || ''));
              host.log();
            }
          }
        }
        break;
      }
      case 'download': {
        const url = await promptURL();
        const outDir = await promptOutDir(url, host.config.getOutputDirectory());
        const outFilePath = getOutFilePath(url, outDir);
        if (!outFilePath.success) {
          host.log.error(chalk.red(outFilePath.diagnostic.message));
          break;
        }
        const overwrite = await host.fs.exists(outFilePath.value) && await promptOverwrite(outFilePath.value);
        const result = await download({ url, outDir, overwrite }, host, createInteractiveDownloadHandlers(host));
        host.log(); // Space after progress bar
        if (result.success) {
          host.log(chalk.green(`Successfully downloaded ${chalk.dim(formatPath(result.value))}`));
        } else {
          host.log.error(chalk.red(result.diagnostic.message, result.error?.stack || ''));
        }
        break;
      }
      case 'exit':
        return process.exit(0);
      default:
        host.log.error(chalk.red(`Unknown command '${answers.main}'`));
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
    message: `Start time for clip (e.g. ${chalk.underline('11:23')} or ${chalk.underline('1:32:48')}). Leave blank to cancel.`,
    validate: input => {
      if (!input) return true;
      const result = parseTimestamp(input);
      return result.success || result.diagnostic.message;
    },
  }, {
    type: 'input',
    name: 'end',
    message: `End time for clip (e.g. ${chalk.underline('11:28')}). Leave blank to cancel.`,
    when: answers => answers.start,
    validate: input => {
      if (!input) return true;
      const result = parseTimestamp(input);
      return result.success || result.diagnostic.message;
    },
  }]);

  if (!start || !end) return;
  return {
    start: assertSuccess(parseTimestamp(start)).value,
    end: assertSuccess(parseTimestamp(end)).value,
  };
}

/**
 * @param {ClipSelection | undefined} clipSelection
 * @param {Host} host
 * @returns {Promise<ClipSelection[]>}
 */
async function promptAdditionalClips(clipSelection, host) {
  if (!clipSelection) return [];
  const clips = [clipSelection];
  while (true) {
    const { more } = await inquirer.prompt({
      type: 'confirm',
      name: 'more',
      message: 'Select another clip?',
    });
    if (!more) break;
    host.log();
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
    default: join(defaultOutDir, assertDefined(getYouTubeIdFromURL(url))),
  });
  return resolve(outDir);
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

/**
 * @param {string[]} components 
 */
async function promptInstall(components) {
  const { install } = await inquirer.prompt({
    type: 'confirm',
    name: 'install',
    message: `${components.join(' and ')} ${components.length > 1 ? 'are' : 'is'} required. Install ${components.length > 1 ? 'them' : 'it'} now?`,
  });
  return !!install;
}

function createFFMpegInstallHandler() {
  /** @type {Map<string, number>} */
  const downloads = new Map();
  const bar = new progress.SingleBar({}, progress.Presets.legacy);
  return { onProgress, onDone };
  /**
   * @param {{ filename: string, progress: number}} data
   */
  function onProgress({ filename, progress }) {
    if (!downloads.size) {
      bar.start(100, 0);
    }
    if (!downloads.has(filename)) {
      bar.setTotal((downloads.size + 1) * 100);
    }
    downloads.set(filename, progress * 100);
    bar.update(Array.from(downloads.values()).reduce((sum, val) => sum + val, 0));
  }
  function onDone() {
    bar.update(bar.getTotal());
    bar.stop();
  }
}

/**
 * @param {Host} host
 * @returns {Promise<string | undefined>}
 */
async function checkForUpdate(host) {
  /** @type {string | undefined} */
  let updateAvailable = undefined;
  await update({
    force: false,
    shouldInstall: async (version, _, releaseNotes) => {
      host.log(chalk.bold(chalk.green('An update is available!')));
      host.log(`${host.version} → ${version}`);
      host.log();
      if (releaseNotes) {
        host.log(boxen(releaseNotes, { padding: 1, dimBorder: true }));
        host.log();
      }
      host.log(`Select ${chalk.cyan(chalk.underline('Install update'))} from the menu to install now.`);
      updateAvailable = version;
      return false;
    }
  }, host);
  return updateAvailable;
}

/** @param {Host} host */
async function setup(host) {
  // Install ffmpeg and ffprobe if needed
  const { onProgress, onDone } = createFFMpegInstallHandler();
  const installResult = await host.ffmpeg.ensureInstalled(promptInstall, onProgress);
  onDone();

  if (!installResult.success) {
    host.log.error(chalk.red(installResult.diagnostic.message, installResult.error?.message || ''));
    process.exit(installResult.diagnostic.code);
  }
  if (!installResult.value) {
    host.log('Cannot proceed without ffmpeg/ffprobe; exiting.');
    process.exit(0);
  }
  if (Array.isArray(installResult.value)) {
    host.log();
    host.log(chalk.green('Successfully installed binaries:'));
    for (const result of installResult.value) {
      host.log(` - ${chalk.dim(join(result.path, result.filename))}`);
    }
  }

  // Check for update
  const updateAvailable = await checkForUpdate(host);

  if (!updateAvailable) {
    // Ensure ytdl-core is installed
    /** @type {ora.Ora | undefined} */
    let spinner;
    await host.ytdl.ensureInstalled(() => {
      host.log();
      spinner = ora('Updating YouTube client').start();
    });
    spinner?.stopAndPersist({ symbol: chalk.green('✔︎') });
  }

  return { updateAvailable };
}
