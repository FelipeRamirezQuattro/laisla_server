// Tipos de gasto. Lógica pura para poder probarla directamente.
export const EXPENSE_TYPES = ['INSUMO', 'OTRO', 'MANO_OBRA', 'GIF'] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

// Pagos de nómina y gastos indirectos: solo los registra y edita un administrador.
export const RESTRICTED_EXPENSE_TYPES: readonly ExpenseType[] = ['MANO_OBRA', 'GIF'];

// Sin `type` se asume gasto general (clientes antiguos); un valor desconocido NO cae en OTRO:
// devuelve null para que el controlador lo rechace en vez de guardarlo mal clasificado.
export function parseExpenseType(value: unknown): ExpenseType | null {
  if (value === undefined || value === null || value === '') return 'OTRO';
  return (EXPENSE_TYPES as readonly string[]).includes(value as string) ? (value as ExpenseType) : null;
}

export function isRestrictedExpenseType(type: string): boolean {
  return (RESTRICTED_EXPENSE_TYPES as readonly string[]).includes(type);
}
