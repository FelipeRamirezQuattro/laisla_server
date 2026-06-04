import { Response } from 'express';
import mongoose from 'mongoose';
import Project from '../models/Project';
import Task from '../models/Task';
import { AuthRequest } from '../types';

async function getTaskCounts(projectIds: string[]) {
  const rows = await Task.aggregate([
    { $match: { projectId: { $in: projectIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: { projectId: '$projectId', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const map = new Map<string, Record<string, number>>();
  rows.forEach((row) => {
    const projectId = String(row._id.projectId);
    const current = map.get(projectId) ?? {};
    current[row._id.status] = row.count;
    map.set(projectId, current);
  });
  return map;
}

export async function getProjects(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const projects = await Project.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    const counts = await getTaskCounts(projects.map((project) => String(project._id)));
    res.json(projects.map((project) => ({ ...project, taskCounts: counts.get(String(project._id)) ?? {} })));
  } catch {
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
}

export async function createProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const project = await Project.create({ ...req.body, createdBy: req.user!.id });
    res.status(201).json(project);
  } catch {
    res.status(500).json({ error: 'Error al crear proyecto' });
  }
}

export async function getProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const project = await Project.findOne({ _id: req.params.id, isActive: true }).lean();
    if (!project) { res.status(404).json({ error: 'Proyecto no encontrado' }); return; }
    const tasks = await Task.find({ projectId: req.params.id })
      .populate('assignedTo', 'name email role avatarInitials')
      .populate('createdBy', 'name email role avatarInitials')
      .sort({ status: 1, order: 1, dueDate: 1 })
      .lean();
    res.json({ project, tasks });
  } catch {
    res.status(500).json({ error: 'Error al obtener proyecto' });
  }
}

export async function updateProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) { res.status(404).json({ error: 'Proyecto no encontrado' }); return; }
    res.json(project);
  } catch {
    res.status(500).json({ error: 'Error al actualizar proyecto' });
  }
}

export async function deleteProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!project) { res.status(404).json({ error: 'Proyecto no encontrado' }); return; }
    res.json({ message: 'Proyecto archivado' });
  } catch {
    res.status(500).json({ error: 'Error al archivar proyecto' });
  }
}
