import { Router } from 'express';
import {
  addAttachment,
  createTask,
  deleteAttachment,
  deleteTask,
  getMyTasks,
  getTask,
  getTasks,
  updateTask,
} from '../../controllers/taskController';

const router = Router();

router.get('/my-tasks', getMyTasks);
router.get('/', getTasks);
router.post('/', createTask);
router.get('/:id', getTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/attachments', addAttachment);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

export default router;
