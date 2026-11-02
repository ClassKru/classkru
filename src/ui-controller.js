import { DIFFICULTIES } from './config.js';

const byId = (id) => document.getElementById(id);

export class UIController {
  constructor(scene) {
    this.scene = scene;
    this.el = {
      intro: byId('intro-screen'),
      start: byId('start-button'),
      question: byId('question-panel'),
      questionRoom: byId('question-room-label'),
      questionText: byId('question-text'),
      questionHelp: byId('question-help'),
      questionFeedback: byId('question-feedback'),
      questionTimer: byId('question-timer'),
      timerBar: byId('timer-bar'),
      answers: [...document.querySelectorAll('.answer-button')],
      attackHelp: byId('attack-help'),
      attackChoices: [...document.querySelectorAll('.attack-choice')],
      end: byId('end-screen'),
      endEmblem: byId('end-emblem'),
      endKicker: byId('end-kicker'),
      endTitle: byId('end-title'),
      endMessage: byId('end-message'),
      finalScore: byId('final-score'),
      restart: byId('restart-button'),
      room: byId('room-value'),
      roomCount: byId('room-count'),
      score: byId('score-value'),
      combo: byId('combo-value'),
      hpBar: byId('player-hp-bar'),
      hpLabel: byId('player-hp-label'),
      manaBar: byId('mana-bar'),
      manaLabel: byId('mana-label'),
      status: byId('battle-status'),
      target: byId('target-card'),
      targetName: byId('target-name'),
      targetIndex: byId('target-index'),
      targetHp: byId('target-hp-label'),
      targetHpBar: byId('target-hp-bar'),
      doorButton: byId('door-button'),
      dodgeButton: byId('dodge-button'),
      targetButton: byId('target-button'),
      basicButton: byId('basic-button'),
    };
    this.bind();
  }

