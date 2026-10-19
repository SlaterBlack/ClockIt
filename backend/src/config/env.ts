import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:4200',

  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(process.env.DB_PORT ?? 5432),
    name: required('DB_NAME', 'clockify_dupe'),
    user: required('DB_USER', 'postgres'),
    password: required('DB_PASSWORD', 'postgres'),
    logging: (process.env.DB_LOGGING ?? 'false') === 'true',
  },

  jwt: {
    secret: required('JWT_SECRET', 'change-me-in-env'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
};
