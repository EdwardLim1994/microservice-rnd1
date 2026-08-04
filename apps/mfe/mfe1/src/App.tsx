import { gql } from '@apollo/client';
import { ApolloProvider, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import './App.css';
import { apolloClient } from './shared/libs/apolloClient';

// item2s is resolved by server2-graphql, federated onto Item by server1-graphql's Item entity
// (see apps/servers/server2-graphql/src/schemas/graphql/server2-graphql.graphql) — transparent
// to this query, Apollo Router stitches both subgraphs' responses together.
const GET_ITEM_WITH_ITEM2S = gql`
  query GetItemWithItem2s($id: ID!) {
    item(id: $id) {
      id
      name
      item2s {
        id
        name
      }
    }
  }
`;

const ItemLookup = () => {
  const [id, setId] = useState('');
  const [submittedId, setSubmittedId] = useState('');
  const { data, loading, error } = useQuery(GET_ITEM_WITH_ITEM2S, {
    variables: { id: submittedId },
    skip: !submittedId,
  });

  return (
    <div className="">
      <h1>Item lookup</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedId(id);
        }}
      >
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Item id"
        />
        <button type="submit">Fetch</button>
      </form>
      {loading && <p>Loading...</p>}
      {error && <p>{error.message}</p>}
      {data?.item && (
        <div>
          <p>
            {data.item.id} — {data.item.name}
          </p>
          <ul>
            {data.item.item2s.map((item2: { id: string; name: string }) => (
              <li key={item2.id}>
                {item2.id} — {item2.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const App = () => {
  return (
    <ApolloProvider client={apolloClient}>
      <ItemLookup />
    </ApolloProvider>
  );
};

export default App;
