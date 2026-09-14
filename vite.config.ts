import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/process.php': 'http://localhost:6767',
      '/google_login.php': 'http://localhost:6767',
      '/google_callback.php': 'http://localhost:6767',
      '/google_status.php': 'http://localhost:6767',
      '/google_logout.php': 'http://localhost:6767',
      '/google_refresh.php': 'http://localhost:6767',
      '/upload_to_photos.php': 'http://localhost:6767',
      '/uploads': 'http://localhost:6767',
      '/presets.json': 'http://localhost:6767',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'src/main.ts'),
      },
      output: {
        entryFileNames: 'bundle.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'bundle.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
