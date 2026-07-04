import { ApolloProvider } from '@apollo/client/react';
import { GRAPHQL_URL } from './config/env';
import { createApolloClient } from './lib/apolloClient';
import { Demo1Page } from './modules/demo1/';
import './App.css';

const apolloClient = createApolloClient(GRAPHQL_URL);

const App = () => {
  return (
    <ApolloProvider client={apolloClient}>
      <div className="content">
        <h1>Rsbuild with React</h1>
        <p>Start building amazing things with Rsbuild.</p>
        <p>This is from remote page</p>
        <Demo1Page />
      </div>
    </ApolloProvider>
  );
};

export default App;
