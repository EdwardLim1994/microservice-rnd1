import { ApolloProvider } from '@apollo/client/react';
import { RouterProvider } from '@tanstack/react-router';
import './App.css';
import { apolloClient } from './shared/libs/apolloClient';
import { router } from './router';

const App = () => (
  <ApolloProvider client={apolloClient}>
    <RouterProvider router={router} />
  </ApolloProvider>
);

export default App;
