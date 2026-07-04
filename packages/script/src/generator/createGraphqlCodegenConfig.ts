import type { CodegenConfig } from '@graphql-codegen/cli';

export interface CreateGraphqlCodegenConfigOptions {
  serverName: string;
  schema: string;
  out: string;
}

export function createGraphqlCodegenConfig({
  serverName,
  schema,
  out,
}: CreateGraphqlCodegenConfigOptions): CodegenConfig {
  const contextType = `${serverName}ContextType`;

  return {
    overwrite: true,
    schema,
    generates: {
      [`${out}/resolvers.ts`]: {
        plugins: ['typescript', 'typescript-resolvers'],
        config: {
          useIndexSignature: true,
          federation: true,
          contextType: `./context#${contextType}`,
          useTypeImports: true,
        },
      },
      [`${out}/context.ts`]: {
        plugins: ['add'],
        config: {
          content: `export type ${contextType} = Record<string, never>;`,
        },
      },
      [`${out}/typedefs.graphql`]: {
        plugins: ['schema-ast'],
        config: { includeDirectives: true },
      },
      [`${out}/typedefs.ts`]: {
        plugins: ['add'],
        config: {
          content:
            'import typeDefs from "./typedefs.graphql" with { type: "text" };\nexport { typeDefs };',
        },
      },
      [`${out}/index.ts`]: {
        plugins: ['add'],
        config: {
          content: [
            'export * from "./context";',
            'export * from "./resolvers";',
            'export * from "./typedefs";',
          ].join('\n'),
        },
      },
    },
  };
}
