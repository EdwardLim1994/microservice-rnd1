import { gql } from '@apollo/client';
import type { Test1Graphql, Test2Graphql } from 'api';

// `test1`'s own field (id) is generated from servers/test1's schema; the `test2` federation
// extension is generated from servers/test2's schema (`extend type Test1 { test2: [Test2] }`) —
// the two live in separate generated modules because each subgraph owns and generates only its
// own piece of the federated `Test1` type.
export type Test2Child = Pick<Test2Graphql.Test2, 'id'>;
export type Test1WithChildren = Pick<Test1Graphql.Test1, 'id'> &
  Pick<Test2Graphql.Test1, 'test2'>;

export interface GetTest1Result {
  test1: Test1WithChildren | null;
}

/**
 * Data-layer query for the `test1` module: federates `test1`'s own field with `test2`'s
 * `Test1.test2` extension via the Apollo Router supergraph.
 */
export const GET_TEST1_QUERY = gql`
  query GetTest1 {
    test1 {
      id
      test2 {
        id
      }
    }
  }
`;
