import { Router } from 'express';
import {
  deleteTimeEntry,
  listTimeEntries,
  startTimeEntry,
  stopTimeEntry,
  updateTimeEntry,
} from '../controllers/timeEntry.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.use(requireAuth);
router.get('/', listTimeEntries);
router.post('/start', startTimeEntry);
router.post('/:id/stop', stopTimeEntry);
router.patch('/:id', updateTimeEntry);
router.delete('/:id', deleteTimeEntry);

export default router;
