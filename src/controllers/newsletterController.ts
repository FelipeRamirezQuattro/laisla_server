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
    const [subscribers, total] = await Promise.all([
      NewsletterSubscriber.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      NewsletterSubscriber.countDocuments(),
    ]);

    res.json({ subscribers, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Error al obtener suscriptores' });
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
