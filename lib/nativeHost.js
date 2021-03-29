import getFessonia from '@tedconf/fessonia';
import mkdirp from 'mkdirp';
import os from 'os';
import path from 'path';
import ytdl from 'ytdl-core';
import ffbinaries from 'ffbinaries';
import { createWriteStream, promises } from 'fs';
import * as Diagnostics from './diagnostics.js';
// @ts-ignore
import dirname from '../dirname.cjs';
import { fail, success } from './utils.js';

const outputDirectory =
  os.platform() === 'darwin' ? path.join(os.homedir(), 'Movies', 'splyt') :
  os.platform() === 'win32' ? path.join(os.homedir(), 'Videos', 'splyt') :
  path.join(os.homedir(), 'splyt');

const logger = /** @type {Host['log']} */ (console.log.bind(console));
logger.error = console.error.bind(console);

/** @returns {Host} */
export default function createHost() {
  /** @type {ReturnType<typeof getFessonia> | undefined} */
  let fessonia;

  return {
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
    ffmpeg: {
      get FFmpegCommand() {
        return assertFessoniaInitialized().FFmpegCommand;
      },
      get FFmpegInput() {
        return assertFessoniaInitialized().FFmpegInput;
      },
      get FFmpegOutput() {
        return assertFessoniaInitialized().FFmpegOutput;
      },
      ensureInstalled: async (prompt, onProgress) => {
        const result = ffbinaries.locateBinariesSync(['ffmpeg', 'ffprobe'], { ensureExecutable: true });
        if (result.ffmpeg.found && result.ffprobe.found) {
          fessonia = getFessonia({
            ffmpeg_bin: result.ffmpeg.path,
            ffprobe_bin: result.ffprobe.path,
          });
          return success(true);
        }

        /** @type {('ffmpeg' | 'ffprobe')[]} */
        let neededInstalls = [];
        if (!result.ffmpeg.found) neededInstalls.push('ffmpeg');
        if (!result.ffprobe.found) neededInstalls.push('ffprobe');
        if (prompt && !await prompt(neededInstalls)) {
          return success(false);
        }

        return new Promise(resolve => {
          const platform = ffbinaries.detectPlatform();
          ffbinaries.downloadBinaries(
            neededInstalls,
            {
              tickerFn: onProgress,
              tickerInterval: 500,
              destination: dirname
            },
            (error, results) => {
              if (error) {
                return resolve(fail(Diagnostics.ffDownloadError, new Error(error)));
              }
              const paths = {
                ffmpeg: result.ffmpeg.path,
                ffprobe: result.ffprobe.path,
              };
              for (const comp of neededInstalls) {
                const result = results.find(r => r.filename === ffbinaries.getBinaryFilename(comp, platform));
                if (!result) return resolve(fail(Diagnostics.ffDownloadError));
                paths[comp] = path.join(result.path, result.filename);
              }
              fessonia = getFessonia({
                ffmpeg_bin: /** @type {string} */ (paths.ffmpeg),
                ffprobe_bin: /** @type {string} */ (paths.ffprobe),
              });
              resolve(success(results));
            }
          );
        });
      },
    },
  };

  function assertFessoniaInitialized() {
    if (!fessonia) {
      throw new Error('Fessonia is not initialized. Call `ensureInstalled()` before accessing fessonia constructors.');
    }
    return fessonia;
  }
}
