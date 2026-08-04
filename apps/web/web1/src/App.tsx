import { ApolloProvider } from '@apollo/client/react';
import { RouterProvider } from '@tanstack/react-router';
import './App.css';
import { router } from './router';
import { apolloClient } from './shared/libs/apolloClient';

const App = () => (
  <ApolloProvider client={apolloClient}>
    <RouterProvider router={router} />
  </ApolloProvider>
);

export default App;
