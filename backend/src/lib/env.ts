import 'dotenv/config';

const DEV_SECRET = 'dev-secret-change-me';
const nodeEnv = process.env.NODE_ENV ?? 'development';
const rawSecret = process.env.JWT_SECRET;


export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: rawSecret ?? DEV_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  useHttps: process.env.USE_HTTPS === 'true',
  sslKeyPath: process.env.SSL_KEY_PATH ?? './certs/key.pem',
  sslCertPath: process.env.SSL_CERT_PATH ?? './certs/cert.pem',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
};
