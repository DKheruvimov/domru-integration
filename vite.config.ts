import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

const getGitHash = () => {
  const envHash = process.env.VERCEL_GIT_COMMIT_SHA || 
                  process.env.COMMIT_REF || 
                  process.env.CF_PAGES_COMMIT_SHA || 
                  process.env.GITHUB_SHA || 
                  process.env.SOURCE_VERSION || 
                  process.env.RENDER_GIT_COMMIT;
  if (envHash) return envHash.substring(0, 7);

  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    console.error("Failed to get git hash:", e);
    return 'unknown';
  }
};

export default defineConfig(() => {
  const commitHash = getGitHash();
  const appVersion = `1.0.${commitHash}`;

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [react(), tailwindcss()],
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
