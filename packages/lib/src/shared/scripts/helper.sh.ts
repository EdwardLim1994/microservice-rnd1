import { chalk, fs } from "zx"
export const log = {
    info: (message: string) => console.log(chalk.blue(`[INFO]: ${message}`)),
    warn: (message: string) => console.log(chalk.yellow(`[WARN]: ${message}`)),
    error: (message: string) => console.log(chalk.red(`[ERROR]: ${message}`)),
    success: (message: string) => console.log(chalk.green(`[SUCCESS]: ${message}`))
}
export const createFolder = async (folderPath: string) => {
    if (await fs.existsSync(folderPath)) {
        log.info(`${folderPath} already exists.`)
        return;
    }
    log.info(`${folderPath} is not found, creating...`);

    await fs.mkdirSync(folderPath, { recursive: true })

    log.success(`${folderPath} is created successfully.`)
}
export const checkDependency = async (dependency: string) => {
    return await fs.existsSync(`node_modules/.bin/${dependency}`)
}
