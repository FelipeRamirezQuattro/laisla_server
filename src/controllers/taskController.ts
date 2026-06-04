import { Response } from 'express';
import mongoose from 'mongoose';
import Project from '../models/Project';
import Task from '../models/Task';
import User from '../models/User';
import { AuthRequest } from '../types';
import { createBulkNotifications } from '../services/notificationService';

function priorityWeight(priority: string): number {
  return { urgent: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4;
}

function normalizeIds(values?: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value)).filter(Boolean);
}

function canManageTasks(role?: string): boolean {
  return role === 'admin' || role === 'superadmin';
}

async function populateTask(taskId: mongoose.Types.ObjectId | string) {
  return Task.findById(taskId)
    .populate('projectId', 'name color')
    .populate('assignedTo', 'name email role avatarInitials')
    .populate('createdBy', 'name email role avatarInitials');
}

export async function getTasks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { projectId, assignedTo, status, priority, search } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (projectId) filter.projectId = projectId;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const tasks = await Task.find(filter)
      .populate('projectId', 'name color')
      .populate('assignedTo', 'name email role avatarInitials')
      .populate('createdBy', 'name email role avatarInitials')
      .sort({ dueDate: 1, priority: 1, order: 1 });
    res.json(tasks);
  } catch {
    res.status(500).json({ error: 'Error al obtener tareas' });
  }
}

export async function getMyTasks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tasks = await Task.find({ assignedTo: req.user!.id, status: { $ne: 'cancelled' } })
      .populate('projectId', 'name color')
      .populate('assignedTo', 'name email role avatarInitials')
      .populate('createdBy', 'name email role avatarInitials')
      .lean();
    tasks.sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return dateA - dateB || priorityWeight(a.priority) - priorityWeight(b.priority);
    });
    res.json(tasks);
  } catch {
    res.status(500).json({ error: 'Error al obtener mis tareas' });
  }
}

export async function createTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!canManageTasks(req.user?.role)) {
      res.status(403).json({ error: 'No tienes permisos para crear tareas' });
      return;
    }

    const project = await Project.findById(req.body.projectId);
    if (!project || !project.isActive) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const task = await Task.create({
      ...req.body,
      assignedTo: normalizeIds(req.body.assignedTo),
      tags: normalizeIds(req.body.tags),
      createdBy: req.user!.id,
    });

    const assignedTo = normalizeIds(req.body.assignedTo);
    await createBulkNotifications(assignedTo.map((userId) => ({
      userId,
      type: 'task_assigned',
      title: 'Nueva tarea asignada',
      message: `Se te asignó la tarea '${task.title}' en el proyecto '${project.name}'`,
      entityType: 'task',
      entityId: task._id as mongoose.Types.ObjectId,
      linkTo: `/admin/proyectos/${project._id}`,
    })));

    res.status(201).json(await populateTask(task._id as mongoose.Types.ObjectId));
  } catch {
    res.status(500).json({ error: 'Error al crear tarea' });
  }
}

export async function getTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const task = await populateTask(req.params.id);
    if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
    res.json(task);
  } catch {
    res.status(500).json({ error: 'Error al obtener tarea' });
  }
}

export async function updateTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }

    const isManager = canManageTasks(req.user?.role);
    const isAssigned = task.assignedTo.map(String).includes(req.user!.id);
    if (!isManager && !isAssigned) {
      res.status(403).json({ error: 'No tienes permisos para actualizar esta tarea' });
      return;
    }

    const previousAssigned = task.assignedTo.map(String);
    if (!isManager) {
      if (Object.keys(req.body).some((key) => key !== 'status')) {
        res.status(403).json({ error: 'Solo puedes actualizar el estado de tus tareas asignadas' });
        return;
      }
      task.status = req.body.status;
    } else {
      const allowed = [
        'title', 'description', 'status', 'priority', 'assignedTo', 'dueDate',
        'notes', 'tags', 'order',
      ];
      allowed.forEach((field) => {
        if (req.body[field] !== undefined) {
          (task as any)[field] = ['assignedTo', 'tags'].includes(field)
            ? normalizeIds(req.body[field])
            : req.body[field];
        }
      });
    }

    await task.save();

    const nextAssigned = task.assignedTo.map(String);
    const newAssigned = nextAssigned.filter((id) => !previousAssigned.includes(id));
    const project = await Project.findById(task.projectId);
    const updater = await User.findById(req.user!.id).select('name');

    await createBulkNotifications(newAssigned.map((userId) => ({
      userId,
      type: 'task_assigned',
      title: 'Nueva tarea asignada',
      message: `Se te asignó la tarea '${task.title}' en el proyecto '${project?.name ?? 'Proyecto'}'`,
      entityType: 'task',
      entityId: task._id as mongoose.Types.ObjectId,
      linkTo: `/admin/proyectos/${task.projectId}`,
    })));

    const shouldNotifyUpdate = isManager || !nextAssigned.includes(req.user!.id);
    const updateRecipients = shouldNotifyUpdate
      ? nextAssigned.filter((id) => id !== req.user!.id && !newAssigned.includes(id))
      : [];
    await createBulkNotifications(updateRecipients.map((userId) => ({
      userId,
      type: 'task_updated',
      title: 'Tarea actualizada',
      message: `La tarea '${task.title}' fue actualizada por ${updater?.name ?? 'un usuario'}`,
      entityType: 'task',
      entityId: task._id as mongoose.Types.ObjectId,
      linkTo: `/admin/proyectos/${task.projectId}`,
    })));

    res.json(await populateTask(task._id as mongoose.Types.ObjectId));
  } catch {
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
}

export async function deleteTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!canManageTasks(req.user?.role)) {
      res.status(403).json({ error: 'No tienes permisos para eliminar tareas' });
      return;
    }
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
    res.json({ message: 'Tarea eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
}

export async function addAttachment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { filename, url } = req.body as { filename?: string; url?: string };
    if (!filename || !url) {
      res.status(400).json({ error: 'Nombre y URL son requeridos' });
      return;
    }
    const task = await Task.findById(req.params.id);
    if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
    if (!canManageTasks(req.user?.role) && !task.assignedTo.map(String).includes(req.user!.id)) {
      res.status(403).json({ error: 'No tienes permisos para actualizar esta tarea' });
      return;
    }
    task.attachments.push({ filename, url, addedBy: new mongoose.Types.ObjectId(req.user!.id), addedAt: new Date() });
    await task.save();
    res.json(await populateTask(task._id as mongoose.Types.ObjectId));
  } catch {
    res.status(500).json({ error: 'Error al agregar adjunto' });
  }
}

export async function deleteAttachment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
    if (!canManageTasks(req.user?.role) && !task.assignedTo.map(String).includes(req.user!.id)) {
      res.status(403).json({ error: 'No tienes permisos para actualizar esta tarea' });
      return;
    }
    task.attachments = task.attachments.filter((item) => String(item._id) !== req.params.attachmentId);
    await task.save();
    res.json(await populateTask(task._id as mongoose.Types.ObjectId));
  } catch {
    res.status(500).json({ error: 'Error al eliminar adjunto' });
  }
}
