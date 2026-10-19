import { Router } from 'express';
import {
  createProject,
  deleteProject,
  listProjects,
} from '../controllers/project.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.use(requireAuth);
router.get('/', listProjects);
router.post('/', createProject);
router.delete('/:id', deleteProject);

export default router;
