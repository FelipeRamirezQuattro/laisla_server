import { Router } from 'express';
import {
  getNotificationUnreadCount,
  getNotifications,
  readAllNotifications,
  readNotification,
} from '../../controllers/notificationsController';

const router = Router();

router.get('/', getNotifications);
router.get('/unread-count', getNotificationUnreadCount);
router.put('/read-all', readAllNotifications);
router.put('/:id/read', readNotification);

export default router;
