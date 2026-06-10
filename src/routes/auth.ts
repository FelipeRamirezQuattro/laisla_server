import { Router } from 'express';
import { googleLogin, login, logout } from '../controllers/authController';
import { loginValidators, handleValidationErrors } from '../middleware/validators';

const router = Router();

router.post('/login', loginValidators, handleValidationErrors, login);
router.post('/google', googleLogin);
router.post('/logout', logout);

export default router;
