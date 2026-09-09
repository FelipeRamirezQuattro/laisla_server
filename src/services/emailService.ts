import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { env } from '../config/env';
import GmailAccount from '../models/GmailAccount';
import type { IReservation } from '../models/Reservation';

const zoneLabels: Record<string, string> = {
  social: 'Zona Social',
  'work-cafe': 'Work Cafe',
  terrace: 'Terraza',
};

const occasionLabels: Record<string, string> = {
  birthday: 'Cumpleanos',
  anniversary: 'Aniversario',
  'business meeting': 'Reunion de trabajo',
  'first date': 'Primera cita',
  celebration: 'Celebracion',
  other: 'Otra ocasion',
};

const templateCache = new Map<string, Handlebars.TemplateDelegate>();

// Mirrors frontend/src/utils/siteInfo.ts — kept in sync manually since the
// backend and frontend are separate projects with no shared package.
const BRAND = {
  logoUrl: `${env.FRONTEND_URL}/images/brand/logo-principal-blanco.png`,
  siteUrl: env.FRONTEND_URL,
  contactEmail: 'hola@laislacafepicnic.com',
  contactPhone: '311 863 8163',
};

interface MailTransport {
  transporter: Transporter;
  from: string;
  replyTo: string;
  logOnly: boolean;
}

function formatAddress(name: string, email: string) {
  const cleanEmail = email.trim();
  if (!name.trim()) return cleanEmail;
  return `${name.trim()} <${cleanEmail}>`;
}

async function getMailTransport(senderUserId?: string): Promise<MailTransport> {
  if (senderUserId && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const account = await GmailAccount.findOne({
      userId: senderUserId,
      gmailConnected: true,
    }).lean();

    if (account?.gmailEmail && account.gmailRefreshToken) {
      const from = formatAddress('La Isla Cafe', account.gmailEmail);
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: account.gmailEmail,
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          refreshToken: account.gmailRefreshToken,
          accessToken: account.gmailAccessToken || undefined,
          // Without this, nodemailer's XOAuth2 helper treats the stored
          // accessToken as never-expiring and keeps reusing it forever
          // instead of refreshing — Gmail then hard-rejects the stale
          // token (535) instead of prompting a retry, so nodemailer never
          // gets a chance to renew it mid-send.
          expires: account.gmailTokenExpiry ? account.gmailTokenExpiry.getTime() : undefined,
        },
      });
      // Persist whatever fresh token nodemailer renews so the next send
      // doesn't have to hit Google's token endpoint again.
      transporter.on('token', (token) => {
        GmailAccount.updateOne(
          { _id: account._id },
          { gmailAccessToken: token.accessToken, gmailTokenExpiry: new Date(token.expires) }
        ).catch((error) => {
          console.error('Error persisting refreshed Gmail token:', error);
        });
      });
      return {
        transporter,
        from,
        replyTo: account.gmailEmail,
        logOnly: false,
      };
    }
  }

  // The address shown in the From/Reply-To header can differ from the
  // account that actually authenticates with Gmail's SMTP server — e.g.
  // logging in as a Gmail account but sending "as" a branded address
  // configured under that account's Gmail "Send mail as" aliases.
  const displayAddress = env.EMAIL_DISPLAY_FROM || env.EMAIL_FROM;

  if (env.EMAIL_LOG_ONLY || !env.EMAIL_FROM || !env.EMAIL_PASSWORD) {
    const from = displayAddress || 'La Isla Cafe <no-reply@laisla.cafe>';
    return {
      transporter: nodemailer.createTransport({ jsonTransport: true }),
      from,
      replyTo: displayAddress || 'no-reply@laisla.cafe',
      logOnly: true,
    };
  }

  const from = formatAddress('La Isla Cafe', displayAddress);
  return {
    transporter: nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.EMAIL_FROM,
        pass: env.EMAIL_PASSWORD,
      },
    }),
    from,
    replyTo: displayAddress,
    logOnly: false,
  };
}

