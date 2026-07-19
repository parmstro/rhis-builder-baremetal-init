import { defineConfig } from 'vite';
import react    from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs       from 'node:fs';

const tlsKey  = process.env.TLS_KEY;
const tlsCert = process.env.TLS_CERT;
const realCerts = !!(tlsKey && tlsCert);

export default defineConfig({
  plugins: [
    react(),
    // Use real certs when provided; otherwise basic-ssl generates a self-signed cert.
    ...(realCerts ? [] : [basicSsl()]),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['provisioner.example.ca'],
    ...(realCerts && {
      https: {
        key:  fs.readFileSync(tlsKey),
        cert: fs.readFileSync(tlsCert),
      },
    }),
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});
