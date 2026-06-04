import { Response } from 'express';
import User, { UserRole } from '../models/User';
import { AuthRequest } from '../types';

const safeUserSelect = '-password';

async function activeSuperadminCount(excludeId?: string): Promise<number> {
  const filter: Record<string, unknown> = { role: 'superadmin', isActive: true };
  if (excludeId) filter._id = { $ne: excludeId };
  return User.countDocuments(filter);
}

export async function getUsers(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await User.find().select(safeUserSelect).sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

export async function getAssignableUsers(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await User.find({ isActive: true }).select(safeUserSelect).sort({ name: 1 });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Error al obtener usuarios asignables' });
  }
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, role = 'user', isActive = true } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      isActive?: boolean;
    };

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
      return;
    }

    const exists = await User.exists({ email: email.toLowerCase() });
    if (exists) {
      res.status(409).json({ error: 'Ya existe un usuario con este email' });
      return;
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      isActive,
      createdBy: req.user!.id,
    });
    const safe = await User.findById(user._id).select(safeUserSelect);
    res.status(201).json(safe);
  } catch {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
}

export async function getUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.params.id).select(safeUserSelect);
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, role, isActive } = req.body as { name?: string; role?: UserRole; isActive?: boolean };
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

    if (String(user._id) === req.user!.id && role && role !== user.role) {
      res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
      return;
    }

    const wouldDeactivateLastSuperadmin =
      user.role === 'superadmin' &&
      user.isActive &&
      isActive === false &&
      (await activeSuperadminCount(String(user._id))) === 0;
    if (wouldDeactivateLastSuperadmin) {
      res.status(400).json({ error: 'No se puede desactivar el último superadmin activo' });
      return;
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    await user.save();

    const safe = await User.findById(user._id).select(safeUserSelect);
    res.json(safe);
  } catch {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

export async function updateUserPassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { password } = req.body as { password?: string };
    if (!password || password.length < 8) {
      res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
      return;
    }
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    user.password = password;
    await user.save();
    res.json({ message: 'Contraseña actualizada' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    if (String(user._id) === req.user!.id) {
      res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
      return;
    }
    if (user.role === 'superadmin' && user.isActive && (await activeSuperadminCount(String(user._id))) === 0) {
      res.status(400).json({ error: 'No se puede eliminar el último superadmin activo' });
      return;
    }
    await user.deleteOne();
    res.json({ message: 'Usuario eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.id).select(safeUserSelect);
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
}

export async function updateMyPassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, password } = req.body as { currentPassword?: string; password?: string };
    if (!currentPassword || !password) {
      res.status(400).json({ error: 'Contraseña actual y nueva contraseña son requeridas' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
      return;
    }
    const user = await User.findById(req.user!.id);
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    const matches = await user.comparePassword(currentPassword);
    if (!matches) {
      res.status(400).json({ error: 'La contraseña actual no coincide' });
      return;
    }
    user.password = password;
    await user.save();
    res.json({ message: 'Contraseña actualizada' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
}
