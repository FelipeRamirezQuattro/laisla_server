import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole';
import {
  createUser,
  deleteUser,
  getAssignableUsers,
  getMe,
  getUser,
  getUsers,
  updateMyPassword,
  updateUser,
  updateUserPassword,
} from '../../controllers/usersController';

const router = Router();

router.get('/me', getMe);
router.put('/me/password', updateMyPassword);
router.get('/assignable', requireRole('admin', 'superadmin'), getAssignableUsers);

router.use(requireRole('superadmin'));
router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.put('/:id/password', updateUserPassword);
router.delete('/:id', deleteUser);

export default router;
