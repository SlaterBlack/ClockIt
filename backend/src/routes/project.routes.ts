import { Router } from 'express';
import {
  createProject,
  createProjectTask,
  deleteProject,
  deleteProjectTask,
  listProjectTasks,
  listProjects,
} from '../controllers/project.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.use(requireAuth);
router.get('/', listProjects);
router.post('/', createProject);
router.get('/:projectId/tasks', listProjectTasks);
router.post('/:projectId/tasks', createProjectTask);
router.delete('/:projectId/tasks/:taskId', deleteProjectTask);
router.delete('/:id', deleteProject);

export default router;
