import { describe, expect, it } from 'vitest';
import { validatePassword } from './passwordPolicy';

describe('validatePassword', () => {
  it.each([undefined, '', 'short7'])(
    'rejects missing or short password: %s',
    (password) => {
      expect(validatePassword(password)).toEqual({
        valid: false,
        message: 'La contraseña debe tener mínimo 8 caracteres'
      });
    }
  );

  it.each(['Cafe1234!', 'Cafe4321!', 'abc987xyz'])('rejects sequential digits in %s', (password) => {
    expect(validatePassword(password)).toMatchObject({ valid: false });
  });

  it.each(['Cafe1357!', 'isla-2026', 'A1b2C3d4'])('accepts a valid password: %s', (password) => {
    expect(validatePassword(password)).toEqual({ valid: true });
  });
});
