import { Response } from 'express';
import { AuthRequest } from '../types';
import {
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from '../services/notificationService';

export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const onlyUnread = String(req.query.onlyUnread || 'false') === 'true';
    res.json(await getUserNotifications(req.user!.id, { page, limit, onlyUnread }));
  } catch {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
}

export async function getNotificationUnreadCount(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ unreadCount: await getUnreadCount(req.user!.id) });
  } catch {
    res.status(500).json({ error: 'Error al obtener conteo de notificaciones' });
  }
}

export async function readNotification(req: AuthRequest, res: Response): Promise<void> {
  try {
    await markAsRead(req.params.id, req.user!.id);
    res.json({ message: 'Notificación marcada como leída' });
  } catch {
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
}

export async function readAllNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    await markAllAsRead(req.user!.id);
    res.json({ message: 'Notificaciones marcadas como leídas' });
  } catch {
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
}
