/* =========================================
   MATH WIZARD — GAME ENGINE (Vanilla ES6)
   ========================================= */
(() => {
  'use strict';

  const STORAGE_KEY = 'classkru-math-wizard-stats-v1';
  const DIFFICULTIES = { easy: { label: 'ง่าย', seconds: 15 }, medium: { label: 'กลาง', seconds: 10 }, hard: { label: 'ยาก', seconds: 7 } };
  const SKILLS = { fireball: { name: 'Fireball', mana: 30, damage: 34, cooldown: 9, spell: 'fire' }, lightning: { name: 'Lightning', mana: 50, damage: 54, cooldown: 14, spell: 'lightning' }, meteor: { name: 'Meteor', mana: 100, damage: 105, cooldown: 24, spell: 'meteor' } };
  const SPELLS = [
    { name: 'Magic Bolt', className: 'bolt' }, { name: 'Fireball', className: 'fire' }, { name: 'Lightning', className: 'lightning' },
    { name: 'Ice Spear', className: 'ice' }, { name: 'Wind Slash', className: 'wind' }, { name: 'Holy Light', className: 'holy' }, { name: 'Meteor', className: 'meteor' }
  ];
  const MONSTERS = [
    { type: 'slime', name: 'Mystic Slime', color: '#5ce7a2', glow: '#55ffd1' }, { type: 'goblin', name: 'Forest Goblin', color: '#81bb5d', glow: '#b6f56d' },
    { type: 'skeleton', name: 'Bone Mage', color: '#e3e2d2', glow: '#e7dcff' }, { type: 'wolf', name: 'Moonfang Wolf', color: '#7999bd', glow: '#82c9ff' },
    { type: 'ghost', name: 'Ancient Ghost', color: '#9aa8ff', glow: '#d5c7ff' }, { type: 'orc', name: 'Ember Orc', color: '#b8795e', glow: '#ff9569' },
    { type: 'dragon', name: 'Crystal Dragon', color: '#855dc4', glow: '#bd83ff' }
  ];

  const $ = (id) => document.getElementById(id);
  const ui = {
    score: $('score-value'), combo: $('combo-value'), mana: $('mana-value'), stage: $('stage-value'), status: $('battle-status'),
    playerHp: $('player-hp-bar'), playerHpLabel: $('player-hp-label'), monsterHp: $('monster-hp-bar'), monsterHpLabel: $('monster-hp-label'),
    monsterName: $('monster-name'), monster: $('monster-character'), player: $('player-character'), question: $('question-text'), answers: [...document.querySelectorAll('.answer-button')],
    timer: $('timer-value'), timerBar: $('timer-bar'), timerBox: $('timer-box'), spellCircle: $('spell-circle'), projectile: $('spell-projectile'), burst: $('spell-burst'), damage: $('damage-number'),
    skills: [...document.querySelectorAll('.skill-button')], difficulties: [...document.querySelectorAll('.difficulty-button')], sound: $('sound-toggle'),
    modal: $('modal-layer'), modalTitle: $('modal-title'), modalMessage: $('modal-message'), modalKicker: $('modal-kicker'), modalEmblem: $('modal-emblem'), modalPrimary: $('modal-primary'), modalExit: $('modal-exit'), modalRewards: $('modal-rewards'), statsButton: $('stats-button'), statsPanel: $('stats-panel')
  };

  const state = {
    running: false, busy: false, difficulty: 'easy', playerHp: 100, mana: 20, score: 0, combo: 0, bestCombo: 0, stage: 1, defeated: 0,
    correct: 0, answered: 0, question: null, monster: null, monsterHp: 0, monsterMaxHp: 0, startedAt: 0, timerId: null, cooldowns: {}, soundOn: true, gameWon: false, recordedResult: false, modalContinue: false
  };
  let audioContext = null;

  function readStats() {
    const defaults = { highScore: 0, gamesPlayed: 0, gamesWon: 0, bestCombo: 0, highestStage: 1, answers: 0, correct: 0 };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return defaults; }
  }
  function saveStats(next) { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  function accuracy() { return state.answered ? Math.round((state.correct / state.answered) * 100) : 0; }
  function random(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(list) { return list[random(0, list.length - 1)]; }
  function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
  function wait(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

  /* Web Audio API: all sounds are synthesized, with no media files. */
  function prepareAudio() {
    if (!state.soundOn || audioContext) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) audioContext = new AudioCtor();
  }
  function tone(freq, duration, type = 'sine', volume = 0.05, sweep = 0) {
    if (!state.soundOn) return;
    prepareAudio();
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(freq, now);
    if (sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), now + duration);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination); oscillator.start(now); oscillator.stop(now + duration + 0.02);
  }
  const sounds = {
    button: () => tone(460, .07, 'square', .028, 100), magic: () => { tone(320, .22, 'sine', .05, 660); tone(740, .17, 'triangle', .025, 380); },
    explode: () => { tone(125, .25, 'sawtooth', .07, -75); tone(95, .18, 'triangle', .05, -30); }, wrong: () => { tone(180, .28, 'sawtooth', .06, -70); },
    critical: () => { tone(660, .12, 'square', .06, 650); tone(990, .25, 'sine', .05, 440); }, victory: () => [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, .21, 'triangle', .06), i * 100)),
    defeat: () => [360, 285, 210].forEach((f, i) => window.setTimeout(() => tone(f, .28, 'sawtooth', .055), i * 140)), warning: () => tone(730, .06, 'square', .025, -120)
  };

  function monsterSvg(monster) {
    const base = `fill="${monster.color}" stroke="#24123d" stroke-width="4" stroke-linejoin="round"`;
    const eye = '<circle cx="75" cy="86" r="7" fill="#fff"/><circle cx="111" cy="86" r="7" fill="#fff"/><circle cx="76" cy="87" r="3" fill="#24123d"/><circle cx="110" cy="87" r="3" fill="#24123d"/>';
    const variants = {
      slime: `<path ${base} d="M32 165 C27 104 51 55 93 55 C135 55 158 104 153 165 Q93 194 32 165Z"/><path d="M55 126 Q92 151 130 126" fill="none" stroke="#24123d" stroke-width="4"/>${eye}<circle cx="50" cy="141" r="6" fill="#caffdb" opacity=".7"/>`,
      goblin: `<path ${base} d="M49 67 L21 48 L36 91 L31 157 Q91 192 151 157 L146 91 L165 48 L136 67 Q92 37 49 67Z"/><path fill="#633d2d" d="M58 132 Q92 162 128 132 L121 159 H64Z"/>${eye}<path d="M73 116 L82 125 L91 114 L100 125 L110 115" fill="none" stroke="#fff0d7" stroke-width="4"/>`,
      skeleton: `<path ${base} d="M50 70 Q92 38 134 70 L139 124 Q92 156 45 124Z"/><path fill="#b6b7b8" stroke="#24123d" stroke-width="4" d="M56 132 L128 132 L143 184 L41 184Z"/><path d="M69 115 H115 M75 129 H109" stroke="#24123d" stroke-width="4"/>${eye}<path d="M53 145 L132 171 M132 145 L53 171" stroke="#5f5665" stroke-width="5"/>`,
      wolf: `<path ${base} d="M39 151 L42 74 L64 90 L77 49 L93 78 L115 49 L122 90 L148 74 L151 151 Q93 190 39 151Z"/><path fill="#dae7f0" d="M65 119 Q93 151 121 119 L113 153 H73Z"/>${eye}<path d="M82 142 L94 151 L106 142" fill="none" stroke="#24123d" stroke-width="4"/>`,
      ghost: `<path ${base} d="M45 164 V93 Q48 45 93 44 Q138 45 141 93 V164 Q127 148 114 166 Q99 147 85 166 Q65 147 45 164Z" opacity=".88"/>${eye}<path d="M71 116 Q93 132 115 116" fill="none" stroke="#24123d" stroke-width="4"/>`,
      orc: `<path ${base} d="M46 67 L27 53 L35 91 L33 157 Q93 192 153 157 L151 91 L169 53 L140 67 Q93 40 46 67Z"/><path fill="#f1d4ba" d="M68 117 H118 L112 144 H74Z"/>${eye}<path d="M69 125 L76 142 L83 126 M102 126 L110 142 L117 125" fill="#fff" stroke="#24123d" stroke-width="2"/>`,
      dragon: `<path ${base} d="M39 162 L34 88 L63 97 L49 50 L83 76 L94 35 L108 76 L142 50 L127 97 L154 88 L149 162 Q94 196 39 162Z"/><path fill="#bba5ff" d="M69 122 L93 151 L117 122 L108 162 H78Z"/>${eye}<path d="M70 112 L84 105 M102 105 L116 112" stroke="#24123d" stroke-width="5"/>`
    };
    return `<svg viewBox="0 0 185 220" role="img" aria-label="${monster.name}"><g class="monster-glow">${variants[monster.type]}</g><ellipse cx="93" cy="191" rx="62" ry="10" fill="rgba(0,0,0,.25)"/></svg>`;
  }

  function updateHud() {
    ui.score.textContent = state.score.toLocaleString('th-TH'); ui.combo.textContent = state.combo; ui.mana.textContent = state.mana; ui.stage.textContent = state.stage;
    ui.playerHp.style.width = `${Math.max(0, state.playerHp)}%`; ui.playerHpLabel.textContent = `${Math.max(0, state.playerHp)} / 100 HP`;
    const monsterPercent = state.monsterMaxHp ? (state.monsterHp / state.monsterMaxHp) * 100 : 100;
    ui.monsterHp.style.width = `${Math.max(0, monsterPercent)}%`; ui.monsterHpLabel.textContent = `${Math.max(0, state.monsterHp)} / ${state.monsterMaxHp} HP`;
  }
  function setStatus(text) { ui.status.textContent = text; }
  function setAnswerEnabled(enabled) { ui.answers.forEach((button) => { button.disabled = !enabled; }); }
  function setSkillsEnabled() { ui.skills.forEach((button) => { const skill = SKILLS[button.dataset.skill]; const remaining = Math.max(0, (state.cooldowns[button.dataset.skill] || 0) - Date.now()); button.disabled = !state.running || state.busy || state.mana < skill.mana || remaining > 0; button.querySelector('small').textContent = remaining > 0 ? `${Math.ceil(remaining / 1000)} วินาที` : `${skill.mana} มานา`; }); }

  function spawnMonster() {
    const pool = state.stage < 4 ? MONSTERS.slice(0, 4) : state.stage < 7 ? MONSTERS.slice(0, 6) : MONSTERS;
    state.monster = pick(pool); state.monsterMaxHp = 72 + (state.stage - 1) * 18; state.monsterHp = state.monsterMaxHp;
    ui.monsterName.textContent = state.monster.name; ui.monster.innerHTML = monsterSvg(state.monster); ui.monster.style.setProperty('--monster-glow', state.monster.glow); updateHud();
  }

  /* Questions are generated with one unique correct choice and three unique alternatives. */
  function makeOptions(answer, formatter = (value) => String(value), distance = 4) {
    const correct = formatter(answer); const choices = new Set([correct]);
    let guard = 0;
    while (choices.size < 4 && guard < 60) { const delta = random(-distance, distance); if (delta !== 0) choices.add(formatter(answer + delta)); guard += 1; }
    return shuffle([...choices]);
  }
  function shuffle(items) { for (let i = items.length - 1; i > 0; i -= 1) { const j = random(0, i); [items[i], items[j]] = [items[j], items[i]]; } return items; }
  function makeQuestion() {
    const difficulty = state.difficulty;
    if (difficulty === 'easy') {
      const addition = Math.random() > .48; let a; let b;
      if (addition) { a = random(1, 15); b = random(1, 20 - a); } else { a = random(2, 20); b = random(1, a - 1); }
      const answer = addition ? a + b : a - b; return { text: `${a} ${addition ? '+' : '−'} ${b} = ?`, answer: String(answer), choices: makeOptions(answer) };
    }
    if (difficulty === 'medium') {
      const multiplication = Math.random() > .46;
      if (multiplication) { const a = random(2, 12); const b = random(2, 12); const answer = a * b; return { text: `${a} × ${b} = ?`, answer: String(answer), choices: makeOptions(answer, String, 12) }; }
      const divisor = random(2, 12); const answer = random(2, 12); const dividend = divisor * answer; return { text: `${dividend} ÷ ${divisor} = ?`, answer: String(answer), choices: makeOptions(answer, String, 5) };
    }
    const version = random(0, 2);
    if (version === 0) { const a = random(2, 9); const b = random(2, 8); const c = random(2, 6); const answer = (a + b) * c; return { text: `(${a} + ${b}) × ${c} = ?`, answer: String(answer), choices: makeOptions(answer, String, 10) }; }
    if (version === 1) { const denominator = pick([2, 3, 4, 5, 6, 8]); const a = random(1, denominator - 1); const b = random(1, denominator - 1); const numerator = a + b; const divisor = gcd(numerator, denominator); const n = numerator / divisor; const d = denominator / divisor; const result = d === 1 ? String(n) : `${n}/${d}`; const options = new Set([result]); while (options.size < 4) { const wrongN = Math.max(1, n + pick([-2, -1, 1, 2])); const wrongD = Math.max(2, d + pick([-1, 1, 2])); options.add(`${wrongN}/${wrongD}`); } return { text: `${a}/${denominator} + ${b}/${denominator} = ?`, answer: result, choices: shuffle([...options]) }; }
    const a = random(11, 49) / 10; const b = random(11, 49) / 10; const answer = Math.round((a + b) * 10) / 10; return { text: `${a.toFixed(1)} + ${b.toFixed(1)} = ?`, answer: answer.toFixed(1), choices: makeOptions(answer, (value) => Number(value).toFixed(1), 1) };
  }
  function loadQuestion() {
    if (!state.running) return;
    state.question = makeQuestion(); state.startedAt = Date.now();
    ui.question.textContent = state.question.text; ui.answers.forEach((button, index) => { button.className = 'answer-button'; button.querySelector('span').textContent = state.question.choices[index]; });
    setAnswerEnabled(true); updateTimer(); window.clearInterval(state.timerId); state.timerId = window.setInterval(updateTimer, 100); setStatus(`คาถา ${DIFFICULTIES[state.difficulty].label} พร้อมแล้ว เลือกคำตอบให้ทันเวลา`);
  }
  function updateTimer() {
    if (!state.running || state.busy) return;
    const max = DIFFICULTIES[state.difficulty].seconds * 1000; const remaining = Math.max(0, max - (Date.now() - state.startedAt)); const seconds = remaining / 1000;
    ui.timer.textContent = seconds.toFixed(1); ui.timerBar.style.width = `${(remaining / max) * 100}%`;
    const isDanger = seconds <= 3; ui.timerBox.classList.toggle('danger', isDanger); ui.timerBar.classList.toggle('danger', isDanger);
    if (isDanger && Math.floor(seconds * 10) % 10 === 0) sounds.warning();
    if (!remaining) { window.clearInterval(state.timerId); resolveAnswer(null); }
  }

  function spellForCombo() { if (state.combo >= 10) return SPELLS[6]; if (state.combo >= 5) return pick(SPELLS.slice(1)); if (state.combo >= 3) return pick(SPELLS.slice(0, 5)); return SPELLS[0]; }
  async function playSpell({ name, className }, damage, critical = false) {
    ui.spellCircle.className = `spell-circle active ${state.combo >= 3 ? 'combo' : ''}`; ui.projectile.className = `spell-projectile ${className} active`; setStatus(`${name}! ${critical ? 'CRITICAL!' : ''}`);
    sounds.magic(); await wait(460); ui.burst.className = 'spell-burst active'; ui.damage.textContent = `${critical ? 'CRITICAL ' : ''}-${damage}`; ui.damage.className = `damage-number active ${critical ? 'critical' : ''}`;
    ui.monster.classList.remove('is-hit'); void ui.monster.offsetWidth; ui.monster.classList.add('is-hit'); document.body.classList.add(critical ? 'critical-flash' : 'screen-flash'); critical ? sounds.critical() : sounds.explode(); await wait(310); document.body.classList.remove('screen-flash', 'critical-flash');
  }
  async function resolveAnswer(value) {
    if (!state.running || state.busy) return;
    state.busy = true; window.clearInterval(state.timerId); setAnswerEnabled(false); state.answered += 1;
    const correct = value === state.question.answer;
    const selected = ui.answers.find((button) => button.querySelector('span').textContent === value);
    const correctButton = ui.answers.find((button) => button.querySelector('span').textContent === state.question.answer);
    if (correct) {
      selected?.classList.add('is-correct'); state.correct += 1; state.combo += 1; state.bestCombo = Math.max(state.bestCombo, state.combo);
      const spell = spellForCombo(); const critical = state.combo >= 5 && Math.random() < Math.min(.5, .12 + state.combo * .035); const baseDamage = 19 + state.combo * 4; const damage = critical ? baseDamage * 2 : baseDamage;
      const speedBonus = (Date.now() - state.startedAt) < DIFFICULTIES[state.difficulty].seconds * 500 ? 50 : 0; const comboBonus = state.combo >= 2 ? Math.round((100 + speedBonus) * .2) : 0;
      state.score += 100 + speedBonus + comboBonus + (critical ? 100 : 0); state.mana = Math.min(100, state.mana + 10); updateHud(); await playSpell(spell, damage, critical); state.monsterHp = Math.max(0, state.monsterHp - damage); updateHud();
      if (state.monsterHp === 0) { await victory(); return; }
    } else {
      selected?.classList.add('is-wrong'); correctButton?.classList.add('is-correct'); state.combo = 0; updateHud(); setStatus(value === null ? 'คาถาสลาย เพราะหมดเวลา!' : 'คาถาผิดพลาด! มอนสเตอร์สวนกลับ'); sounds.wrong(); await wait(700); await monsterAttack(); if (state.playerHp <= 0) { await gameOver(); return; }
    }
    await wait(360); state.busy = false; setSkillsEnabled(); loadQuestion();
  }
  async function monsterAttack() {
    const damage = 11 + Math.min(15, state.stage * 2); ui.monster.classList.remove('is-hit'); ui.monster.style.transform = 'translateX(-15px) scale(1.06)'; await wait(180); ui.monster.style.transform = ''; ui.player.classList.remove('is-hit'); void ui.player.offsetWidth; ui.player.classList.add('is-hit'); state.playerHp = Math.max(0, state.playerHp - damage); updateHud(); ui.damage.textContent = `-${damage}`; ui.damage.className = 'damage-number active'; ui.damage.style.left = '5%'; ui.damage.style.right = 'auto'; await wait(460); ui.damage.style.left = ''; ui.damage.style.right = '';
  }
  async function castSkill(key) {
    const skill = SKILLS[key]; const remaining = Math.max(0, (state.cooldowns[key] || 0) - Date.now());
    if (!state.running || state.busy || state.mana < skill.mana || remaining > 0) { sounds.button(); return; }
    state.busy = true; setAnswerEnabled(false); state.mana -= skill.mana; state.cooldowns[key] = Date.now() + skill.cooldown * 1000; updateHud(); setSkillsEnabled(); await playSpell({ name: skill.name, className: skill.spell }, skill.damage, key === 'meteor'); state.monsterHp = Math.max(0, state.monsterHp - skill.damage); updateHud();
    if (state.monsterHp === 0) { await victory(); return; }
    state.busy = false; setAnswerEnabled(true); setStatus(`${skill.name} สำเร็จ! จงตอบโจทย์ต่อเพื่อสะสมมานา`); setSkillsEnabled();
  }

  function showModal({ kicker, title, message, emblem, primary, exit = false, rewards = '' }) {
    ui.modalKicker.textContent = kicker; ui.modalTitle.textContent = title; ui.modalMessage.textContent = message; ui.modalEmblem.textContent = emblem; ui.modalPrimary.textContent = primary; ui.modalExit.hidden = !exit; ui.modalRewards.hidden = !rewards; ui.modalRewards.innerHTML = rewards; ui.modal.classList.add('is-visible');
  }
  function closeModal() { ui.modal.classList.remove('is-visible'); }
  function recordStats({ won = false } = {}) {
    if (state.recordedResult) return; state.recordedResult = true;
    const stats = readStats(); stats.highScore = Math.max(stats.highScore, state.score); stats.bestCombo = Math.max(stats.bestCombo, state.bestCombo); stats.highestStage = Math.max(stats.highestStage, state.stage); stats.answers += state.answered; stats.correct += state.correct; if (won) stats.gamesWon += 1; saveStats(stats);
  }
  async function victory() {
    state.running = false; window.clearInterval(state.timerId); state.gameWon = true; state.modalContinue = true; state.score += 500; state.defeated += 1; state.stage += 1; updateHud(); sounds.victory(); recordStats({ won: true });
    await wait(620); showModal({ kicker: 'VICTORY!', title: 'มอนสเตอร์พ่ายแพ้!', message: 'วงเวทสว่างไสว คุณพิชิตศัตรูได้ด้วยพลังแห่งความรู้', emblem: '🏆', primary: 'สู้ต่อ', exit: true, rewards: '<span class="reward">EXP +100</span><span class="reward">Gold +50</span><span class="reward">Perfect +500</span>' });
  }
  async function gameOver() {
    state.running = false; state.modalContinue = false; window.clearInterval(state.timerId); setSkillsEnabled(); sounds.defeat(); recordStats(); await wait(500);
    showModal({ kicker: 'GAME OVER', title: 'พลังเวทหมดลงแล้ว', message: `คะแนน ${state.score.toLocaleString('th-TH')} · คอมโบสูงสุด ${state.bestCombo} · ความแม่นยำ ${accuracy()}% · พิชิตมอนสเตอร์ ${state.defeated} ตัว`, emblem: '☾', primary: 'ลองอีกครั้ง', exit: true });
  }
  function startGame(continueBattle = false) {
    prepareAudio(); sounds.button(); closeModal();
    if (!continueBattle) {
      state.running = true; state.busy = false; state.playerHp = 100; state.mana = 20; state.score = 0; state.combo = 0; state.bestCombo = 0; state.stage = 1; state.defeated = 0; state.correct = 0; state.answered = 0; state.cooldowns = {}; state.gameWon = false; state.recordedResult = false; state.modalContinue = false;
      const stats = readStats(); stats.gamesPlayed += 1; saveStats(stats); spawnMonster();
    } else { state.running = true; state.busy = false; spawnMonster(); }
    updateHud(); setSkillsEnabled(); loadQuestion();
  }
  function updateStatsPanel() {
    const stats = readStats(); const totalAccuracy = stats.answers ? Math.round((stats.correct / stats.answers) * 100) : 0;
    ui.statsPanel.innerHTML = `<div class="stat"><span>คะแนนสูงสุด</span><strong>${stats.highScore.toLocaleString('th-TH')}</strong></div><div class="stat"><span>เล่นแล้ว</span><strong>${stats.gamesPlayed} เกม</strong></div><div class="stat"><span>ชนะแล้ว</span><strong>${stats.gamesWon} เกม</strong></div><div class="stat"><span>คอมโบสูงสุด</span><strong>${stats.bestCombo}</strong></div><div class="stat"><span>ด่านสูงสุด</span><strong>${stats.highestStage}</strong></div><div class="stat"><span>ความแม่นยำ</span><strong>${totalAccuracy}%</strong></div>`;
  }

  ui.answers.forEach((button) => button.addEventListener('click', () => { prepareAudio(); resolveAnswer(button.querySelector('span').textContent); }));
  ui.skills.forEach((button) => button.addEventListener('click', () => { prepareAudio(); castSkill(button.dataset.skill); }));
  ui.difficulties.forEach((button) => button.addEventListener('click', () => { if (!state.running || state.busy) return; state.difficulty = button.dataset.difficulty; ui.difficulties.forEach((item) => item.classList.toggle('is-active', item === button)); window.clearInterval(state.timerId); loadQuestion(); sounds.button(); }));
  ui.sound.addEventListener('click', () => { state.soundOn = !state.soundOn; ui.sound.textContent = state.soundOn ? '🔊' : '🔇'; ui.sound.setAttribute('aria-label', state.soundOn ? 'ปิดเสียง' : 'เปิดเสียง'); ui.sound.setAttribute('aria-pressed', String(state.soundOn)); if (state.soundOn) { prepareAudio(); sounds.button(); } });
  ui.modalPrimary.addEventListener('click', () => startGame(state.modalContinue));
  ui.statsButton.addEventListener('click', () => { const opening = ui.statsPanel.hidden; ui.statsPanel.hidden = !opening; if (opening) updateStatsPanel(); });
  document.addEventListener('keydown', (event) => { if (event.repeat || ui.modal.classList.contains('is-visible')) return; const key = event.key.toLowerCase(); if (/^[1-4]$/.test(key)) { event.preventDefault(); const button = ui.answers[Number(key) - 1]; if (!button.disabled) button.click(); } if (key === 'f') castSkill('fireball'); if (key === 'l') castSkill('lightning'); if (key === 'm') castSkill('meteor'); });
  window.setInterval(setSkillsEnabled, 250);
  updateHud(); updateStatsPanel();
})();
