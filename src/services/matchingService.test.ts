import { describe, expect, it } from 'vitest';
import type { CompatibilityProfile, GuestForMatching } from '../types';
import { generateGroups, scorePair } from './matchingService';

const baseProfile: CompatibilityProfile = {
  socialEnergy: 3,
  conversationType: 'deep',
  workAttitude: 3,
  hobbies: ['café', 'lectura'],
  spontaneity: 3,
  dinnerStyle: 'intimate',
  personalityTag: 'empathetic'
};

function guest(id: number, profile: Partial<CompatibilityProfile> = {}): GuestForMatching {
  return {
    _id: `guest-${id}`,
    name: `Guest ${id}`,
    ageRange: '25-32',
    compatibilityProfile: { ...baseProfile, ...profile }
  };
}

describe('scorePair', () => {
  it('awards all compatibility dimensions for identical profiles', () => {
    expect(scorePair(baseProfile, baseProfile)).toBe(15);
  });

  it('only awards shared hobbies when profiles otherwise differ', () => {
    const different: CompatibilityProfile = {
      socialEnergy: 5,
      conversationType: 'casual',
      workAttitude: 5,
      hobbies: ['lectura', 'viajes'],
      spontaneity: 5,
      dinnerStyle: 'lively',
      personalityTag: 'adventurous'
    };
    expect(scorePair(baseProfile, different)).toBe(2);
  });
});

describe('generateGroups', () => {
  it('returns no groups for an empty guest list', () => {
    expect(generateGroups([])).toEqual([]);
  });

  it('preserves a single real guest id', () => {
    expect(generateGroups([guest(1)])).toEqual([{ groupNumber: 1, guests: ['guest-1'] }]);
  });

  it('creates groups of at most six without losing or duplicating guests', () => {
    const guests = Array.from({ length: 13 }, (_, index) => guest(index + 1));
    const groups = generateGroups(guests);
    const assigned = groups.flatMap((group) => group.guests);

    expect(groups.map((group) => group.guests.length)).toEqual([6, 6, 1]);
    expect(new Set(assigned).size).toBe(13);
    expect(assigned.sort()).toEqual(guests.map((item) => item._id).sort());
  });

  it('seeds the first group with the highest-scoring pair', () => {
    const compatibleA = guest(1);
    const compatibleB = guest(2);
    const different = guest(3, {
      socialEnergy: 5,
      conversationType: 'casual',
      workAttitude: 5,
      hobbies: ['música'],
      spontaneity: 5,
      dinnerStyle: 'lively',
      personalityTag: 'adventurous'
    });
    const firstGroup = generateGroups([compatibleA, different, compatibleB])[0];
    expect(firstGroup.guests.slice(0, 2)).toEqual(['guest-1', 'guest-2']);
  });
});
