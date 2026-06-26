import { checkDependency, createFolder, log } from "lib/src/shared/scripts/helper.sh.ts"

const API_PATH = "../../packages/api/generated/demo2"

const isGraphqlCodeGenExists = await checkDependency("graphql-codegen.exe");
const isProtocExists = await checkDependency("protoc.exe");

if (isGraphqlCodeGenExists) {
  log.info(`GraphQL Codegen is installed. Compiling...`)

  try {
    await createFolder(`${API_PATH}/graphql`);
    await Bun.$`./node_modules/.bin/graphql-codegen --config ./src/configs/graphql/codegen.yaml`

    log.success(`GraphQL Codegen compiled successfully`)
  } catch (err) {
    log.error(`Failed to compile GraphQL Codegen: ${err}`)
    process.exit(1);
  }
} else {
  log.warn(`GraphQL Codegen is not installed. Skipping...`)
}

if (isProtocExists) {
  log.info(`Protoc is installed. Compiling...`)

  try {
    await createFolder(`${API_PATH}/proto`);
    await Bun.$`./node_modules/.bin/buf generate --template ./src/configs/proto/buf.gen.yaml`

    log.success(`Protoc compiled successfully`)
  } catch (err) {
    log.error(`Failed to compile Protoc: ${err}`)
    process.exit(1);
  }
} else {
  log.warn(`Protoc is not installed. Skipping...`)
}

process.exit(0)
