import { SPELLS } from './config.js';
import { distance } from './isometric.js';

export class SpellSystem {
  constructor(scene) {
    this.scene = scene;
    this.cooldowns = Object.create(null);
    this.elapsed = 0;
  }

  update(dt) {
    this.elapsed += dt;
  }

  cooldownRemaining(key) {
    return Math.max(0, (this.cooldowns[key] || 0) - this.elapsed);
  }

  reason(key, target) {
    const spell = SPELLS[key];
    if (!spell) return 'ไม่รู้จักเวทนี้';
    if (!target || target.defeated) return 'เลือกเป้าหมายที่ยังอยู่ก่อน';
    if (this.cooldownRemaining(key) > 0) return 'เวทนี้กำลังพัก';
    if (distance(this.scene.player.position, target) > spell.range) return 'เป้าหมายอยู่ไกลเกินระยะ';
    if (this.scene.state.mana < spell.cost) return 'ต้องใช้ ' + spell.cost + ' มานา';
    return '';
  }

  cast(key, target) {
    const spell = SPELLS[key];
    const reason = this.reason(key, target);
    if (reason) return { ok: false, reason };
    if (this.scene.state.mana < spell.cost) return { ok: false, reason: 'ต้องใช้ ' + spell.cost + ' มานาสำหรับ ' + spell.name };
    this.scene.state.mana -= spell.cost;
    this.cooldowns[key] = this.elapsed + spell.cooldown;
    this.scene.audio.play('spell');
    this.scene.animateCast();

    const from = this.scene.playerPoint;
    const mainPoint = this.scene.project(target.x, target.y);
    if (key === 'fireball') {
      this.scene.effects.projectile(from, mainPoint, 20, () => this.scene.damageMonster(target, spell.damage, key));
    } else if (key === 'lightning') {
      const targets = [target, ...this.scene.aliveMonsters()
        .filter((monster) => monster.id !== target.id && distance(monster, target) <= spell.chainRange)
        .sort((a, b) => distance(a, target) - distance(b, target))
        .slice(0, 2)];
      let start = from;
      targets.forEach((monster, index) => {
        const point = this.scene.project(monster.x, monster.y);
        this.scene.effects.lightning(start, point, index);
        this.scene.effects.burstAtScreen(point.x, point.y - 12, 5, 28);
        this.scene.damageMonster(monster, index === 0 ? spell.damage : spell.chainDamage, key);
        start = point;
      });
    } else if (key === 'meteor') {
      this.scene.showMeteorWarning(mainPoint, spell.radius);
      this.scene.time.delayedCall(420, () => {
        if (!this.scene.sys.isActive()) return;
        this.scene.effects.projectile({ x: mainPoint.x + 20, y: mainPoint.y - 120 }, mainPoint, 24, () => {
          this.scene.effects.burstAtScreen(mainPoint.x, mainPoint.y - 10, 13, 30);
          this.scene.aliveMonsters().forEach((monster) => {
            if (distance(monster, target) <= spell.radius) this.scene.damageMonster(monster, spell.damage, key);
          });
        });
      });
    }
    return { ok: true, spell };
  }
}
