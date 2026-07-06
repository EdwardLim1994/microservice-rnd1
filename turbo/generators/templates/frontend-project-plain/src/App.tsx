import { ApolloProvider } from '@apollo/client/react';
import { GRAPHQL_URL } from './config/env';
import { createApolloClient } from './lib/apolloClient';
import './App.css';

const apolloClient = createApolloClient(GRAPHQL_URL);

const App = () => {
  return (
    <ApolloProvider client={apolloClient}>
      <div className="content">
        <h1>{{ name }}</h1>
      </div>
    </ApolloProvider>
  );
};

export default App;
