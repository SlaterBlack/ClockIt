import { createApp } from './app';
import { connectDatabase, sequelize } from './config/database';
import { env } from './config/env';
import './models';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  // Keep database schema in sync with models during development.
  // Use proper migrations (e.g. sequelize-cli) for production deployments.
  if (env.nodeEnv === 'development') {
    await sequelize.sync();
  }

  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});
