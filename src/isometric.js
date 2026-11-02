import { GAME } from './config.js';

export function projectIso(u, v, width = GAME.width, top = 84) {
  return {
    x: width / 2 + (u - v) * GAME.tileWidth / 2,
    y: top + (u + v) * GAME.tileHeight / 2,
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isBlocked(x, y, room, radius = GAME.playerRadius) {
  const limit = GAME.roomSize;
  if (x < 0.48 + radius || y < 0.48 + radius || x > limit - 0.48 - radius || y > limit - 0.48 - radius) return true;
  return room.obstacles.some((obstacle) => {
    const nearestX = Math.max(obstacle.x - obstacle.w / 2, Math.min(x, obstacle.x + obstacle.w / 2));
    const nearestY = Math.max(obstacle.y - obstacle.h / 2, Math.min(y, obstacle.y + obstacle.h / 2));
    return Math.hypot(x - nearestX, y - nearestY) < radius;
  });
}

export function linePoints(from, to, segments = 7, seed = 1) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const wiggle = i === 0 || i === segments ? 0 : Math.sin(seed * 11 + i * 8.3) * 8;
    points.push({
      x: from.x + (to.x - from.x) * t + wiggle,
      y: from.y + (to.y - from.y) * t + Math.cos(seed * 7 + i * 5.4) * (i === 0 || i === segments ? 0 : 5),
    });
  }
  return points;
}
