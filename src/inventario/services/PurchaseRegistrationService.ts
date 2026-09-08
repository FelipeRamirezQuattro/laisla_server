import mongoose from 'mongoose';
import Insumo, { IInsumo } from '../models/Insumo';
import InsumoStockMovement from '../models/InsumoStockMovement';
import Provider from '../../models/Provider';
import { normalizeMeasurementUnit, toBaseQuantity } from '../../utils/measurementUnits';

export interface RegisterPurchaseInput {
  insumoId: string;
  quantity: number;
  unit?: string;
  providerId?: string | null;
  date?: Date;
  notes?: string;
  /** Notes fallback used only when `notes` is omitted (e.g. "Compra de {nombre}"). */
  defaultNotes?: (insumo: IInsumo) => string;
  userId: string;
}

/**
 * Registers an approved insumo purchase: validates the insumo/quantity,
 * attaches the provider to the insumo if given, and creates the resulting
 * `InsumoStockMovement` (tipo COMPRA, estado APROBADO). Shared by the daily
 * expense flow (type=INSUMO) and the inventory "stock" purchase endpoint —
 * both used to implement this independently. Throws on validation failure;
 * callers map the message to the appropriate HTTP status.
 */
export async function registerInsumoPurchase(input: RegisterPurchaseInput) {
  const insumo = await Insumo.findById(input.insumoId);
  if (!insumo) throw new Error('Insumo no encontrado');

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('La cantidad comprada debe ser mayor a cero');
  }

  const unit = normalizeMeasurementUnit(input.unit ?? insumo.unidad);

  if (input.providerId) {
    const provider = await Provider.findById(input.providerId).lean();
    if (!provider) throw new Error('Proveedor no encontrado');
    const providerObjectId = new mongoose.Types.ObjectId(input.providerId);
    insumo.proveedorPrincipalId = providerObjectId;
    if (!insumo.proveedorIds.some((id) => String(id) === input.providerId)) {
      insumo.proveedorIds.push(providerObjectId);
    }
    await insumo.save();
  }

  const notas = input.notes ?? (input.defaultNotes ? input.defaultNotes(insumo) : '');

  const movement = await InsumoStockMovement.create({
    insumoId: insumo._id,
    tipo: 'COMPRA',
    estado: 'APROBADO',
    cantidad: input.quantity,
    unidad: unit,
    cantidadBase: toBaseQuantity(input.quantity, unit),
    fecha: input.date ?? new Date(),
    providerId: input.providerId || null,
    notas,
    creadoPor: input.userId,
    aprobadoPor: input.userId,
    aprobadoEn: new Date(),
  });

  return { insumo, movement, unit };
}
