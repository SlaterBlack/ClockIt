import { createApp } from './app';
import { connectDatabase, sequelize } from './config/database';
import { env } from './config/env';
import './models';
import { User } from './models';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  // Keep database schema in sync with models during development.
  // Use proper migrations (e.g. sequelize-cli) for production deployments.
  if (env.nodeEnv === 'development') {
    await sequelize.sync({ alter: true });
  }

  await ensureAdminExists();

  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${env.port}`);
  });
}

// There is no public registration endpoint, so the very first account must be
// promoted automatically. If no admin exists yet, promote the oldest user —
// this mirrors the SQL migration's behaviour for databases that skip it (e.g.
// local dev, which relies on sequelize.sync() instead of the .sql files).
async function ensureAdminExists(): Promise<void> {
  const adminCount = await User.count({ where: { role: 'admin' } });
  if (adminCount > 0) {
    return;
  }

  const oldestUser = await User.findOne({ order: [['createdAt', 'ASC']] });
  if (!oldestUser) {
    return;
  }

  oldestUser.role = 'admin';
  await oldestUser.save();
  // eslint-disable-next-line no-console
  console.log(`No admin found; promoted "${oldestUser.email}" to admin.`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});
