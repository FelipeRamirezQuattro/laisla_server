import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ error: 'Datos de entrada inválidos', details: errors.array() });
    return;
  }
  next();
}

export const loginValidators = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
];

export const productValidators = [
  body('name').notEmpty().withMessage('Nombre requerido'),
  body('price').isFloat({ min: 0 }).withMessage('Precio debe ser mayor o igual a 0'),
  body('category')
    .isIn(['coffee', 'food', 'beverage', 'experience', 'work-cafe', 'other'])
    .withMessage('Categoría inválida'),
];

export const tableValidators = [
  body('name').notEmpty().withMessage('Nombre requerido'),
  body('capacity').isInt({ min: 1 }).withMessage('Capacidad debe ser al menos 1'),
  body('zone').notEmpty().withMessage('Zona requerida'),
];

export const orderValidators = [
  body('tableId').optional({ nullable: true }).isMongoId().withMessage('Mesa inválida'),
  body('items').isArray({ min: 1 }).withMessage('Se requiere al menos un producto'),
];

export const reservationValidators = [
  body('clientName').notEmpty().withMessage('Nombre requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('phone').notEmpty().withMessage('Teléfono requerido'),
  body('date').isISO8601().withMessage('Fecha inválida'),
  body('timeSlot').notEmpty().withMessage('Horario requerido'),
  body('partySize').isInt({ min: 1 }).withMessage('Número de personas inválido'),
  body('zone')
    .isIn(['social', 'work-cafe', 'terrace'])
    .withMessage('Zona inválida'),
];

export const eventValidators = [
  body('title').notEmpty().withMessage('Título requerido'),
  body('type')
    .isIn(['picnic', 'movie', 'trivia', 'tasting', 'dinner-with-strangers', 'other'])
    .withMessage('Tipo de evento inválido'),
  body('date').isISO8601().withMessage('Fecha inválida'),
  body('time').notEmpty().withMessage('Hora requerida'),
  body('pricePerPerson').isFloat({ min: 0 }).withMessage('Precio inválido'),
  body('maxCapacity').isInt({ min: 1 }).withMessage('Capacidad máxima inválida'),
];

export const dinnerGuestValidators = [
  body('eventId').notEmpty().withMessage('Evento requerido'),
  body('name').notEmpty().withMessage('Nombre requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('phone').notEmpty().withMessage('Teléfono requerido'),
  body('ageRange')
    .isIn(['18-24', '25-32', '33-40', '41-50', '50+'])
    .withMessage('Rango de edad inválido'),
  body('compatibilityProfile').notEmpty().withMessage('Perfil de compatibilidad requerido'),
];
