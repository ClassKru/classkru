import { GAME, PLAYER, SPELLS } from './config.js';
import { projectIso, distance } from './isometric.js';
import { ROOMS } from './room-data.js';
import { createQuestion } from './math-engine.js';
import { correctAnswerManaReward, wrongAnswerManaLoss } from './game-rules.js';
import { PlayerController } from './player-controller.js';
import { createMonster, updateMonsterBars } from './monster-factory.js';
import { updateMonsterAI } from './monster-ai.js';
import { EffectPool } from './effect-pool.js';
import { RoomManager } from './room-manager.js';
import { SpellSystem } from './spell-system.js';
import { UIController } from './ui-controller.js';
import { AudioSystem } from './audio.js';

const PhaserLib = window.Phaser;

export class DungeonScene extends PhaserLib.Scene {
  constructor() {
    super({ key: 'MathWizardDungeon' });
  }

  preload() {
    this.load.spritesheet('atlas', './assets/sprite-atlas.svg', { frameWidth: 64, frameHeight: 64 });
  }

  create() {
    this.cameras.main.setBackgroundColor('#dceced');
    this.cameras.main.setScroll(0, 0);
    this.virtualInput = { up: false, down: false, left: false, right: false };
    this.state = {
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      mana: PLAYER.startingMana,
      maxMana: PLAYER.maxMana,
      score: 0,
      combo: 0,
      bestCombo: 0,
      correct: 0,
      answered: 0,
      roomsCleared: 0,
    };
    this.mode = 'intro';
    this.roomIndex = 0;
    this.currentRoom = ROOMS[0];
    this.monsters = [];
    this.selectedMonsterId = null;
    this.question = null;
    this.questionRemaining = 0;
    this.questionTotal = 0;
    this.dodgeRequested = false;
    this.basicCooldownLeft = 0;
    this.transitionBusy = false;
    this.playerPoint = { x: 0, y: 0 };

    this.effects = new EffectPool(this);
    this.roomManager = new RoomManager(this);
    this.spells = new SpellSystem(this);
    this.audio = new AudioSystem();
    this.player = new PlayerController(this);
    this.ui = new UIController(this);
    this.meteorRing = this.add.graphics().setVisible(false).setDepth(700);
    this.setupAnimations();
    this.setupKeys();
    this.enterRoom(0, true);
    this.events.once(PhaserLib.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  setupAnimations() {
    const animations = [
      ['slime-idle', 8, 11, 5],
      ['mushroom-idle', 12, 15, 3],
      ['bat-flutter', 16, 19, 9],
      ['fireball-spin', 20, 23, 14],
    ];
    animations.forEach(([key, start, end, frameRate]) => {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers('atlas', { start, end }),
          frameRate,
          repeat: -1,
        });
      }
    });
  }

  setupKeys() {
    const K = PhaserLib.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({
      up: K.W, left: K.A, down: K.S, right: K.D,
      dodge: K.SPACE, target: K.TAB,
      fireball: K.E, lightning: K.R, meteor: K.T,
      basic: K.Q,
    });
    this.questionKeyHandler = (event) => {
      if (this.mode === 'intro') {
        if (event.key === 'Enter' || event.code === 'Space') {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) this.startAdventure();
        }
        return;
      }
      if (this.mode !== 'combat' || !this.question || this.roomClear) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        this.ui.moveAnswerSelection(event.key);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) this.answerQuestion(this.ui.getSelectedAnswer());
      } else if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        if (!event.repeat) this.answerQuestion(Number(event.key) - 1);
      }
    };
    document.addEventListener('keydown', this.questionKeyHandler, true);
    this.input.on('gameout', () => {
      Object.keys(this.virtualInput).forEach((key) => { this.virtualInput[key] = false; });
    });
  }

  update(_time, delta) {
    const elapsedDt = Math.max(0, delta / 1000);
    const dt = Math.min(0.04, elapsedDt);
    this.roomManager.update(_time / 1000);
    if (!['intro', 'end', 'transition'].includes(this.mode)) this.spells.update(elapsedDt);
    if (this.mode === 'combat' && this.question && !this.roomClear) {
      this.questionRemaining = Math.max(0, this.questionRemaining - elapsedDt);
      this.ui.setQuestionTime(this.questionRemaining, this.questionTotal);
      if (this.questionRemaining <= 0) this.answerQuestion(-1);
    }
    if (this.mode !== 'combat') return;

    this.readCombatKeys();
    this.warmupRemaining = Math.max(0, (this.warmupRemaining || 0) - elapsedDt);
    this.basicCooldownLeft = Math.max(0, this.basicCooldownLeft - elapsedDt);
    this.player.update(dt, this.currentRoom, this.currentInput(), true);
    this.dodgeRequested = false;
    this.player.render();
    const invulnerable = this.player.invulnerability > 0;
    this.monsters.forEach((monster) => {
      if (monster.defeated) return;
      if (this.warmupRemaining <= 0) updateMonsterAI(this, monster, this.player, dt, this.currentRoom, invulnerable);
      updateMonsterBars(monster, monster.id === this.selectedMonsterId, (x, y) => this.project(x, y));
    });
    this.updateTargetHud();
    this.ui.updateAttackBar(this.state.mana, (key) => this.spells.reason(key, this.getSelectedMonster()));

    if (this.roomClear && this.nearExit()) this.goThroughDoor();

  }

  readCombatKeys() {
    const keyboard = PhaserLib.Input.Keyboard;
    if (keyboard.JustDown(this.keys.dodge)) this.requestDodge();
    if (keyboard.JustDown(this.keys.target)) this.cycleTarget();
    if (keyboard.JustDown(this.keys.basic)) this.basicAttack();
    if (keyboard.JustDown(this.keys.fireball)) this.castSpell('fireball');
    if (keyboard.JustDown(this.keys.lightning)) this.castSpell('lightning');
    if (keyboard.JustDown(this.keys.meteor)) this.castSpell('meteor');
  }

  currentInput() {
    return {
      up: this.keys.up.isDown || this.virtualInput.up,
      down: this.keys.down.isDown || this.virtualInput.down,
      left: this.keys.left.isDown || this.virtualInput.left,
      right: this.keys.right.isDown || this.virtualInput.right,
      dodge: this.dodgeRequested,
    };
  }

  project(x, y) {
    return projectIso(x, y, this.scale.width);
  }

  enterRoom(index, firstStart = false) {
    this.clearMonsters();
    this.roomIndex = Math.max(0, Math.min(index, ROOMS.length - 1));
    this.currentRoom = ROOMS[this.roomIndex];
    this.roomManager.draw(this.currentRoom);
    this.player.setPosition(this.currentRoom.spawn);
    this.roomClear = false;
    this.transitionBusy = false;
    this.warmupRemaining = 2.6;
    this.monsters = this.currentRoom.monsters.slice(0, GAME.maxMonsters).map((spawn, order) => {
      return createMonster(this, spawn.type, spawn, this.currentRoom.id, this.currentRoom.id * 10 + order);
    });
    this.monsters.forEach((monster) => {
      const animation = monster.type === 'slime' ? 'slime-idle' : monster.type === 'mushroom' ? 'mushroom-idle' : 'bat-flutter';
      monster.sprite.play(animation);
      updateMonsterBars(monster, monster.id === this.selectedMonsterId, (x, y) => this.project(x, y));
    });
    this.selectedMonsterId = this.monsters[0]?.id ?? null;
    this.player.render();
    this.updateTargetHud();
    this.ui.updateHud(this.state, this.currentRoom, this.getSelectedMonster(), 1, this.aliveMonsters().length);
    this.question = null;
    this.ui.hideQuestion();
    this.ui.setStatus(firstStart ? 'ตามหา Slime แล้วตอบโจทย์เพื่อร่าย Fireball' : 'ห้อง ' + this.currentRoom.id + ' · ' + this.currentRoom.title);
    if (firstStart) this.mode = 'intro';
  }

  clearMonsters() {
    this.monsters?.forEach((monster) => {
      this.tweens.killTweensOf(monster.sprite);
      monster.sprite.destroy();
      monster.shadow.destroy();
      monster.marker.destroy();
      monster.hpBack.destroy();
      monster.hpBar.destroy();
    });
    this.monsters = [];
    this.selectedMonsterId = null;
  }

  startAdventure() {
    if (this.mode !== 'intro') return;
    this.mode = 'combat';
    this.warmupRemaining = 2.6;
    this.showNextQuestion();
    this.ui.setStatus('ห้อง 1 · ' + this.currentRoom.title + ' — ตอบถูกเพื่อสะสมมานา');
    this.ui.hideStart();
    this.audio.play('room');
  }

  restartAdventure() {
    this.clearMonsters();
    this.roomManager.clear();
    this.state = {
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      mana: PLAYER.startingMana,
      maxMana: PLAYER.maxMana,
      score: 0,
      combo: 0,
      bestCombo: 0,
      correct: 0,
      answered: 0,
      roomsCleared: 0,
    };
    this.spells.cooldowns = Object.create(null);
    this.spells.elapsed = 0;
    this.basicCooldownLeft = 0;
    this.ui.el.end.hidden = true;
    this.enterRoom(0, false);
    this.mode = 'combat';
    this.warmupRemaining = 2.6;
    this.showNextQuestion();
    this.ui.setStatus('เริ่มรอบใหม่แล้ว · ตอบโจทย์เพื่อสะสมมานา');
  }

  showNextQuestion() {
    if (this.mode !== 'combat' || this.roomClear) return;
    this.question = createQuestion(this.currentRoom.difficulty);
    this.questionTotal = GAME.questionTimeLimitSeconds;
    this.questionRemaining = this.questionTotal;
    this.ui.showQuestion(this.question, this.currentRoom, this.questionTotal);
  }

  answerQuestion(index) {
    if (this.mode !== 'combat' || !this.question || this.roomClear) return;
    const answeredQuestion = this.question;
    const correct = index >= 0 && answeredQuestion.choices[index] === answeredQuestion.answer;
    let feedbackMessage;
    this.state.answered += 1;
    if (correct) {
      const speedBonus = this.questionRemaining > this.questionTotal / 2 ? 50 : 0;
      this.state.combo += 1;
      this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
      this.state.correct += 1;
      const comboBonus = this.state.combo >= 2 ? Math.round((100 + speedBonus) * 0.2) : 0;
      const critical = this.state.combo >= 5 && Math.random() < Math.min(0.5, 0.12 + this.state.combo * 0.035);
      this.state.score += 100 + speedBonus + comboBonus + (critical ? 100 : 0);
      const reward = correctAnswerManaReward(this.state.combo);
      const manaBefore = this.state.mana;
      this.state.mana = Math.min(this.state.maxMana, this.state.mana + reward.total);
      const manaGain = this.state.mana - manaBefore;
      const comboManaGain = Math.max(0, manaGain - reward.base);
      this.audio.play('correct');
      const manaMessage = manaGain > 0
        ? 'มานา +' + manaGain + (comboManaGain > 0 ? ' (คอมโบ +' + comboManaGain + ')' : '')
        : 'มานาเต็มแล้ว';
      feedbackMessage = 'ถูกต้อง! ' + manaMessage + ' · คอมโบ ' + this.state.combo + (critical ? ' · CRITICAL!' : '');
      this.ui.setStatus('ตอบถูก · คลิกแถบโจมตีเพื่อใช้มานา');
    } else {
      this.state.combo = 0;
      const expected = answeredQuestion.answer;
      const manaLoss = wrongAnswerManaLoss(this.state.mana);
      this.state.mana -= manaLoss;
      this.audio.play('wrong');
      const result = index < 0 ? 'หมดเวลา' : 'ตอบผิด';
      feedbackMessage = result + ' · มานา -' + manaLoss + ' · คำตอบคือ ' + expected;
      this.ui.setStatus(result + ' · มานาลดลง ' + manaLoss);
    }

    this.ui.updateHud(this.state, this.currentRoom, this.getSelectedMonster(), this.selectedIndex(), this.aliveMonsters().length);
    this.showNextQuestion();
    this.ui.showQuestionFeedback(feedbackMessage, correct);
  }

  castSpell(key) {
    if (this.mode !== 'combat' || this.roomClear) return;
    const target = this.getSelectedMonster();
    const result = this.spells.cast(key, target);
    if (!result.ok) {
      this.ui.setStatus(result.reason);
      return;
    }
    this.ui.updateHud(this.state, this.currentRoom, this.getSelectedMonster(), this.selectedIndex(), this.aliveMonsters().length);
    this.ui.setStatus(result.spell.name + '!');
  }

  requestDodge() {
    if (this.mode === 'combat') this.dodgeRequested = true;
  }

  cycleTarget() {
    const alive = this.aliveMonsters();
    if (!alive.length) return;
    const current = alive.findIndex((monster) => monster.id === this.selectedMonsterId);
    this.selectedMonsterId = alive[(current + 1) % alive.length].id;
    this.updateTargetHud();
    this.ui.setStatus('เลือกเป้าหมาย: ' + this.getSelectedMonster().name);
  }

  selectMonster(id) {
    const monster = this.monsters.find((candidate) => candidate.id === id && !candidate.defeated);
    if (!monster) return;
    this.selectedMonsterId = id;
    this.updateTargetHud();
    this.ui.setStatus('เลือกเป้าหมาย: ' + monster.name);
  }

  basicAttack() {
    if (this.mode !== 'combat') return;
    const target = this.getSelectedMonster();
    if (!target) return;
    if (this.basicCooldownLeft > 0) {
      this.ui.setStatus('ไม้เท้ากำลังพัก ' + this.basicCooldownLeft.toFixed(1) + ' วินาที');
      return;
    }
    if (distance(this.player.position, target) > PLAYER.basicRange) {
      this.ui.setStatus('เข้าใกล้เป้าหมายอีกนิดเพื่อโจมตีด้วยไม้เท้า');
      return;
    }
    this.basicCooldownLeft = PLAYER.basicCooldown;
    const from = this.playerPoint;
    const to = this.project(target.x, target.y);
    this.effects.lightning(from, to, 0);
    this.effects.burstAtScreen(to.x, to.y - 10, 4, 28);
    this.damageMonster(target, PLAYER.basicDamage, 'staff');
    this.audio.play('spark');
    this.ui.setStatus('โจมตีด้วยไม้เท้า!');
  }

  damagePlayer(amount, source) {
    if (this.player.invulnerability > 0 || this.state.hp <= 0) return;
    this.state.hp = Math.max(0, this.state.hp - amount);
    this.audio.play('hit');
    this.cameras.main.shake(90, 0.0025);
    this.ui.updateHud(this.state, this.currentRoom, this.getSelectedMonster(), this.selectedIndex(), this.aliveMonsters().length);
    this.ui.setStatus((source?.name || 'มอนสเตอร์') + ' โจมตี -' + amount + ' HP');
    if (this.state.hp <= 0) {
      this.mode = 'end';
      this.finishGame(false);
    }
  }

  damageMonster(monster, amount, spellName = '') {
    if (!monster || monster.defeated) return;
    monster.hp = Math.max(0, monster.hp - amount);
    monster.state = 'hit';
    monster.hitLeft = 0.28;
    monster.sprite.setTintFill(0xffffff);
    this.time.delayedCall(110, () => {
      if (monster.sprite?.active) monster.sprite.clearTint();
    });
    this.effects.burstAtWorld(monster.x, monster.y, spellName === 'meteor' ? 7 : 4, spellName === 'fireball' ? 30 : 28);
    if (monster.hp <= 0) {
      monster.defeated = true;
      monster.state = 'defeat';
      this.tweens.add({
        targets: [monster.sprite, monster.shadow, monster.hpBack, monster.hpBar],
        alpha: 0,
        scale: 0.25,
        duration: 380,
        ease: 'Back.In',
        onComplete: () => {
          monster.sprite.setVisible(false);
          monster.shadow.setVisible(false);
          monster.hpBack.setVisible(false);
          monster.hpBar.setVisible(false);
        },
      });
      this.ui.setStatus(monster.name + ' พ่ายแพ้แล้ว!');
      this.audio.play('room');
      if (this.selectedMonsterId === monster.id) {
        const next = this.aliveMonsters().find((entry) => entry.id !== monster.id);
        this.selectedMonsterId = next?.id ?? null;
      }
      this.checkRoomClear();
    } else if (this.selectedMonsterId === monster.id) {
      this.ui.setStatus((spellName ? SPELLS[spellName]?.name || 'ไม้เท้า' : 'เวทมนตร์') + ' โดนเป้าหมาย -' + amount + ' HP');
    }
    this.updateTargetHud();
  }

  checkRoomClear() {
    if (this.roomClear || this.aliveMonsters().length > 0) return;
    this.roomClear = true;
    this.state.roomsCleared = Math.max(this.state.roomsCleared, this.currentRoom.id);
    this.roomManager.setExitUnlocked(true);
    this.state.hp = Math.min(this.state.maxHp, this.state.hp + 12);
    this.state.mana = Math.min(this.state.maxMana, this.state.mana + 15);
    this.ui.updateHud(this.state, this.currentRoom, null, 0, 0);
    this.question = null;
    this.ui.hideQuestion();
    this.audio.play('room');
    this.ui.setStatus('เคลียร์ห้องแล้ว · ฟื้น HP +12 และมานา +15 · ประตูเปิดแล้ว');
    this.effects.burstAtScreen(GAME.width / 2, 190, 14, 28);
  }

  aliveMonsters() {
    return this.monsters.filter((monster) => !monster.defeated);
  }

  getSelectedMonster() {
    return this.monsters.find((monster) => monster.id === this.selectedMonsterId && !monster.defeated) || this.aliveMonsters()[0] || null;
  }

  selectedIndex() {
    const alive = this.aliveMonsters();
    const index = alive.findIndex((monster) => monster.id === this.getSelectedMonster()?.id);
    return index >= 0 ? index + 1 : 0;
  }

  updateTargetHud() {
    const alive = this.aliveMonsters();
    const target = this.getSelectedMonster();
    this.ui.updateHud(this.state, this.currentRoom, target, this.selectedIndex(), alive.length);
  }

  nearExit() {
    return Boolean(this.exitPoint && distance(this.player.position, this.exitPoint) < 1.12);
  }

  goThroughDoor() {
    if (this.mode !== 'combat' || !this.roomClear || !this.nearExit() || this.transitionBusy) return;
    if (this.roomIndex >= ROOMS.length - 1) {
      this.finishGame(true);
      return;
    }
    this.transitionBusy = true;
    this.mode = 'transition';
    this.ui.setStatus('กำลังเปิดประตูไปห้องถัดไป…');
    this.cameras.main.fadeOut(300, 134, 116, 166);
    this.time.delayedCall(320, () => {
      const nextIndex = this.roomIndex + 1;
      this.state.mana = Math.min(this.state.maxMana, this.state.mana + 10);
      this.enterRoom(nextIndex);
      this.mode = 'transition';
      this.cameras.main.fadeIn(360, 134, 116, 166);
      this.time.delayedCall(360, () => {
        this.mode = 'combat';
        this.audio.play('room');
        this.showNextQuestion();
        this.ui.setStatus('ห้อง ' + this.currentRoom.id + ' · ' + this.currentRoom.title + ' · มานา +10');
      });
    });
  }

  finishGame(won) {
    this.mode = 'end';
    this.ui.showEnd({ won, score: this.state.score, roomsCleared: this.state.roomsCleared });
    this.ui.setStatus(won ? 'ดันเจี้ยนเคลียร์แล้ว!' : 'พ่อมดต้องพักฟื้น');
  }

  showMeteorWarning(point, radius) {
    this.meteorRing.clear().setVisible(true).setAlpha(0.9);
    this.meteorRing.fillStyle(0xffa38f, 0.2);
    this.meteorRing.fillEllipse(point.x, point.y + 3, radius * 67, radius * 31);
    this.meteorRing.lineStyle(3, 0xee8c87, 0.8);
    this.meteorRing.strokeEllipse(point.x, point.y + 3, radius * 67, radius * 31);
    this.tweens.add({ targets: this.meteorRing, alpha: 0.2, yoyo: true, repeat: 1, duration: 160 });
    this.time.delayedCall(850, () => this.meteorRing.clear().setVisible(false));
  }

  animateCast() {
    this.tweens.killTweensOf(this.player.sprite);
    this.player.sprite.setScale(1).setAngle(0);
    this.tweens.add({
      targets: this.player.sprite,
      scaleX: 1.18,
      scaleY: 0.88,
      angle: this.player.direction.x >= 0 ? 7 : -7,
      yoyo: true,
      duration: 110,
      onComplete: () => this.player.sprite.setScale(1).setAngle(0),
    });
    this.effects.burstAtScreen(this.playerPoint.x, this.playerPoint.y - 26, 5, 29);
  }

  shutdown() {
    if (this.questionKeyHandler) document.removeEventListener('keydown', this.questionKeyHandler, true);
    this.ui?.destroy();
    this.clearMonsters();
    this.player?.destroy();
    this.effects?.destroy();
    this.roomManager?.destroy();
    this.meteorRing?.destroy();
  }
}