async function getTemplate(templateName: string) {
  const cached = templateCache.get(templateName);
  if (cached) return cached;

  const fileName = `${templateName}.handlebars`;
  const candidatePaths = [
    path.join(process.cwd(), 'templates', 'emails', fileName),
    path.join(__dirname, '..', '..', 'templates', 'emails', fileName),
  ];

  let source = '';
  for (const templatePath of candidatePaths) {
    try {
      source = await fs.readFile(templatePath, 'utf8');
      break;
    } catch {
      // Try the next runtime path.
    }
  }

  if (!source) {
    throw new Error(`Email template not found: ${fileName}`);
  }

  const template = Handlebars.compile(source);
  templateCache.set(templateName, template);
  return template;
}

function textFromHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatReservationDate(date: Date) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(date);
}

export function markdownToEmailHtml(markdown: string) {
  const escaped = Handlebars.escapeExpression(markdown);
  return escaped
    .split(/\n{2,}/)
    .map((block) => block.trim().replace(/\n/g, '<br />'))
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 18px;">${block}</p>`)
    .join('');
}

export async function sendTemplatedEmail(
  templateName: string,
  options: Omit<SendMailOptions, 'from' | 'html' | 'text'> & {
    context: Record<string, unknown>;
    senderUserId?: string;
  }
) {
  const template = await getTemplate(templateName);
  const mail = await getMailTransport(options.senderUserId);
  const html = template({
    logoUrl: BRAND.logoUrl,
    siteUrl: BRAND.siteUrl,
    contactEmail: BRAND.contactEmail,
    contactPhone: BRAND.contactPhone,
    ...options.context,
  });
  const { context: _context, senderUserId: _senderUserId, ...mailOptions } = options;
  const info = await mail.transporter.sendMail({
    ...mailOptions,
    from: mail.from,
    replyTo: mail.replyTo,
    html,
    text: textFromHtml(html),
  });

  if (mail.logOnly) {
    console.log('Email rendered in EMAIL_LOG_ONLY mode:', info.message);
  }

  return info;
}

function reservationContext(reservation: IReservation) {
  return {
    clientName: reservation.clientName,
    confirmationCode: reservation.confirmationCode,
    dateLabel: formatReservationDate(reservation.date),
    timeSlot: reservation.timeSlot,
    partySize: `${reservation.partySize} persona${reservation.partySize === 1 ? '' : 's'}`,
    zoneLabel: zoneLabels[reservation.zone] || reservation.zone,
    occasionLabel: reservation.specialOccasion?.hasOccasion
      ? occasionLabels[reservation.specialOccasion.type || 'other'] || 'Registrada'
      : '',
  };
}

/** Sent immediately when a guest submits a public reservation (status: pending). */
export async function sendReservationReceivedEmail(reservation: IReservation) {
  return sendTemplatedEmail('reservation-received', {
    to: reservation.email,
    subject: `Recibimos tu solicitud de reserva ${reservation.confirmationCode} - La Isla Cafe`,
    context: reservationContext(reservation),
  });
}

/** Sent when an admin confirms the reservation and assigns a table. */
export async function sendReservationConfirmedEmail(reservation: IReservation, tableLabel?: string) {
  return sendTemplatedEmail('reservation-confirmed', {
    to: reservation.email,
    subject: `Reserva confirmada ${reservation.confirmationCode} - La Isla Cafe`,
    context: { ...reservationContext(reservation), tableLabel: tableLabel || '' },
  });
}

export async function sendNewsletterEmail(params: {
  to: string;
  subject: string;
  preheader?: string;
  body: string;
  senderUserId?: string;
}) {
  return sendTemplatedEmail('newsletter', {
    to: params.to,
    subject: params.subject,
    senderUserId: params.senderUserId,
    context: {
      subject: params.subject,
      preheader: params.preheader,
      bodyHtml: markdownToEmailHtml(params.body),
    },
  });
}

/** Sent once, right when someone subscribes to the newsletter for the first
 * time (or re-subscribes after unsubscribing). */
export async function sendWelcomeEmail(params: { to: string; name?: string }) {
  return sendTemplatedEmail('welcome', {
    to: params.to,
    subject: 'Bienvenido al boletín de La Isla',
    context: { name: params.name || '' },
  });
}
