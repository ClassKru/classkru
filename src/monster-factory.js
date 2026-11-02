import { MONSTER_TYPES } from './config.js';
const PhaserLib = window.Phaser;

export function createMonster(scene, type, position, roomNumber, id) {
  const definition = MONSTER_TYPES[type];
  const scale = 1 + (roomNumber - 1) * 0.08;
  const sprite = scene.add.sprite(0, 0, 'atlas', definition.frame).setOrigin(0.5, 0.67).setDepth(5);
  sprite.setInteractive(new PhaserLib.Geom.Circle(32, 34, 27), PhaserLib.Geom.Circle.Contains);
  sprite.input.cursor = 'pointer';
  const shadow = scene.add.ellipse(0, 0, 35, 13, 0x403260, 0.2).setDepth(4);
  const marker = scene.add.ellipse(0, 0, 54, 20, 0xffdf92, 0.13).setStrokeStyle(2, 0xf2c86e, 0.4).setDepth(3);
  const hpBack = scene.add.rectangle(0, 0, 40, 5, 0x433854, 0.78).setOrigin(0.5, 0).setDepth(8);
  const hpBar = scene.add.rectangle(0, 0, 38, 3, 0x70d2a8).setOrigin(0.5, 0).setDepth(9);
  const monster = {
    id,
    type,
    name: definition.name,
    x: position.x,
    y: position.y,
    hp: Math.round(definition.hp * scale),
    maxHp: Math.round(definition.hp * scale),
    damage: definition.damage + roomNumber - 1,
    speed: definition.speed * (1 + (roomNumber - 1) * 0.04),
    detectionRange: definition.detectionRange,
    attackRange: definition.attackRange,
    attackCooldown: definition.attackCooldown,
    state: 'idle',
    attackCooldownLeft: 0,
    attackStateLeft: 0,
    hitLeft: 0,
    bob: Math.random() * Math.PI * 2,
    sprite,
    shadow,
    marker,
    hovered: false,
    hpBack,
    hpBar,
    defeated: false,
  };
  sprite.on('pointerdown', () => scene.selectMonster(id));
  sprite.on('pointerover', () => { monster.hovered = true; });
  sprite.on('pointerout', () => { monster.hovered = false; });
  return monster;
}

export function updateMonsterBars(monster, selected, project) {
  const point = project(monster.x, monster.y);
  const bob = Math.sin(monster.bob) * 2.5;
  monster.sprite.setPosition(point.x, point.y - 12 + bob).setDepth(point.y + 10);
  monster.shadow.setPosition(point.x, point.y + 3).setDepth(point.y + 1);
  monster.marker.setPosition(point.x, point.y + 3).setDepth(point.y + 2).setVisible(selected || monster.hovered).setAlpha(selected ? 1 : 0.62);
  monster.hpBack.setPosition(point.x, point.y - 46 + bob).setDepth(point.y + 14);
  monster.hpBar.setPosition(point.x - 1, point.y - 45 + bob).setDepth(point.y + 15);
  monster.hpBar.width = Math.max(1, 38 * monster.hp / monster.maxHp);
}
