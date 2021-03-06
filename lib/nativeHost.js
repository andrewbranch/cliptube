import getFessonia from '@tedconf/fessonia';
import fetch from 'node-fetch';
import mkdirp from 'mkdirp';
import os from 'os';
import path from 'path';
import ytdl from 'ytdl-core';
import ffbinaries from 'ffbinaries';
import { createWriteStream, promises } from 'fs';
import * as Diagnostics from './diagnostics.js';
// @ts-ignore
import meta from '../meta.cjs';
import { assertDefined, fail, success } from './utils.js';

const outputDirectory =
  os.platform() === 'darwin' ? path.join(os.homedir(), 'Movies', 'cliptube') :
  os.platform() === 'win32' ? path.join(os.homedir(), 'Videos', 'cliptube') :
  path.join(os.homedir(), 'cliptube');

const isBinary = process.argv[0].includes('cliptube');
const configDir = isBinary ? path.dirname(meta.dirname) : path.join(meta.dirname, '.config');

const logger = /** @type {Host['log']} */ (console.log.bind(console));
logger.error = console.error.bind(console);

/** @returns {Host} */
export default function createHost() {
  /** @type {ReturnType<typeof getFessonia> | undefined} */
  let fessonia;

  const getStoreFilename = () => path.join(configDir, 'store.json');
  /** @type {Host['store']} */
  const store = {
    get: async key => {
      const storeFile = getStoreFilename();
      try {
        const store = JSON.parse(await promises.readFile(storeFile, 'utf8'));
        return store[key];
      } catch {
        await mkdirp(configDir);
        await promises.writeFile(storeFile, '{}', 'utf8');
        return undefined;
      }
    },
    set: async (key, value) => {
      const storeFile = getStoreFilename();
      await mkdirp(configDir);
      /** @type {Partial<Store>} */
      let store = {};
      try {
        store = JSON.parse(await promises.readFile(storeFile, 'utf8'));
      } catch {}
      store[key] = value;
      await promises.writeFile(storeFile, JSON.stringify(store), 'utf8');
    },
  };

  return {
    version: `v${meta.packageJson.version}`,
    log: logger,
    net: {
      getYouTubeInfo: ytdl.getInfo,
      downloadYouTubeVideo: (info, format) => ytdl.downloadFromInfo(info, { format }),
      getLatestVersionInfo: async () => {
        /** @type {GitHubRelease} */
        const res = await (await fetch('https://api.github.com/repos/andrewbranch/cliptube/releases/latest')).json();
        const result = {
          version: assertDefined(res.tag_name),
          assets: {
            'macos-x64': assertDefined(res.assets.find(a => a.name === 'cliptube-macos-x64')).browser_download_url,
          },
          notes: res.body,
          title: res.name,
        };
        await store.set('latestVersionCheck', { time: new Date().toISOString(), version: result.version });
        return result;
      },
      downloadUpdate: async url => {
        const res = await fetch(url);
        const outFilename = path.join(meta.dirname, 'cliptube.download');
        const dest = createWriteStream(outFilename);
        await new Promise((resolve, reject) => {
          res.body.pipe(dest);
          dest.on('error', reject);
          dest.on('close', resolve);
        });
        await promises.chmod(outFilename, '755');
        await promises.rename(outFilename, path.join(meta.dirname, 'cliptube'));
      }
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
      readdir: promises.readdir,
    },
    config: {
      getOutputDirectory: () => outputDirectory,
      getStoreFilename,
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
        const result = ffbinaries.locateBinariesSync(['ffmpeg', 'ffprobe'], { ensureExecutable: true, paths: [meta.dirname] });
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
              destination: meta.dirname
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
    store,
  };

  function assertFessoniaInitialized() {
    if (!fessonia) {
      throw new Error('Fessonia is not initialized. Call `ensureInstalled()` before accessing fessonia constructors.');
    }
    return fessonia;
  }
}
