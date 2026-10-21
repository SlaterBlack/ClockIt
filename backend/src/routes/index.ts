import { Router } from 'express';
import authRoutes from './auth.routes';
import projectRoutes from './project.routes';
import reportRoutes from './report.routes';
import timeEntryRoutes from './timeEntry.routes';
import userRoutes from './user.routes';
import workspaceRoutes from './workspace.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/projects', projectRoutes);
router.use('/time-entries', timeEntryRoutes);
router.use('/reports', reportRoutes);

export default router;
