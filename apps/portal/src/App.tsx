import React, { Suspense } from 'react';
import './App.css';

const RemoteFrontend1 = React.lazy(() => import('frontend1/App'));

const App = () => {
  return (
    <div className="content">
      <h1>Portal (Host)</h1>
      <Suspense fallback={<p>Loading frontend1...</p>}>
        <RemoteFrontend1 />
      </Suspense>
    </div>
  );
};

export default App;
