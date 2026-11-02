import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuestion } from '../src/math-engine.js';
import { GAME, MONSTER_TYPES, PLAYER, SPELLS } from '../src/config.js';
import { isBlocked, projectIso } from '../src/isometric.js';
import { ROOMS } from '../src/room-data.js';
import { isoMovementVector } from '../src/player-controller.js';
import { correctAnswerManaReward, wrongAnswerManaLoss } from '../src/game-rules.js';

test('question engine returns four unique choices containing the answer at every difficulty', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < 500; i += 1) {
      const question = createQuestion(difficulty);
      assert.equal(question.choices.length, 4);
      assert.equal(new Set(question.choices).size, 4);
      assert.ok(question.choices.includes(question.answer), difficulty + ' answer missing');
      assert.ok(question.text.includes('= ?'));
    }
  }
});

test('isometric projection is centered and separates logical axes diagonally', () => {
  const center = projectIso(5, 5);
  const east = projectIso(6, 5);
  const south = projectIso(5, 6);
  assert.equal(center.x, GAME.width / 2);
  assert.equal(east.x - center.x, GAME.tileWidth / 2);
  assert.equal(south.x - center.x, -GAME.tileWidth / 2);
  assert.equal(east.y - center.y, GAME.tileHeight / 2);
  assert.equal(south.y - center.y, GAME.tileHeight / 2);
});

test('WASD maps screen directions to intuitive isometric 8-way movement', () => {
  const up = isoMovementVector({ up: true });
  const right = isoMovementVector({ right: true });
  const diagonal = isoMovementVector({ up: true, right: true });
  assert.ok(Math.abs(up.x - up.y) < 0.0001);
  assert.ok(up.x + up.y < 0);
  assert.ok(right.x - right.y > 0);
  assert.ok(Math.abs(diagonal.x) < 0.0001);
  assert.ok(diagonal.y < 0);
});

test('room collision blocks walls and obstacles while allowing floor cells', () => {
  const room = ROOMS[0];
  assert.equal(isBlocked(0.1, 5, room), true);
  assert.equal(isBlocked(2.15, 5.45, room), true);
  assert.equal(isBlocked(4.4, 6.4, room), false);
});

test('three rooms are continuous, difficulty progresses, and monster cap is respected', () => {
  assert.equal(ROOMS.length, 3);
  assert.deepEqual(ROOMS.map((room) => room.difficulty), ['easy', 'medium', 'hard']);
  assert.ok(ROOMS.every((room) => room.monsters.length <= GAME.maxMonsters));
  assert.ok(ROOMS.every((room) => room.monsters.every((monster) => MONSTER_TYPES[monster.type])));
  assert.ok(ROOMS.every((room) => room.spawn && room.exit && Array.isArray(room.obstacles)));
});

test('math and spell resources retain the original game rules', () => {
  assert.equal(PLAYER.startingMana, 20);
  assert.equal(PLAYER.manaPerCorrect, 10);
  assert.equal(GAME.questionTimeLimitSeconds, 10);
  assert.deepEqual(
    Object.fromEntries(Object.entries(SPELLS).map(([key, spell]) => [key, spell.cost])),
    { fireball: 30, lightning: 50, meteor: 100 },
  );
});

test('correct answers build capped mana-combo rewards and wrong answers deduct up to 8 mana', () => {
  assert.deepEqual(correctAnswerManaReward(1), { base: 10, comboBonus: 0, total: 10 });
  assert.deepEqual(correctAnswerManaReward(2), { base: 10, comboBonus: 2, total: 12 });
  assert.deepEqual(correctAnswerManaReward(8), { base: 10, comboBonus: 10, total: 20 });
  assert.equal(wrongAnswerManaLoss(30), 8);
  assert.equal(wrongAnswerManaLoss(3), 3);
  assert.equal(wrongAnswerManaLoss(0), 0);
});
