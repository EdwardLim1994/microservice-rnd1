import { existsSync, mkdirSync } from 'node:fs';
import chalk from 'chalk';

export const log = {
	info: (message: string) => console.log(chalk.blue(`[INFO]: ${message}`)),
	warn: (message: string) => console.warn(chalk.yellow(`[WARN]: ${message}`)),
	error: (message: string) => console.error(chalk.red(`[ERROR]: ${message}`)),
	success: (message: string) =>
		console.log(chalk.green(`[SUCCESS]: ${message}`)),
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
	return existsSync(`node_modules/.bin/${dependency}`);
};
