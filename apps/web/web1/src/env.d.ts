/**
 * Imports the SVG file as a React component.
 * @requires [@rsbuild/plugin-svgr](https://npmjs.com/package/@rsbuild/plugin-svgr)
 */
declare module '*.svg?react' {
  import type React from 'react';

  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

/** Module Federation remote exposed by apps/mfe/mfe1. */
declare module 'mfe1/App' {
  import type React from 'react';

  const App: React.ComponentType;
  export default App;
}
