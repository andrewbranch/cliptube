const path = require('path');
const chalk = require('chalk');
const progress = require('cli-progress');
const Diagnostics = require('./diagnostics');
const { success, fail, getYouTubeIdFromURL } = require('./utils');
const { pipeline } = require('stream');

/**
 * @param {DownloadOptions} options
 * @param {Host} host
 * @param {DownloadHandlers=} handlers
 * @returns {Promise<Result<string>>} Path to downloaded video
 */
async function download({ url, outDir, overwrite }, host, handlers = {}) {
  const { fs, net } = host;
  const id = getYouTubeIdFromURL(url);
  if (!id) return Promise.resolve(fail(Diagnostics.noIdInUrl));
  
  await fs.mkdirp(outDir);
  const outFile = path.resolve(outDir, `${id}.mp4`);
  if (!overwrite && await fs.exists(outFile)) return success(outFile);
  const info = await net.getYouTubeInfo(url);
  const formats = selectFormats(info.formats);
  if (!formats) {
    return fail(Diagnostics.noVideoFormat);
  }

  if (handlers && handlers.onInfo) {
    handlers.onInfo(info, formats);
  }

  if (formats.length === 2) {
    const tmpVideo = path.resolve(outDir, `${id}-video.mp4`);
    const tmpAudio = path.resolve(outDir, `${id}-audio.${formats[1].container}`);
    const [onVideoProgress, onAudioProgress] = handlers && handlers.onDownloadProgress ? splitProgressHandler(handlers.onDownloadProgress) : [];
    try {
      const [videoResult, audioResult] = await Promise.all([
        downloadFormat(info, formats[0], tmpVideo, host, onVideoProgress),
        downloadFormat(info, formats[1], tmpAudio, host, onAudioProgress),
      ]);
      if (!videoResult.success) return videoResult;
      if (!audioResult.success) return audioResult;
    } finally {
      if (handlers && handlers.onDownloaded) {
        handlers.onDownloaded();
      }
    }

    try {
      const durationMs = parseInt(info.videoDetails.lengthSeconds, 10) * 1000;
      await mergeStreams(tmpVideo, tmpAudio, outFile, durationMs, host, handlers);
      return success(outFile);
    } catch (error) {
      return fail(Diagnostics.mergeError, error instanceof Error ? error : undefined);
    }
  }

  const result = await downloadFormat(info, formats[0], outFile, host, handlers && handlers.onDownloadProgress);
  if (handlers && handlers.onDownloaded) {
    handlers.onDownloaded();
  }
  return result;
}

/**
 * @param {string} url 
 * @param {string} outDir
 */
function getOutFilePath(url, outDir) {
  const id = getYouTubeIdFromURL(url);
  if (!id) return fail(Diagnostics.noIdInUrl);
  return success(path.resolve(outDir, `${id}.mp4`));
}

/**
 * @param {VideoFormat[]} formats
 * @returns {[VideoFormat] | [VideoFormat, VideoFormat] | undefined}
 */
function selectFormats(formats) {
  const bestVideo = formats.reduce((best, f) => {
    if (!f.hasVideo || f.container !== 'mp4') return best;
    if (!best) return f;
    const p = parseInt(f.qualityLabel.split('p')[0], 10);
    const pBest = parseInt(best.qualityLabel.split('p')[0], 10);
    if (!p || !pBest) return pBest ? best : p ? f : undefined;
    if (p > pBest) return f;
    if (pBest > p) return best;
    if (f.hasAudio && !best.hasAudio) return f;
    return best;
  }, /** @type {VideoFormat | undefined } */ (undefined));

  if (!bestVideo || bestVideo.hasAudio) return bestVideo && [bestVideo];
  const bestAudio = formats.reduce((best, f) => {
    if (!f.hasAudio) return best;
    if (!best) return f;
    if (best.hasVideo && !f.hasVideo) return f;
    if (f.hasVideo && !best.hasVideo) return best;
    if (best.audioBitrate && f.audioBitrate) return best.audioBitrate > f.audioBitrate ? best : f;
    if (best.audioBitrate && !f.audioBitrate) return best;
    if (!best.audioBitrate && f.audioBitrate) return f;
    if (best.audioQuality && f.audioQuality) return f.audioQuality === 'AUDIO_QUALITY_MEDIUM' ? f : best;
    return best;
  }, /** @type {VideoFormat | undefined } */ (undefined));

  if (!bestAudio) return [bestVideo];
  return [bestVideo, bestAudio];
}

