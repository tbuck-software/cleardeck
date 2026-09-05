import { useEffect, useState } from 'react';

/**
 * Two breakpoints the redesign relies on: the sidebar collapses to icons below
 * 1100px, and wide tables fall back to stacked rows below 960px.
 */
const read = () => ({
  wideSidebar: window.innerWidth >= 1100,
  wideTable: window.innerWidth >= 960,
});

const useViewport = () => {
  const [viewport, setViewport] = useState(read);

  useEffect(() => {
    const onResize = () => setViewport(read());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return viewport;
};

export default useViewport;
