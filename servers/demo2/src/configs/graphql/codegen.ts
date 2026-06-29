import type { CodegenConfig } from '@graphql-codegen/cli'

const out = '../../packages/api/src/generated/demo2/graphql'

const config: CodegenConfig = {
    overwrite: true,
    schema: './src/schema/graphql/demo2.graphql',
    generates: {
        [`${out}/resolvers.ts`]: {
            plugins: ['typescript', 'typescript-resolvers'],
            config: {
                useIndexSignature: true,
                federation: true,
                contextType: './context#Demo2ContextType',
                useTypeImports: true,
            },
        },
        [`${out}/context.ts`]: {
            plugins: ['add'],
            config: {
                content: 'export type Demo2ContextType = Record<string, never>;',
            },
        },
        [`${out}/typedefs.graphql`]: {
            plugins: ['schema-ast'],
            config: { includeDirectives: true },
        },
        [`${out}/typedefs.ts`]: {
            plugins: ['add'],
            config: {
                content: 'import typeDefs from "./typedefs.graphql" with { type: "text" };\nexport { typeDefs };',
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
