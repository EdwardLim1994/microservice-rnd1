import { ApolloProvider } from '@apollo/client/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GRAPHQL_URL } from './config/env';
import { createApolloClient } from './lib/apolloClient';

const apolloClient = createApolloClient(GRAPHQL_URL);

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <ApolloProvider client={apolloClient}>
        <App />
      </ApolloProvider>
    </React.StrictMode>,
  );
}
