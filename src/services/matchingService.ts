import { GuestForMatching, CompatibilityProfile, MatchingGroup } from '../types';

/**
 * Calculates a compatibility score between two guests.
 * Higher score = more compatible.
 * Max possible score: ~20+ points
 */
export function scorePair(a: CompatibilityProfile, b: CompatibilityProfile): number {
  let score = 0;

  // Social energy similarity (diff <= 1: +2)
  if (Math.abs(a.socialEnergy - b.socialEnergy) <= 1) score += 2;

  // Same conversation type (+3)
  if (a.conversationType === b.conversationType) score += 3;

  // Work attitude similarity (diff <= 1: +1)
  if (Math.abs(a.workAttitude - b.workAttitude) <= 1) score += 1;

  // Shared hobbies (+2 per shared hobby)
  const sharedHobbies = a.hobbies.filter((h) => b.hobbies.includes(h));
  score += sharedHobbies.length * 2;

  // Spontaneity similarity (diff <= 1: +1)
  if (Math.abs(a.spontaneity - b.spontaneity) <= 1) score += 1;

  // Same dinner style (+2)
  if (a.dinnerStyle === b.dinnerStyle) score += 2;

  // Same personality tag (+2)
  if (a.personalityTag === b.personalityTag) score += 2;

  return score;
}

/**
 * Calculates the average compatibility score of a candidate against all members of an existing group.
 */
function avgScoreAgainstGroup(
  candidate: GuestForMatching,
  group: GuestForMatching[],
  matrix: number[][]
): number {
  if (group.length === 0) return 0;
  const totalScore = group.reduce((sum, member) => {
    return sum + matrix[parseInt(candidate._id)][parseInt(member._id)];
  }, 0);
  return totalScore / group.length;
}

/**
 * Builds an N×N compatibility score matrix for all guests.
 * Uses array indices as IDs internally.
 */
function buildScoreMatrix(guests: GuestForMatching[]): number[][] {
  const n = guests.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const score = scorePair(guests[i].compatibilityProfile, guests[j].compatibilityProfile);
      matrix[i][j] = score;
      matrix[j][i] = score;
    }
  }

  return matrix;
}

/**
 * Groups guests into tables of 6 using a greedy compatibility algorithm.
 *
 * Algorithm:
 * 1. Build N×N score matrix
 * 2. Find the highest-scoring unpaired pair → seed a new group
 * 3. Repeatedly add the unassigned guest with highest avg score vs current group until group has 6
 * 4. Repeat until all guests are assigned
 * 5. Last group may have fewer than 6 if total is not divisible
 */
export function generateGroups(guests: GuestForMatching[]): MatchingGroup[] {
  if (guests.length === 0) return [];

  // Map real _id to index for matrix access
  const indexedGuests = guests.map((g, i) => ({
    ...g,
    _id: String(i),
  }));

  const matrix = buildScoreMatrix(indexedGuests);
  const unassigned = new Set<number>(indexedGuests.map((_, i) => i));
  const groups: MatchingGroup[] = [];
  let groupNumber = 1;
  const GROUP_SIZE = 6;

  while (unassigned.size > 0) {
    const unassignedArr = Array.from(unassigned);

    // Seed: find highest-scoring pair among unassigned guests
    let bestScore = -1;
    let seedA = unassignedArr[0];
    let seedB = unassignedArr.length > 1 ? unassignedArr[1] : -1;

    if (unassignedArr.length >= 2) {
      for (let i = 0; i < unassignedArr.length; i++) {
        for (let j = i + 1; j < unassignedArr.length; j++) {
          const s = matrix[unassignedArr[i]][unassignedArr[j]];
          if (s > bestScore) {
            bestScore = s;
            seedA = unassignedArr[i];
            seedB = unassignedArr[j];
          }
        }
      }
    }

    const currentGroup: number[] = [seedA];
    unassigned.delete(seedA);

    if (seedB !== -1 && unassigned.has(seedB)) {
      currentGroup.push(seedB);
      unassigned.delete(seedB);
    }

    // Fill group up to GROUP_SIZE
    while (currentGroup.length < GROUP_SIZE && unassigned.size > 0) {
      let bestCandidate = -1;
      let bestAvg = -1;

      for (const idx of unassigned) {
        const avg = currentGroup.reduce((sum, member) => sum + matrix[idx][member], 0) / currentGroup.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestCandidate = idx;
        }
      }

      if (bestCandidate !== -1) {
        currentGroup.push(bestCandidate);
        unassigned.delete(bestCandidate);
      }
    }

    // Map indices back to real guest IDs
    groups.push({
      groupNumber,
      guests: currentGroup.map((idx) => guests[idx]._id),
    });
    groupNumber++;
  }

  return groups;
}
