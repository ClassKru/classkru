import { GAME } from './config.js';
import { isBlocked } from './isometric.js';

export function updateMonsterAI(scene, monster, player, dt, room, invulnerable) {
  if (monster.defeated) return;
  monster.bob += dt * (monster.state === 'chase' ? 8 : 4.5);
  if (monster.state === 'hit') {
    monster.hitLeft -= dt;
    if (monster.hitLeft <= 0) monster.state = 'idle';
    return;
  }
  if (monster.state === 'attack') {
    monster.attackStateLeft -= dt;
    if (monster.attackStateLeft <= 0) {
      monster.state = 'idle';
      monster.attackPending = false;
      const stillClose = Math.hypot(player.position.x - monster.x, player.position.y - monster.y) <= monster.attackRange + 0.18;
      if (stillClose && invulnerable) {
        scene.ui.setStatus('หลบการโจมตีได้!');
      } else if (stillClose) {
        scene.damagePlayer(monster.damage, monster);
        scene.effects.burstAtWorld(monster.x, monster.y, 2, 27);
      } else {
        scene.ui.setStatus('หลบการโจมตีได้!');
      }
    }
    return;
  }

  const dx = player.position.x - monster.x;
  const dy = player.position.y - monster.y;
  const range = Math.hypot(dx, dy);
  monster.attackCooldownLeft = Math.max(0, monster.attackCooldownLeft - dt);

  if (range > monster.detectionRange) {
    monster.state = 'idle';
    return;
  }
  if (range <= monster.attackRange) {
    const currentAttackers = scene.aliveMonsters().filter((candidate) => candidate.state === 'attack').length;
    if (monster.attackCooldownLeft <= 0 && currentAttackers < 1) {
      monster.state = 'attack';
      monster.attackStateLeft = 0.62;
      monster.attackPending = true;
      monster.attackCooldownLeft = monster.attackCooldown;
      scene.ui.setStatus(monster.name + ' กำลังเตรียมโจมตี — กด Space เพื่อหลบ!');
    }
    return;
  }

  monster.state = 'chase';
  const stepX = (dx / Math.max(0.001, range)) * monster.speed * dt;
  const stepY = (dy / Math.max(0.001, range)) * monster.speed * dt;
  const nextX = monster.x + stepX;
  const nextY = monster.y + stepY;
  if (!isBlocked(nextX, monster.y, room, GAME.playerRadius * 0.8)) monster.x = nextX;
  if (!isBlocked(monster.x, nextY, room, GAME.playerRadius * 0.8)) monster.y = nextY;
}
