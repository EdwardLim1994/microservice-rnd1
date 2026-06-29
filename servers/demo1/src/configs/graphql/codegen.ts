import type { CodegenConfig } from '@graphql-codegen/cli'

const out = '../../packages/api/src/generated/demo1/graphql'

const config: CodegenConfig = {
    overwrite: true,
    schema: './src/schema/graphql/demo1.graphql',
    generates: {
        [`${out}/resolvers.ts`]: {
            plugins: ['typescript', 'typescript-resolvers'],
            config: {
                useIndexSignature: true,
                federation: true,
                contextType: './context#Demo1ContextType',
                useTypeImports: true,
            },
        },
        [`${out}/context.ts`]: {
            plugins: ['add'],
            config: {
                content: 'export type Demo1ContextType = Record<string, never>;',
            },
        },
        [`${out}/typedefs.graphql`]: {
            plugins: ['schema-ast'],
            config: { includeDirectives: true },
        },
        [`${out}/typedefs.ts`]: {
            plugins: ['add'],
            config: {
                content: 'export const typeDefs = await Bun.file(import.meta.dir + "/typedefs.graphql").text();',
            },
        },
        [`${out}/index.ts`]: {
            plugins: ['add'],
            config: {
                content: ['export * from "./context";', 'export * from "./resolvers";', 'export * from "./typedefs";'].join('\n'),
            },
        },
    },
}

export default config
