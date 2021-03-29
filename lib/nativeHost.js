import getFessonia from '@tedconf/fessonia';
import mkdirp from 'mkdirp';
import os from 'os';
import path from 'path';
import ytdl from 'ytdl-core';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { createWriteStream, promises } from 'fs';

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
  ffmpeg: getFessonia({
    ffmpeg_bin: ffmpegPath,
    ffprobe_bin: ffprobe.path,
  }),
};

export default host;
