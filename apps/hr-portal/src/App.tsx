import { ApolloProvider } from '@apollo/client/react';
import { RouterProvider } from '@tanstack/react-router';
import { GRAPHQL_URL } from './config/env';
import { createApolloClient } from './lib/apolloClient';
import { router } from './routes';
import './App.css';

const apolloClient = createApolloClient(GRAPHQL_URL);

const App = () => {
  return (
    <ApolloProvider client={apolloClient}>
      <RouterProvider router={router} />
    </ApolloProvider>
  );
};

export default App;