/**
 * @param {VideoInfo} info
 * @param {VideoFormat} format
 * @param {string} outFilePath
 * @param {Host} host
 * @param {((downloaded: number, total: number) => void) | undefined} onProgress
 * @returns {Promise<Result<string>>}
 */
function downloadFormat(info, format, outFilePath, { net, fs }, onProgress) {
  return new Promise(resolve => {
    const downloadStream = net.downloadYouTubeVideo(info, format);
    downloadStream.on('progress', (_chunkLength, downloaded, total) => {
      if (onProgress) {
        onProgress(downloaded, total);
      }
    });

    pipeline(
      downloadStream,
      fs.createWriteStream(outFilePath),
      error => resolve(error ? fail(Diagnostics.downloadError, error) : success(outFilePath)));
  });
}

/**
 * @param {(downloaded: number, total: number) => void} onProgress
 * @returns {[(downloaded: number, total: number) => void, (downloaded: number, total: number) => void]}
 */
function splitProgressHandler(onProgress) {
  let total1 = 0;
  let total2 = 0;
  let downloaded1 = 0;
  let downloaded2 = 0;
  return [onProgress1, onProgress2];
  
  /**
   * @param {number} downloaded
   * @param {number} total
   */
  function onProgress1(downloaded, total) {
    downloaded1 = downloaded;
    total1 = total;
    onProgress(downloaded1 + downloaded2, total1 + total2);
  }
  /**
   * @param {number} downloaded
   * @param {number} total
   */
   function onProgress2(downloaded, total) {
    downloaded2 = downloaded;
    total2 = total;
    onProgress(downloaded1 + downloaded2, total1 + total2);
  }
}

/**
 * @param {string} videoPath
 * @param {string} audioPath
 * @param {string} outPath
 * @param {number} durationMs
 * @param {Host} host
 * @param {DownloadHandlers=} handlers
 */
function mergeStreams(videoPath, audioPath, outPath, durationMs, { ffmpeg }, handlers) {
  const video = new ffmpeg.FFmpegInput(videoPath);
  const audio = new ffmpeg.FFmpegInput(audioPath);
  const audioContainer = path.extname(audioPath);
  const audioNeedsEncoding = audioContainer !== '.mp4';
  const out = new ffmpeg.FFmpegOutput(outPath, new Map([
    ['c:v', 'copy'],
    ['c:a', audioNeedsEncoding ? 'aac' : 'copy'],
    ['y', /** @type {any} */ (undefined)],
  ]));
  const cmd = new ffmpeg.FFmpegCommand();
  cmd.addInput(video);
  cmd.addInput(audio);
  cmd.addOutput(out);
  return new Promise((resolve, reject) => {
    if (handlers && handlers.onMergeProgress) {
      cmd.on('update', data => handlers && handlers.onMergeProgress && handlers.onMergeProgress(data.out_time_ms));
    }
    cmd.on('success', resolve);
    cmd.on('error', reject);
    if (handlers && handlers.onMergeStart) {
      handlers.onMergeStart(durationMs);
    }
    cmd.spawn();
  }).finally(() => {
    if (handlers && handlers.onMerged) {
      handlers.onMerged();
    }
  });
}

/**
 * @param {Host} host
 * @returns {DownloadHandlers}
 */
function createInteractiveHandlers(host) {
  const downloadBar = new progress.SingleBar({ fps: 1 }, progress.Presets.shades_classic);
  const mergeBar = new progress.SingleBar({ fps: 0.5 }, progress.Presets.shades_classic);
  return {
    onInfo: info => {
      host.log();
      host.log(chalk.magenta(`Downloading ${info.videoDetails.title}...`));
      downloadBar.start(1, 0);
    },
    onDownloadProgress: (downloaded, total) => {
      downloadBar.setTotal(total);
      downloadBar.update(downloaded);
    },
    onDownloaded: () => {
      downloadBar.update(downloadBar.getTotal());
      downloadBar.stop();
    },
    onMergeStart: totalMs => {
      host.log();
      host.log(chalk.magenta(`Merging audio and video streams...`));
      mergeBar.start(Math.floor(totalMs / 1000), 0);
    },
    onMergeProgress: encodedMs => {
      mergeBar.update(Math.floor(encodedMs / 1000));
    },
    onMerged: () => {
      mergeBar.update(mergeBar.getTotal());
      mergeBar.stop();
    }
  };
};

module.exports = download;
download.getOutFilePath = getOutFilePath;
download.createInteractiveHandlers = createInteractiveHandlers;
