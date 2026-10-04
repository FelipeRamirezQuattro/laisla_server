import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({ env: { EINVOICE_PROVIDER: '' } }));

import { getProvider } from './getProvider';
import { MockProvider } from './MockProvider';

describe('getProvider', () => {
  it('returns a MockProvider when provider is explicitly MOCK', () => {
    const provider = getProvider({ provider: 'MOCK' });
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it('defaults to MockProvider when no config and no env var are set', () => {
    const provider = getProvider();
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it('throws a TODO(provider-docs) error for ALANUBE', () => {
    expect(() => getProvider({ provider: 'ALANUBE' })).toThrow(/TODO\(provider-docs\)/);
  });

  it('throws a TODO(provider-docs) error for BILIDOX', () => {
    expect(() => getProvider({ provider: 'BILIDOX' })).toThrow(/TODO\(provider-docs\)/);
  });
});
