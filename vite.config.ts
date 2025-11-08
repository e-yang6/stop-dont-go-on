import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: 'localhost', // Changed from '0.0.0.0' to 'localhost' for secure context
        // To enable HTTPS (recommended for camera access):
        // 1. Install mkcert: https://github.com/FiloSottile/mkcert
        // 2. Run: mkcert -install && mkcert localhost
        // 3. Uncomment the https config below:
        // https: {
        //   key: fs.readFileSync('localhost-key.pem'),
        //   cert: fs.readFileSync('localhost.pem'),
        // },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
