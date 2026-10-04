import { Response } from 'express';
import { AuthRequest } from '../../types';
import PrintAgent from '../models/PrintAgent';
import { generateDeviceToken, hashDeviceToken } from '../services/DeviceTokenService';

function withoutTokenHash(agent: InstanceType<typeof PrintAgent>): Record<string, unknown> {
  const plain = agent.toObject() as unknown as Record<string, unknown>;
  delete plain.tokenHash;
  return plain;
}

export async function getPrintAgents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const agents = await PrintAgent.find().select('-tokenHash').sort({ name: 1 });
    res.json(agents);
  } catch {
    res.status(500).json({ error: 'Error al obtener agentes de impresión' });
  }
}

// Returns the device token in cleartext exactly once — it is never
// recoverable afterward, only the bcrypt hash is persisted.
export async function createPrintAgent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name } = req.body as { name?: string };
    if (!name) { res.status(400).json({ error: 'El nombre es requerido' }); return; }

    const token = generateDeviceToken();
    const tokenHash = await hashDeviceToken(token);
    const agent = await PrintAgent.create({ name, tokenHash, isActive: true });

    res.status(201).json({ ...withoutTokenHash(agent), token });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear el agente de impresión', details: String(err) });
  }
}

export async function revokePrintAgent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const agent = await PrintAgent.findById(req.params.id);
    if (!agent) { res.status(404).json({ error: 'Agente no encontrado' }); return; }
    agent.isActive = false;
    await agent.save();
    res.json(withoutTokenHash(agent));
  } catch {
    res.status(500).json({ error: 'Error al revocar el agente de impresión' });
  }
}

export async function regeneratePrintAgentToken(req: AuthRequest, res: Response): Promise<void> {
  try {
    const agent = await PrintAgent.findById(req.params.id);
    if (!agent) { res.status(404).json({ error: 'Agente no encontrado' }); return; }

    const token = generateDeviceToken();
    agent.tokenHash = await hashDeviceToken(token);
    agent.isActive = true;
    await agent.save();

    res.json({ ...withoutTokenHash(agent), token });
  } catch {
    res.status(500).json({ error: 'Error al regenerar el token del agente' });
  }
}
