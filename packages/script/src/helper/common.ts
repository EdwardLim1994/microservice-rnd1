import { existsSync, mkdirSync } from 'node:fs';
import chalk from 'chalk';

export const log = {
  info: (message: string) => console.log(chalk.blue(`[INFO]: ${message}`)),
  warn: (message: string) => console.warn(chalk.yellow(`[WARN]: ${message}`)),
  error: (message: string) => console.error(chalk.red(`[ERROR]: ${message}`)),
  // console.error (stderr), not console.log — release-manager.ts's release:* commands
  // (cut-release/bump-rc/promote/hotfix) each call this per touched app, then print a final
  // JSON result to stdout for the calling shell to capture (e.g. cd-hotfix.yml's `result=$(bun
  // ... hotfix "$app")` piped straight into `jq --argjson`). A stdout success line would land
  // ahead of that JSON in the same captured string, and jq rejects a value with leading
  // non-JSON text outright.
  success: (message: string) =>
    console.error(chalk.green(`[SUCCESS]: ${message}`)),
};

export const createFolder = (folderPath: string) => {
  if (existsSync(folderPath)) {
    log.info(`${folderPath} already exists.`);
    return;
  }
  log.info(`${folderPath} is not found, creating...`);
  mkdirSync(folderPath, { recursive: true });
  log.success(`${folderPath} is created successfully.`);
};

export const checkDependency = (dependency: string) => {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  return existsSync(`node_modules/.bin/${dependency}${suffix}`);
};
