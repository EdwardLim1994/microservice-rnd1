import { gql } from '@apollo/client';
import type { Demo1Graphql, Demo2Graphql } from 'api';

// `demo1`'s own field (id, name) is generated from servers/demo1's schema;
// the `demo2` federation extension is generated from servers/demo2's schema
// (`extend type Demo1 { demo2: [Demo2] }`) — the two live in separate
// generated modules because each subgraph owns and generates only its own
// piece of the federated `Demo1` type.
export type Demo2Child = Pick<Demo2Graphql.Demo2, 'id' | 'name'>;
export type Demo1WithChildren = Pick<Demo1Graphql.Demo1, 'id' | 'name'> &
  Pick<Demo2Graphql.Demo1, 'demo2'>;

export interface GetDemo1Result {
  demo1: Demo1WithChildren | null;
}

/**
 * Data-layer query for the `demo1` module: federates `demo1`'s own field
 * with `demo2`'s `Demo1.demo2` extension via the Apollo Router supergraph.
 */
export const GET_DEMO1_QUERY = gql`
  query GetDemo1 {
    demo1 {
      id
      name
      demo2 {
        id
        name
      }
    }
  }
`;
