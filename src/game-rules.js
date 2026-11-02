import { PLAYER } from './config.js';

export function correctAnswerManaReward(streak) {
  const safeStreak = Math.max(1, Math.floor(Number(streak) || 1));
  const comboBonus = Math.min(
    PLAYER.manaComboBonusCap,
    (safeStreak - 1) * PLAYER.manaComboBonusPerCorrect,
  );
  return { base: PLAYER.manaPerCorrect, comboBonus, total: PLAYER.manaPerCorrect + comboBonus };
}

export function wrongAnswerManaLoss(currentMana) {
  return Math.min(Math.max(0, Math.floor(Number(currentMana) || 0)), PLAYER.manaLossOnWrong);
}
