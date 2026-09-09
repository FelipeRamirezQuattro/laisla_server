const MIN_LENGTH = 8;
const CONSECUTIVE_RUN_LENGTH = 3;

function hasConsecutiveDigits(password: string): boolean {
  const digitRuns = password.match(/\d+/g) ?? [];
  return digitRuns.some((run) => {
    if (run.length < CONSECUTIVE_RUN_LENGTH) return false;
    let ascendingStreak = 1;
    let descendingStreak = 1;
    for (let i = 1; i < run.length; i += 1) {
      const diff = run.charCodeAt(i) - run.charCodeAt(i - 1);
      ascendingStreak = diff === 1 ? ascendingStreak + 1 : 1;
      descendingStreak = diff === -1 ? descendingStreak + 1 : 1;
      if (ascendingStreak >= CONSECUTIVE_RUN_LENGTH || descendingStreak >= CONSECUTIVE_RUN_LENGTH) return true;
    }
    return false;
  });
}

export function validatePassword(password: string | undefined): { valid: boolean; message?: string } {
  if (!password || password.length < MIN_LENGTH) {
    return { valid: false, message: `La contraseña debe tener mínimo ${MIN_LENGTH} caracteres` };
  }
  if (hasConsecutiveDigits(password)) {
    return { valid: false, message: 'La contraseña no puede contener 3 o más dígitos consecutivos (ej: 123, 321)' };
  }
  return { valid: true };
}
