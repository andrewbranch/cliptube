import { extname, join, basename } from 'path';
import progress from 'cli-progress';
import TimeFormat from 'hh-mm-ss';
import download, { createInteractiveDownloadHandlers } from './download.js';
import * as Diagnostics from './diagnostics.js';
import { assertDefined, fail, success } from './utils.js';

/**
 * @param {ClipOptions} options
 * @param {Host} host
 * @param {ClipHandlers=} handlers
 * @returns {Promise<Result<{ [key: string]: Result<void> }>>}
 */
export default async function clip(options, host, handlers = {}) {
  const result = await download(options, host, handlers);
  if (!result.success) return result;
  const videoFilename = result.value;
  let clipSuffix = getStartingClipSuffix(await host.fs.readdir(options.outDir));
  /** @type {{ [key: string]: Result<void> }} */
  const results = {};
  for (const selection of options.selections) {
    const start = TimeFormat.fromS(selection.start);
    const end = TimeFormat.fromS(selection.end);
    const outFilename = join(options.outDir, ensureExtension(selection.name || `clip${clipSuffix++}`, '.mp4'));
    try {
      await cutVideo(videoFilename, outFilename, start, end, host, handlers);
      results[outFilename] = success(undefined);
    } catch (error) {
      results[outFilename] = fail(Diagnostics.cutError, error);
    }
  }
  return success(results);
}

/**
 * @param {Host} host
 * @returns {ClipHandlers}
 */
export function createInteractiveClipHandlers(host) {
  const downloadHandlers = createInteractiveDownloadHandlers(host);
  const multibar = new progress.MultiBar({
    format: '[{bar}] {percentage}% | {filename} | {value}/{total}'
  }, progress.Presets.legacy);
  /** @type {Map<string, progress.Bar>} */
  const clips = new Map();
  return {
    ...downloadHandlers,
    onClipStart: (filename, totalMs) => {
      if (!clips.size) {
        host.log();
        host.log('Saving clips...');
      }
      const bar = multibar.create(Math.floor(totalMs / 1000), 0, { filename: basename(filename) });
      clips.set(filename, bar);
    },
    onClipProgress: (filename, encodedMs) => {
      const bar = assertDefined(clips.get(filename));
      bar.update(Math.floor(encodedMs / 1000), { filename: basename(filename) });
    },
    onClipSaved: filename => {
      const bar = assertDefined(clips.get(filename));
      bar.update(bar.getTotal());
      bar.stop();
      clips.delete(filename);
      if (!clips.size) multibar.stop();
    }
  };
}

/**
 * @param {string[]} directoryContents 
 */
function getStartingClipSuffix(directoryContents) {
  return directoryContents.reduce((highest, filename) => {
    if (filename.startsWith('clip') && filename.endsWith('.mp4')) {
      const suffix = parseInt(filename.slice(4, filename.indexOf('.')));
      return suffix > highest ? suffix : highest;
    }
    return highest;
  }, 0) + 1;
}

/**
 * @param {string} filename
 * @param {string} ext
 */
function ensureExtension(filename, ext) {
  return extname(filename) === ext ? filename : filename + ext;
}

/**
 * @param {string} inFilename
 * @param {string} outFilename
 * @param {string} start
 * @param {string} end
 * @param {Host} host
 * @param {ClipHandlers | undefined} handlers
 */
function cutVideo(inFilename, outFilename, start, end, { ffmpeg }, handlers) {
  // @ts-expect-error
  const totalMs = TimeFormat.toMs(end) - TimeFormat.toMs(start);
  const adjustedEnd = TimeFormat.fromMs(totalMs);
  const input = new ffmpeg.FFmpegInput(inFilename, new Map([
    ['ss', start],
  ]));
  const output = new ffmpeg.FFmpegOutput(outFilename, new Map([
    ['to', adjustedEnd],
    ['n', /** @type {any} */ (undefined)],
  ]));
  const cmd = new ffmpeg.FFmpegCommand();
  cmd.addInput(input);
  cmd.addOutput(output);
  return new Promise((resolve, reject) => {
    cmd.on('update', (/** @type {any} */ data) => handlers?.onClipProgress?.(outFilename, data.out_time_ms));
    cmd.on('success', resolve);
    cmd.on('error', reject);
    handlers?.onClipStart?.(outFilename, totalMs);
    cmd.spawn();
  }).finally(() => {
    handlers?.onClipSaved?.(outFilename);
  });
}
