import { Response, NextFunction } from 'express';
import { DeviceRequest } from '../types';
import PrintAgent, { IPrintAgent } from '../printing/models/PrintAgent';
import { verifyDeviceToken } from '../printing/services/DeviceTokenService';

// Opaque bearer tokens can't be looked up by a query (only their bcrypt hash
// is stored), so an active agent's token is matched by comparing against
// every active agent's hash. In practice there are only a handful of agents
// (one per printing PC/Raspberry Pi at a single café), so this is cheap.
async function findMatchingAgent(token: string): Promise<IPrintAgent | null> {
  const agents = await PrintAgent.find({ isActive: true });
  for (const agent of agents) {
    if (await verifyDeviceToken(token, agent.tokenHash)) return agent;
  }
  return null;
}

export async function deviceAuthMiddleware(req: DeviceRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de dispositivo requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const agent = await findMatchingAgent(token);
    if (!agent) {
      res.status(401).json({ error: 'Token de dispositivo inválido o revocado' });
      return;
    }
    req.device = { agentId: agent.id };
    next();
  } catch {
    res.status(401).json({ error: 'Token de dispositivo inválido o revocado' });
  }
}
