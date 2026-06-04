import mongoose from 'mongoose';
import Notification, { NotificationType } from '../models/Notification';

export interface CreateNotificationInput {
  userId: mongoose.Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: 'task' | 'project';
  entityId?: mongoose.Types.ObjectId | string;
  linkTo?: string;
}

export async function createNotification(data: CreateNotificationInput) {
  return Notification.create(data);
}

export async function createBulkNotifications(notifications: CreateNotificationInput[]): Promise<void> {
  if (!notifications.length) return;
  await Notification.insertMany(notifications);
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() }
  );
}

export async function markAllAsRead(userId: string): Promise<void> {
  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
}

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ userId, isRead: false });
}

export async function getUserNotifications(
  userId: string,
  options: { page: number; limit: number; onlyUnread?: boolean }
) {
  const page = Math.max(options.page, 1);
  const limit = Math.min(Math.max(options.limit, 1), 100);
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = { userId };
  if (options.onlyUnread) filter.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    getUnreadCount(userId),
  ]);

  return { notifications, total, unreadCount, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function deleteOldNotifications(): Promise<void> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 30);
  await Notification.deleteMany({ isRead: true, createdAt: { $lt: threshold } });
}
