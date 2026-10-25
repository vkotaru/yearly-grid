/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// Writes dist/manifest.json from manifest.template.json, filling in the OAuth
// client ID and the extension's public key from .env. Both are tied to *your*
// Google Cloud project and extension ID, so they're kept out of the repo.
// The Chrome Web Store rejects a `key` field (it signs uploads itself), so
// `--mode store` (npm run package) leaves it out.
function manifest(env: Record<string, string>, store: boolean): Plugin {
  return {
    name: 'yearly-grid-manifest',
    apply: 'build',
    generateBundle() {
      const m = JSON.parse(readFileSync('manifest.template.json', 'utf8'));
      if (env.OAUTH_CLIENT_ID) {
        m.oauth2.client_id = env.OAUTH_CLIENT_ID;
      } else {
        this.warn('OAUTH_CLIENT_ID is not set in .env — Google sign-in will fail.');
      }
      if (store) {
        // No key: the store assigns the ID.
      } else if (env.EXTENSION_KEY) {
        m.key = env.EXTENSION_KEY;
      } else {
        this.warn('EXTENSION_KEY is not set in .env — the extension ID will change per install.');
      }
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(m, null, 2) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), manifest(env, mode === 'store')],
    build: {
      rollupOptions: {
        input: { index: 'index.html', background: 'src/background.ts' },
        output: {
          // The manifest points at a fixed service-worker filename.
          entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
        },
      },
    },
    test: { environment: 'node' },
  };
});
