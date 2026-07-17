import { log } from '../helper/common';
import ReleaseManager from '../release/ReleaseManager';

const [command, ...args] = process.argv.slice(2);
const manager = ReleaseManager.init(process.cwd());

async function run() {
  switch (command) {
    case 'cut-release': {
      const [releaseBranch, baseRef] = args;
      if (!releaseBranch) {
        throw new Error(
          'Usage: release-manager cut-release <release-branch> [baseRef=main]',
        );
      }
      return manager.cutRelease(releaseBranch, baseRef);
    }
    case 'bump-rc': {
      const [baseRef] = args;
      return manager.bumpRc(baseRef);
    }
    case 'promote': {
      return manager.promote();
    }
    case 'hotfix': {
      const [appName] = args;
      if (!appName) {
        throw new Error('Usage: release-manager hotfix <app-name>');
      }
      return manager.hotfix(appName);
    }
    case 'touched-apps': {
      const [baseRef] = args;
      return manager.touchedAppNames(baseRef);
    }
    default:
      throw new Error(
        `Unknown command "${command}". Expected one of: cut-release, bump-rc, promote, hotfix, touched-apps`,
      );
  }
}

try {
  const result = await run();
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
