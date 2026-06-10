import crypto from 'crypto';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import GmailAccount from '../models/GmailAccount';
import { env } from '../config/env';
import { AuthRequest } from '../types';

const GMAIL_SCOPES = ['https://mail.google.com/', 'email'];

function safeReturnTo(value?: string) {
  if (!value || !value.startsWith('/')) return '/admin/boletines';
  if (value.startsWith('//')) return '/admin/boletines';
  return value;
}

function encodeState(payload: { userId: string; returnTo: string }) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function decodeState(state: string) {
  const [body, signature] = state.split('.');
  const expected = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(body)
    .digest('base64url');
  const signatureBuffer = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);
  if (
    !body ||
    !signature ||
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid Gmail OAuth state');
  }
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { userId: string; returnTo: string };
}

function requireGmailConfig(res: Response) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_GMAIL_REDIRECT_URI) {
    res.status(500).json({ error: 'Gmail OAuth no está configurado' });
    return false;
  }
  return true;
}

export async function getGmailStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const account = await GmailAccount.findOne({ userId: req.user!.id }).lean();
    res.json({
      connected: !!account?.gmailConnected,
      gmailEmail: account?.gmailEmail || '',
      updatedAt: account?.updatedAt,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener estado de Gmail' });
  }
}

export function startGmailAuth(req: AuthRequest, res: Response): void {
  if (!requireGmailConfig(res)) return;

  const state = encodeState({
    userId: req.user!.id,
    returnTo: safeReturnTo(String(req.query.returnTo || '/admin/boletines')),
  });
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_GMAIL_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES.join(' '),
    state,
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
}

export async function gmailCallback(req: Request, res: Response): Promise<void> {
  try {
    if (!requireGmailConfig(res)) return;

    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code || !state) {
      res.status(400).send('Solicitud de Gmail inválida');
      return;
    }

    const decodedState = decodeState(state);
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_GMAIL_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(await tokenRes.text());
    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      id_token?: string;
    };

    const idPayload = tokens.id_token
      ? jwt.decode(tokens.id_token) as { email?: string; sub?: string } | null
      : null;
    const gmailEmail = idPayload?.email;
    if (!gmailEmail) throw new Error('Google did not return a Gmail email');

    const existing = await GmailAccount.findOne({ userId: decodedState.userId });
    await GmailAccount.findOneAndUpdate(
      { userId: decodedState.userId },
      {
        googleSubject: idPayload?.sub || existing?.googleSubject || '',
        gmailEmail,
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token || existing?.gmailRefreshToken || '',
        gmailTokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        gmailConnected: true,
      },
      { upsert: true, new: true }
    );

    res.redirect(`${env.FRONTEND_URL}${safeReturnTo(decodedState.returnTo)}`);
  } catch {
    res.status(500).send('No se pudo conectar Gmail');
  }
}

export async function disconnectGmail(req: AuthRequest, res: Response): Promise<void> {
  try {
    await GmailAccount.findOneAndUpdate(
      { userId: req.user!.id },
      {
        gmailAccessToken: '',
        gmailRefreshToken: '',
        gmailTokenExpiry: null,
        gmailConnected: false,
      }
    );
    res.json({ message: 'Gmail desconectado' });
  } catch {
    res.status(500).json({ error: 'Error al desconectar Gmail' });
  }
}
