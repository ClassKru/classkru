export const GAME = Object.freeze({
  width: 960,
  height: 640,
  tileWidth: 64,
  tileHeight: 32,
  roomSize: 10,
  playerRadius: 0.28,
  playerSpeed: 3.25,
  dodgeSpeed: 8,
  dodgeDuration: 0.26,
  dodgeCooldown: 0.9,
  questionTimeLimitSeconds: 10,
  maxMonsters: 5,
});

export const PLAYER = Object.freeze({
  maxHp: 100,
  startingMana: 20,
  maxMana: 100,
  manaPerCorrect: 10,
  manaComboBonusPerCorrect: 2,
  manaComboBonusCap: 10,
  manaLossOnWrong: 8,
  basicDamage: 8,
  basicRange: 1.25,
  basicCooldown: 0.72,
});

export const SPELLS = Object.freeze({
  fireball: { name: 'Fireball', cost: 30, damage: 34, range: 9, cooldown: 1.2, kind: 'single' },
  lightning: { name: 'Lightning', cost: 50, damage: 52, chainDamage: 20, range: 8, chainRange: 4.1, cooldown: 2.5, kind: 'chain' },
  meteor: { name: 'Meteor', cost: 100, damage: 72, radius: 2.6, range: 8, cooldown: 5.5, kind: 'area' },
});

export const DIFFICULTIES = Object.freeze({
  easy: { label: 'ง่าย', seconds: 18 },
  medium: { label: 'ปานกลาง', seconds: 14 },
  hard: { label: 'ท้าทาย', seconds: 11 },
});

export const MONSTER_TYPES = Object.freeze({
  slime: { name: 'สไลม์วุ้น', frame: 8, hp: 48, damage: 8, speed: 1.28, detectionRange: 7, attackRange: 0.9, attackCooldown: 2.05, color: '#77d9bd' },
  mushroom: { name: 'เห็ดน้อย', frame: 12, hp: 58, damage: 10, speed: 1.05, detectionRange: 6.5, attackRange: 1.05, attackCooldown: 2.35, color: '#f4a49c' },
  bat: { name: 'ค้างคาวจิ๋ว', frame: 16, hp: 42, damage: 9, speed: 1.7, detectionRange: 8, attackRange: 1.2, attackCooldown: 1.9, color: '#a99be8' },
});
