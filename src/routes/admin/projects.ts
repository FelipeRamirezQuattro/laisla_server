import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole';
import {
  createProject,
  deleteProject,
  getProject,
  getProjects,
  updateProject,
} from '../../controllers/projectController';

const router = Router();

router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', requireRole('admin', 'superadmin'), createProject);
router.put('/:id', requireRole('admin', 'superadmin'), updateProject);
router.delete('/:id', requireRole('superadmin'), deleteProject);

export default router;
