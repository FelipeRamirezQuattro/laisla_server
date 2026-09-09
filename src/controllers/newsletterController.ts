import { Request, Response } from 'express';
import NewsletterSubscriber from '../models/NewsletterSubscriber';
import NewsletterCampaign from '../models/NewsletterCampaign';
import { AuthRequest } from '../types';
import { sendNewsletterEmail } from '../services/emailService';

function getPagination(query: Record<string, string | string[] | undefined>) {
  const page = parseInt(String(query.page || '1'), 10);
  const limit = parseInt(String(query.limit || '20'), 10);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export async function subscribeToNewsletter(req: Request, res: Response): Promise<void> {
  try {
    const email = String(req.body.email).trim().toLowerCase();
    const name = req.body.name ? String(req.body.name).trim() : '';

    const subscriber = await NewsletterSubscriber.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          status: 'active',
          source: 'homepage',
          unsubscribedAt: null,
        },
        $setOnInsert: { subscribedAt: new Date() },
      },
      { new: true, upsert: true }
    );

    res.status(201).json({
      message: 'Suscripcion registrada',
      subscriber: {
        _id: subscriber._id,
        email: subscriber.email,
        status: subscriber.status,
      },
    });
  } catch {
    res.status(500).json({ error: 'Error al registrar suscripcion' });
  }
}

export async function getNewsletterSummary(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const [activeSubscribers, totalSubscribers, sentCampaigns] = await Promise.all([
      NewsletterSubscriber.countDocuments({ status: 'active' }),
      NewsletterSubscriber.countDocuments(),
      NewsletterCampaign.countDocuments({ status: 'sent' }),
    ]);

    res.json({ activeSubscribers, totalSubscribers, sentCampaigns });
  } catch {
    res.status(500).json({ error: 'Error al obtener resumen del boletin' });
  }
}

export async function getNewsletterSubscribers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, string>);
    const { search, status } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) filter.status = status;

    const [subscribers, total] = await Promise.all([
      NewsletterSubscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      NewsletterSubscriber.countDocuments(filter),
    ]);

    res.json({ subscribers, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Error al obtener suscriptores' });
  }
}

export async function createNewsletterSubscriber(req: AuthRequest, res: Response): Promise<void> {
  try {
    const email = String(req.body.email).trim().toLowerCase();
    const existing = await NewsletterSubscriber.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'Ya existe un suscriptor con ese email' });
      return;
    }

    const subscriber = await NewsletterSubscriber.create({
      email,
      name: req.body.name ? String(req.body.name).trim() : '',
      status: req.body.status === 'unsubscribed' ? 'unsubscribed' : 'active',
      source: 'admin',
      subscribedAt: new Date(),
    });
    res.status(201).json(subscriber);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear suscriptor', details: String(err) });
  }
}

export async function updateNewsletterSubscriber(req: AuthRequest, res: Response): Promise<void> {
  try {
    const subscriber = await NewsletterSubscriber.findById(req.params.id);
    if (!subscriber) {
      res.status(404).json({ error: 'Suscriptor no encontrado' });
      return;
    }

    if (req.body.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();
      const existing = await NewsletterSubscriber.findOne({ email, _id: { $ne: subscriber._id } });
      if (existing) {
        res.status(409).json({ error: 'Ya existe un suscriptor con ese email' });
        return;
      }
      subscriber.email = email;
    }
    if (req.body.name !== undefined) subscriber.name = String(req.body.name).trim();
    if (req.body.status !== undefined && req.body.status !== subscriber.status) {
      subscriber.status = req.body.status;
      subscriber.unsubscribedAt = req.body.status === 'unsubscribed' ? new Date() : undefined;
    }

    await subscriber.save();
    res.json(subscriber);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar suscriptor', details: String(err) });
  }
}

export async function deleteNewsletterSubscriber(req: AuthRequest, res: Response): Promise<void> {
  try {
    const subscriber = await NewsletterSubscriber.findByIdAndDelete(req.params.id);
    if (!subscriber) {
      res.status(404).json({ error: 'Suscriptor no encontrado' });
      return;
    }
    res.json({ message: 'Suscriptor eliminado' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar suscriptor' });
  }
}

export async function getNewsletterCampaigns(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query as Record<string, string>);
    const [campaigns, total] = await Promise.all([
      NewsletterCampaign.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      NewsletterCampaign.countDocuments(),
    ]);

    res.json({ campaigns, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Error al obtener boletines' });
  }
}

export async function createNewsletterCampaign(req: AuthRequest, res: Response): Promise<void> {
  try {
    const campaign = await NewsletterCampaign.create({
      subject: req.body.subject,
      preheader: req.body.preheader || '',
      body: req.body.body,
      createdBy: req.user?.id,
    });

    res.status(201).json(campaign);
  } catch {
    res.status(500).json({ error: 'Error al crear boletin' });
  }
}

export async function sendNewsletterCampaign(req: AuthRequest, res: Response): Promise<void> {
  try {
    const campaign = await NewsletterCampaign.findById(req.params.id);
    if (!campaign) {
      res.status(404).json({ error: 'Boletin no encontrado' });
      return;
    }
    if (campaign.status === 'sent') {
      res.status(409).json({ error: 'Este boletin ya fue enviado' });
      return;
    }

    const subscribers = await NewsletterSubscriber.find({ status: 'active' }).select('email');
    let sentCount = 0;
    let failedCount = 0;

    for (const subscriber of subscribers) {
      try {
        await sendNewsletterEmail({
          to: subscriber.email,
          subject: campaign.subject,
          preheader: campaign.preheader,
          body: campaign.body,
          senderUserId: req.user!.id,
        });
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error(`Error sending newsletter to ${subscriber.email}:`, error);
      }
    }

    campaign.status = 'sent';
    campaign.recipientsCount = subscribers.length;
    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;
    campaign.sentAt = new Date();
    await campaign.save();

    res.json(campaign);
  } catch {
    res.status(500).json({ error: 'Error al enviar boletin' });
  }
}