  bind() {
    this.startActivationHandler = (event) => {
      const startButton = event.target?.closest?.('#start-button');
      if (!startButton || this.scene.mode !== 'intro') return;
      event.preventDefault();
      event.stopPropagation();
      this.scene.startAdventure();
    };
    document.addEventListener('pointerup', this.startActivationHandler, true);
    document.addEventListener('click', this.startActivationHandler, true);
    this.el.restart.addEventListener('click', () => this.scene.restartAdventure());
    this.el.doorButton.addEventListener('click', () => this.scene.goThroughDoor());
    this.el.dodgeButton.addEventListener('click', () => this.scene.requestDodge());
    this.el.targetButton.addEventListener('click', () => this.scene.cycleTarget());
    this.el.basicButton.addEventListener('click', () => this.scene.basicAttack());
    byId('touch-dodge').addEventListener('click', () => this.scene.requestDodge());
    this.el.answers.forEach((button, index) => {
      button.addEventListener('focus', () => this.setAnswerSelection(index));
      button.addEventListener('click', () => this.scene.answerQuestion(index));
    });
    this.el.attackChoices.forEach((button) => {
      button.addEventListener('click', () => this.scene.castSpell(button.dataset.spell));
    });

    document.querySelectorAll('[data-move]').forEach((button) => {
      const key = button.dataset.move;
      const press = (event) => {
        event.preventDefault();
        this.scene.virtualInput[key] = true;
        button.classList.add('is-pressed');
      };
      const release = (event) => {
        event.preventDefault();
        this.scene.virtualInput[key] = false;
        button.classList.remove('is-pressed');
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    });
  }

  setStatus(message) {
    this.el.status.textContent = message;
  }

  updateHud(state, room, target, targetIndex, targetCount) {
    this.el.room.textContent = String(room.id);
    this.el.roomCount.textContent = String(room.id);
    this.el.score.textContent = state.score.toLocaleString('th-TH');
    this.el.combo.textContent = String(state.combo);
    this.el.hpBar.style.width = Math.max(0, state.hp) / state.maxHp * 100 + '%';
    this.el.hpLabel.textContent = Math.max(0, state.hp) + ' / ' + state.maxHp;
    this.el.manaBar.style.width = Math.max(0, state.mana) / state.maxMana * 100 + '%';
    this.el.manaLabel.textContent = Math.max(0, state.mana) + ' / ' + state.maxMana;
    if (!target) {
      this.el.target.hidden = true;
      return;
    }
    this.el.target.hidden = false;
    this.el.targetName.textContent = target.name;
    this.el.targetIndex.textContent = targetIndex + ' / ' + targetCount;
    this.el.targetHp.textContent = target.hp + ' / ' + target.maxHp + ' HP';
    this.el.targetHpBar.style.width = Math.max(0, target.hp) / target.maxHp * 100 + '%';
  }

  showQuestion(question, room, totalSeconds) {
    this.el.intro.hidden = true;
    this.el.end.hidden = true;
    this.el.question.hidden = false;
    this.el.question.classList.add('is-active');
    this.feedbackToken = (this.feedbackToken || 0) + 1;
    this.el.questionFeedback.hidden = true;
    this.el.questionFeedback.textContent = '';
    this.el.questionFeedback.classList.remove('is-correct', 'is-wrong');
    this.el.questionRoom.textContent = 'ห้อง ' + room.id + ' · ระดับ' + DIFFICULTIES[room.difficulty].label;
    this.el.questionText.textContent = question.text;
    this.el.questionHelp.textContent = 'คลิกตอบ หรือใช้ลูกศรแล้ว Enter · ถูกสะสมมานา/คอมโบ · ผิดเสียสูงสุด 8';
    this.el.timerBar.parentElement.classList.remove('is-danger');
    this.setQuestionTime(totalSeconds, totalSeconds);
    this.el.answers.forEach((button, index) => {
      button.disabled = false;
      button.className = 'answer-button';
      button.setAttribute('aria-pressed', 'false');
      button.querySelector('span').textContent = question.choices[index];
    });
    this.selectedAnswerIndex = 0;
    this.setAnswerSelection(0);
  }

  getSelectedAnswer() {
    return this.selectedAnswerIndex ?? 0;
  }

  setAnswerSelection(index) {
    const safeIndex = Math.max(0, Math.min(index, this.el.answers.length - 1));
    this.selectedAnswerIndex = safeIndex;
    this.el.answers.forEach((button, answerIndex) => {
      const selected = answerIndex === safeIndex;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  moveAnswerSelection(direction) {
    const current = this.getSelectedAnswer();
    const row = Math.floor(current / 2);
    const column = current % 2;
    let next = current;
    if (direction === 'ArrowLeft' && column > 0) next -= 1;
    if (direction === 'ArrowRight' && column < 1) next += 1;
    if (direction === 'ArrowUp' && row > 0) next -= 2;
    if (direction === 'ArrowDown' && row < 1) next += 2;
    this.setAnswerSelection(next);
    const button = this.el.answers[next];
    if (document.activeElement !== button) button.focus({ preventScroll: true });
  }

  setQuestionTime(remaining, total) {
    const safe = Math.max(0, remaining);
    this.el.questionTimer.textContent = safe.toFixed(1);
    this.el.timerBar.style.width = Math.max(0, safe / total * 100) + '%';
    this.el.timerBar.parentElement.classList.toggle('is-danger', safe <= 3);
  }

  showQuestionFeedback(message, correct) {
    const feedback = this.el.questionFeedback;
    const token = (this.feedbackToken || 0) + 1;
    this.feedbackToken = token;
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.toggle('is-correct', correct);
    feedback.classList.toggle('is-wrong', !correct);
    this.scene.time.delayedCall(1250, () => {
      if (this.feedbackToken === token) feedback.hidden = true;
    });
  }

  updateAttackBar(mana, getReason) {
    let anyAvailable = false;
    const reasons = [];
    this.el.attackChoices.forEach((button) => {
      const reason = getReason(button.dataset.spell);
      reasons.push(reason);
      button.disabled = Boolean(reason);
      button.title = reason || 'คลิกเพื่อร่าย ' + button.dataset.spell;
      if (!button.disabled) anyAvailable = true;
    });
    if (anyAvailable) this.el.attackHelp.textContent = 'กด E/R/T หรือคลิกเวทที่พร้อมใช้';
    else if (!this.scene.getSelectedMonster() && this.scene.roomClear) this.el.attackHelp.textContent = 'ไปยังประตูเพื่อเดินทางต่อ';
    else if (!this.scene.getSelectedMonster()) this.el.attackHelp.textContent = 'เลือกเป้าหมายที่ยังอยู่';
    else if (reasons.every((reason) => reason.includes('มานา'))) this.el.attackHelp.textContent = 'ตอบโจทย์เพื่อสะสมมานา · ผิดเสียสูงสุด 8';
    else if (mana < 100 && reasons.some((reason) => reason.includes('มานา'))) this.el.attackHelp.textContent = 'ตอบโจทย์เพื่อสะสมมานาสำหรับเวทที่แรงขึ้น';
    else if (reasons.every((reason) => reason.includes('ไกล'))) this.el.attackHelp.textContent = 'เป้าหมายอยู่ไกลเกินระยะเวท';
    else if (reasons.every((reason) => reason.includes('พัก'))) this.el.attackHelp.textContent = 'เวทกำลังพัก รอสักครู่';
    else this.el.attackHelp.textContent = 'เลือกเป้าหมายในระยะ · สะสมมานาเพื่อปลดล็อกเวท';
  }

  hideQuestion() {
    this.el.question.hidden = true;
    this.el.question.classList.remove('is-active');
    this.el.questionFeedback.hidden = true;
    this.feedbackToken = (this.feedbackToken || 0) + 1;
  }

  showEnd({ won, score, roomsCleared }) {
    this.hideQuestion();
    this.el.attackChoices.forEach((button) => { button.disabled = true; });
    this.el.intro.hidden = true;
    this.el.end.hidden = false;
    this.el.endEmblem.textContent = won ? '🌟' : '🫧';
    this.el.endKicker.textContent = won ? 'DUNGEON CLEAR' : 'TRY AGAIN, LITTLE WIZARD';
    this.el.endTitle.textContent = won ? 'เก่งมาก พ่อมดน้อย!' : 'พักเติมพลังสักนิดนะ';
    this.el.endMessage.textContent = won
      ? 'เดินทางผ่านครบ 3 ห้องแล้ว เคลียร์ไป ' + roomsCleared + ' ห้อง'
      : 'ผ่านไป ' + roomsCleared + ' ห้อง ลองวางแผนเวทและใช้จังหวะหลบอีกครั้ง';
    this.el.finalScore.textContent = score.toLocaleString('th-TH');
  }

  hideStart() {
    this.el.intro.hidden = true;
  }

  destroy() {
    document.removeEventListener('pointerup', this.startActivationHandler, true);
    document.removeEventListener('click', this.startActivationHandler, true);
  }
}
