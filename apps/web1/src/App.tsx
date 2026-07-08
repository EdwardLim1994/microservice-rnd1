import React, { Suspense } from 'react';
import './App.css';

const RemoteMfe1 = React.lazy(() => import('mfe1/App'));

const App = () => {
  return (
    <div className="content">
      <h1>web1</h1>
      <Suspense fallback={<p>Loading mfe1...</p>}>
        <RemoteMfe1 />
      </Suspense>
    </div>
  );
};

export default App;
