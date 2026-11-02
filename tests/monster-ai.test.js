import test from 'node:test';
import assert from 'node:assert/strict';
import { updateMonsterAI } from '../src/monster-ai.js';

function fixture() {
  const monster = {
    id: 1,
    x: 2,
    y: 2,
    state: 'idle',
    hp: 40,
    maxHp: 40,
    speed: 1,
    detectionRange: 5,
    attackRange: 1,
    attackCooldown: 2,
    attackCooldownLeft: 0,
    attackStateLeft: 0,
    attackPending: false,
    hitLeft: 0,
    bob: 0,
    defeated: false,
  };
  const player = { position: { x: 2.5, y: 2 } };
  const result = { hits: 0, status: '' };
  const scene = {
    aliveMonsters: () => [monster],
    damagePlayer: () => { result.hits += 1; },
    effects: { burstAtWorld: () => {} },
    ui: { setStatus: (message) => { result.status = message; } },
  };
  return { monster, player, result, scene, room: { obstacles: [] } };
}

test('monster FSM warns before attacking and only damages after its attack wind-up', () => {
  const f = fixture();
  updateMonsterAI(f.scene, f.monster, f.player, 0.016, f.room, false);
  assert.equal(f.monster.state, 'attack');
  assert.equal(f.result.hits, 0);
  assert.match(f.result.status, /เตรียมโจมตี/);
  for (let i = 0; i < 40; i += 1) updateMonsterAI(f.scene, f.monster, f.player, 0.016, f.room, false);
  assert.equal(f.result.hits, 1);
  assert.equal(f.monster.state, 'idle');
});

test('a dodge during the attack window avoids monster damage', () => {
  const f = fixture();
  updateMonsterAI(f.scene, f.monster, f.player, 0.016, f.room, false);
  for (let i = 0; i < 42; i += 1) updateMonsterAI(f.scene, f.monster, f.player, 0.016, f.room, i >= 15);
  assert.equal(f.result.hits, 0);
  assert.equal(f.monster.state, 'idle');
  assert.match(f.result.status, /หลบการโจมตี/);
});
