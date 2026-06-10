import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { env } from '../config/env';

function buildAuthResponse(user: InstanceType<typeof User>) {
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarInitials: user.avatarInitials,
    },
  };
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: 'Usuario inactivo' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();

    res.json(buildAuthResponse(user));
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

export async function googleLogin(req: Request, res: Response): Promise<void> {
  try {
    if (!env.GOOGLE_CLIENT_ID) {
      res.status(500).json({ error: 'Google SSO no está configurado' });
      return;
    }

    const { credential } = req.body as { credential?: string };
    if (!credential) {
      res.status(422).json({ error: 'Credencial de Google requerida' });
      return;
    }

    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!tokenInfoRes.ok) {
      res.status(401).json({ error: 'No se pudo validar la cuenta de Google' });
      return;
    }
    const payload = await tokenInfoRes.json() as {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
    };
    if (payload.aud !== env.GOOGLE_CLIENT_ID) {
      res.status(401).json({ error: 'Credencial de Google inválida' });
      return;
    }
    const email = payload?.email?.toLowerCase();
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!email || !emailVerified) {
      res.status(401).json({ error: 'Cuenta de Google no verificada' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(403).json({ error: 'Tu cuenta de Google no está registrada en el panel' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: 'Usuario inactivo' });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();
    res.json(buildAuthResponse(user));
  } catch {
    res.status(401).json({ error: 'No se pudo validar la cuenta de Google' });
  }
}

export function logout(_req: Request, res: Response): void {
  res.json({ message: 'Sesión cerrada correctamente' });
}
