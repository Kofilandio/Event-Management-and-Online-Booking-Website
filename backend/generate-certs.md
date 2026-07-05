# Generating a Self-Signed SSL Certificate for Development

The application supports HTTPS via the `USE_HTTPS=true` environment variable. For development you can use a self-signed certificate. Browsers will show a warning the first time — click "Advanced → Continue".

## With OpenSSL (recommended)

```bash
mkdir certs
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 365 \
  -subj "/CN=localhost"
```

## With Node.js (no OpenSSL needed)

Run this one-liner from the backend directory:

```bash
node -e "import('selfsigned').then(s => { const p = s.generate([{name:'commonName',value:'localhost'}],{days:365}); require('fs').mkdirSync('certs',{recursive:true}); require('fs').writeFileSync('certs/key.pem', p.private); require('fs').writeFileSync('certs/cert.pem', p.cert); console.log('Wrote certs/'); })"
```

(Requires `npm i -D selfsigned`)

## Enabling HTTPS

In `.env`:

```
USE_HTTPS=true
SSL_KEY_PATH=./certs/key.pem
SSL_CERT_PATH=./certs/cert.pem
```

Then `npm run dev` will boot the server on `https://localhost:4000`.

Don't forget to update `CORS_ORIGIN` and the Vite proxy target if you also serve the frontend over HTTPS.

## Production

For production, obtain a real certificate (e.g. via [Let's Encrypt](https://letsencrypt.org/)) and point `SSL_KEY_PATH` / `SSL_CERT_PATH` at the issued files. Better still, run behind a reverse proxy (nginx, Caddy) that handles TLS termination and forwards plain HTTP to the Node process.
