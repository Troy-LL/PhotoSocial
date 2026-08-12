/// <reference types="vite/client" />

interface Window {
  /** Set by Playwright mock-camera helper; skips countdown and collage flash. */
  __E2E_CAMERA__?: boolean;
}

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
