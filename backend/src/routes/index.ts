import { Router } from 'express';
import authRoutes from './auth.routes';
import projectRoutes from './project.routes';
import timeEntryRoutes from './timeEntry.routes';
import workspaceRoutes from './workspace.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/projects', projectRoutes);
router.use('/time-entries', timeEntryRoutes);

export default router;
