import { lazy, Suspense } from 'react';

const MfeApp = lazy(() => import('mfe1/App'));

export const HomePage = () => {
  return (
    <div className="">
      <h1>Rsbuild with React</h1>
      <p>Start building amazing things with Rsbuild.</p>
      <Suspense fallback={<p>Loading mfe1...</p>}>
        <MfeApp />
      </Suspense>
    </div>
  );
};
