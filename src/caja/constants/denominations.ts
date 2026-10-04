export type DenominationKind = 'bill' | 'coin';

export interface DenominationDefinition {
  value: number;
  kind: DenominationKind;
}

// Colombian peso denominations recognized by the arqueo (cash-count) UI.
// $1.000 exists as both a billete and a moneda, so denominations are keyed
// by (value, kind), never by value alone. Kept as one constant so
// adding/removing a bill or coin is a one-line change.
export const COP_DENOMINATIONS: DenominationDefinition[] = [
  { value: 100000, kind: 'bill' },
  { value: 50000, kind: 'bill' },
  { value: 20000, kind: 'bill' },
  { value: 10000, kind: 'bill' },
  { value: 5000, kind: 'bill' },
  { value: 2000, kind: 'bill' },
  { value: 1000, kind: 'bill' },
  { value: 1000, kind: 'coin' },
  { value: 500, kind: 'coin' },
  { value: 200, kind: 'coin' },
  { value: 100, kind: 'coin' },
  { value: 50, kind: 'coin' },
];

// COP amounts, not basis points — tune per the café's actual tolerance.
// "justification": a difference beyond this requires a written reason.
// "approval": a difference beyond this also requires admin/superadmin sign-off.
export const DEFAULT_DIFFERENCE_THRESHOLDS = {
  justification: 2000,
  approval: 10000,
};
