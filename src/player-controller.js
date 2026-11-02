import { GAME, PLAYER } from './config.js';
import { isBlocked, projectIso } from './isometric.js';

export function isoMovementVector(input) {
  const horizontal = Number(Boolean(input.right)) - Number(Boolean(input.left));
  const vertical = Number(Boolean(input.down)) - Number(Boolean(input.up));
  const x = horizontal + vertical;
  const y = vertical - horizontal;
  const magnitude = Math.hypot(x, y);
  return magnitude
    ? { x: x / magnitude, y: y / magnitude, moving: true }
    : { x: 0, y: 0, moving: false };
}

export class PlayerController {
  constructor(scene) {
    this.scene = scene;
    this.position = { x: 5, y: 8.15 };
    this.direction = { x: -1, y: -1 };
    this.dodgeLeft = 0;
    this.dodgeCooldownLeft = 0;
    this.invulnerability = 0;
    this.walkTime = 0;
    this.shadow = scene.add.ellipse(0, 0, 39, 15, 0x43325e, 0.24).setDepth(5);
    this.sprite = scene.add.sprite(0, 0, 'atlas', 0).setOrigin(0.5, 0.73).setDepth(10);
  }

  setPosition(position) {
    this.position.x = position.x;
    this.position.y = position.y;
  }

  update(dt, room, input, enabled) {
    this.dodgeCooldownLeft = Math.max(0, this.dodgeCooldownLeft - dt);
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    if (!enabled) return;

    const vector = isoMovementVector(input);
    const dx = vector.x;
    const dy = vector.y;
    if (vector.moving) {
      this.direction = { x: dx, y: dy };
    }

    if (input.dodge && this.dodgeCooldownLeft <= 0 && vector.moving) {
      this.dodgeLeft = GAME.dodgeDuration;
      this.dodgeCooldownLeft = GAME.dodgeCooldown;
      this.invulnerability = GAME.dodgeDuration + 0.48;
      this.scene.effects.burstAtWorld(this.position.x, this.position.y, 4, 30);
    }

    const dodging = this.dodgeLeft > 0;
    if (dodging) this.dodgeLeft = Math.max(0, this.dodgeLeft - dt);
    const speed = dodging ? GAME.dodgeSpeed : GAME.playerSpeed;
    const moveX = (dodging ? this.direction.x : dx) * speed * dt;
    const moveY = (dodging ? this.direction.y : dy) * speed * dt;
    const nextX = this.position.x + moveX;
    const nextY = this.position.y + moveY;
    if (!isBlocked(nextX, this.position.y, room, GAME.playerRadius)) this.position.x = nextX;
    if (!isBlocked(this.position.x, nextY, room, GAME.playerRadius)) this.position.y = nextY;

    if (vector.moving || dodging) {
      this.walkTime += dt * (dodging ? 18 : 10);
      const screenX = dx - dy;
      const screenY = dx + dy;
      const facingBack = screenY < -0.2;
      const frameBase = facingBack ? 4 : 0;
      this.sprite.setFrame(frameBase + (Math.floor(this.walkTime) % 4));
      this.sprite.setFlipX(screenX < -0.25);
    } else {
      this.sprite.setFrame(this.direction.x + this.direction.y < -0.25 ? 4 : 0);
    }
    this.sprite.setAlpha(this.invulnerability > 0 && Math.floor(this.invulnerability * 24) % 2 === 0 ? 0.52 : 1);
  }

  render() {
    const point = projectIso(this.position.x, this.position.y, this.scene.scale.width);
    this.shadow.setPosition(point.x, point.y + 5).setDepth(point.y + 2);
    this.sprite.setPosition(point.x, point.y - 11).setDepth(point.y + 11);
    this.scene.playerPoint = point;
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
