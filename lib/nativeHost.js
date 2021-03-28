const os = require('os');
const path = require('path');
const ytdl = require('ytdl-core');
const { createWriteStream, promises } = require('fs');
const mkdirp = require('mkdirp');

const outputDirectory =
  os.platform() === 'darwin' ? path.join(os.homedir(), 'Movies', 'splyt') :
  os.platform() === 'win32' ? path.join(os.homedir(), 'Videos', 'splyt') :
  path.join(os.homedir(), 'splyt');

const logger = /** @type {Host['log']} */ (console.log.bind(console));
logger.error = console.error.bind(console);

/** @type {Host} */
const host = {
  log: logger,
  net: {
    getYouTubeInfo: ytdl.getInfo,
    downloadYouTubeVideo: (info, format) => ytdl.downloadFromInfo(info, { format }),
  },
  fs: {
    createWriteStream,
    mkdirp: async path => void await mkdirp(path),
    exists: async path => {
      try {
        await promises.access(path);
        return true;
      } catch {
        return false;
      }
    },
  },
  config: {
    getOutputDirectory: () => outputDirectory,
  },
  ffmpeg: require('@tedconf/fessonia')({
    ffmpeg_bin: require('ffmpeg-static'),
    ffprobe_bin: require('ffprobe-static').path,
  }),
};

module.exports = host;
