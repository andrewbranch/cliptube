import marked from 'marked';
import TerminalRenderer from 'marked-terminal';
import * as Diagnostics from './diagnostics.js';
import { fail, success } from './utils.js';


/**
 * @param {UpdateOptions} options
 * @param {Host} host
 * @returns {Promise<Result<string | false>>}
 */
export default async function update(options, host) {
  if (!options.force) {
    const lastCheck = await host.store.get('latestVersionCheck');
    if (lastCheck && Date.now() - Date.parse(lastCheck.time) < 24 * 60 * 60 * 1000) {
      return success(false);
    }
  }

  let diagnostic = Diagnostics.checkingForUpdatesError;
  try {
    const release = await host.net.getLatestVersionInfo();
    if (release.version === host.version) {
      return success(false);
    }

    marked.setOptions({
      renderer: new TerminalRenderer(),
    });

    const url = release.assets['macos-x64'];
    if (options.shouldInstall?.(release.version, url, marked(release.notes))) {
      diagnostic = Diagnostics.downloadUpdateError;
      await host.net.downloadUpdate(url);
      return success(release.version);
    }
    return success(false);
  } catch (error) {
    return fail(diagnostic, error);
  }
}
