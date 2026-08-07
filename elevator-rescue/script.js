/* =========================================
   ELEVATOR RESCUE — PHYSICS GAME ENGINE
   ========================================= */
(() => {
  'use strict';

  const GRAVITY = 9.81;
  const STORAGE_KEY = 'classkru-elevator-rescue-v1';
  const MISSIONS = [
    { name: 'ช่วยช่างซ่อมลิฟต์', story: 'ช่างซ่อมติดอยู่ชั้น 4 ออกแบบระบบที่ยกห้องโดยสารขึ้นอย่างปลอดภัย', passengers: 1, mass: 220, height: 12, powerLimit: 1800, budget: 650 },
    { name: 'ส่งกล่องยาไปโรงพยาบาล', story: 'เวชภัณฑ์เร่งด่วนต้องขึ้นไปยังหอผู้ป่วยชั้น 7 โดยใช้พลังงานอย่างคุ้มค่า', passengers: 1, mass: 310, height: 21, powerLimit: 2400, budget: 780 },
    { name: 'ช่วยผู้โดยสาร 3 คน', story: 'ผู้โดยสารสามคนติดอยู่ในอาคาร ใช้รอกช่วยลดแรงและเลือกเชือกให้ทนแรงตึง', passengers: 3, mass: 410, height: 27, powerLimit: 3000, budget: 920 },
    { name: 'ภารกิจน้ำหนักถ่วง', story: 'ระบบจ่ายไฟมีจำกัด จงใช้น้ำหนักถ่วงลดภาระของมอเตอร์โดยไม่ให้หนักเกินไป', passengers: 4, mass: 500, height: 33, powerLimit: 2400, budget: 1000 },
    { name: 'กู้ภัยขณะไฟฟ้าดับ', story: 'ไฟฟ้าหลักดับทั้งอาคาร ระบบต้องมีแบตเตอรี่สำรองและใช้พลังงานต่ำ', passengers: 5, mass: 590, height: 39, powerLimit: 2800, budget: 1180, fixedEvent: 'power' },
    { name: 'BOSS: กู้ภัยทั้งอาคาร', story: 'ช่วยผู้ประสบภัยทั้งหมดขึ้นสู่ชั้นปลอดภัยภายในเวลาที่กำหนด', passengers: 8, mass: 820, height: 48, powerLimit: 4200, budget: 1450, fixedEvent: 'heat' }
  ];
  const PULLEYS = [
    { id: 'fixed', icon: '◉', name: 'รอกเดี่ยว', ma: 1, efficiency: .94, cost: 50 },
    { id: 'movable', icon: '◉◉', name: 'รอกเคลื่อนที่', ma: 2, efficiency: .88, cost: 120 },
    { id: 'compound', icon: '⚙️', name: 'รอกพวง', ma: 4, efficiency: .80, cost: 220 }
  ];
  const ROPES = [
    { id: 'standard', icon: '➰', name: 'เชือกมาตรฐาน', strength: 8000, cost: 80 },
    { id: 'reinforced', icon: '⛓️', name: 'เชือกเสริมแรง', strength: 14000, cost: 180 }
  ];
  const MOTORS = [
    { id: 'eco', icon: '🔋', name: 'Eco 1.2 kW', power: 1200, cost: 160 },
    { id: 'standard', icon: '⚡', name: 'Standard 2.2 kW', power: 2200, cost: 280 },
    { id: 'rescue', icon: '🏭', name: 'Rescue 4.0 kW', power: 4000, cost: 450 }
  ];
  const EVENTS = {
    power: { icon: '🔌', name: 'ไฟดับ', text: 'ไฟหลักดับ ต้องมีแบตเตอรี่สำรองอย่างน้อย Level 1', powerFactor: 1, needsBattery: true },
    rope: { icon: '⚠️', name: 'เชือกเสื่อม', text: 'สภาพอากาศทำให้ความแข็งแรงของเชือกลดลง 25%', ropeFactor: .75 },
    heat: { icon: '🌡️', name: 'มอเตอร์ร้อน', text: 'มอเตอร์ให้กำลังได้เพียง 80% จนกว่าจะจบภารกิจ', powerFactor: .8 },
    rain: { icon: '🌧️', name: 'ฝนตกหนัก', text: 'เชือกเปียกทำให้ความแข็งแรงลดลง 15%', ropeFactor: .85 },
    load: { icon: '📦', name: 'น้ำหนักเพิ่ม', text: 'มีอุปกรณ์กู้ภัยเพิ่ม 60 kg ในห้องโดยสาร', addedMass: 60 },
    budget: { icon: '💸', name: 'งบประมาณลด', text: 'งบฉุกเฉินถูกลดลง 120 Coins', budgetDelta: -120 }
  };
  const UPGRADE_INFO = [
    { id: 'motor', icon: '⚡', name: 'มอเตอร์', baseCost: 180, note: '+10% กำลัง' },
    { id: 'rope', icon: '⛓️', name: 'เชือก', baseCost: 160, note: '+10% ความแข็งแรง' },
    { id: 'brake', icon: '🛑', name: 'เบรก', baseCost: 140, note: '+5 ความปลอดภัย' },
    { id: 'battery', icon: '🔋', name: 'แบตเตอรี่', baseCost: 150, note: 'ใช้เมื่อไฟดับ' }
  ];

  const $ = (id) => document.getElementById(id);
  const ui = {
    level: $('level-value'), score: $('score-value'), coins: $('coin-value'), mission: $('mission-value'), missionName: $('mission-name'), missionStory: $('mission-story'), passengers: $('passenger-value'), mass: $('mass-value'), height: $('height-value'), powerLimit: $('power-limit-value'), budget: $('budget-value'),
    event: $('event-card'), force: $('force-value'), tension: $('tension-value'), energy: $('energy-value'), ropeLength: $('rope-length-value'), cost: $('cost-value'), safety: $('safety-value'), safetyBar: $('safety-bar'), hint: $('engineering-hint'), explanation: $('physics-explanation'), modeLabel: $('mode-label'),
    pulleyTools: $('pulley-tools'), ropeTools: $('rope-tools'), motorTools: $('motor-tools'), counterRange: $('counterweight-range'), counterLabel: $('counterweight-label'), speedRange: $('speed-range'), speedLabel: $('speed-label'), brake: $('brake-toggle'), test: $('test-button'),
    pulleyVisual: $('pulley-visual'), ropeVisual: $('rope-visual'), rigging: $('rigging-visual'), rigRope: $('rig-rope'), rigDrive: $('rig-drive'), rigPulleys: $('rig-pulleys'), motorVisual: $('motor-visual'), cab: $('lift-cab'), counterweight: $('counterweight'), victims: $('victims'), floors: $('floor-labels'), light: $('system-light'), sceneMessage: $('scene-message'), floatScore: $('float-score'),
    modeButtons: [...document.querySelectorAll('.mode-switch button')], upgrades: $('upgrade-list'), achievements: $('achievement-list'), timerBox: $('timer-box'), timer: $('timer-value'), sound: $('sound-button'),
    modal: $('modal'), modalIcon: $('modal-icon'), modalKicker: $('modal-kicker'), modalTitle: $('modal-title'), modalMessage: $('modal-message'), modalResult: $('modal-result'), modalPrimary: $('modal-primary'), modalExit: $('modal-exit')
  };

  class PhysicsEngine {
    static calculate(config, mission, event, upgrades) {
      const totalMass = mission.mass + (event?.addedMass || 0);
      const balanceMass = Math.min(config.counterweight, totalMass * 1.25);
      const imbalanceMass = Math.abs(totalMass - balanceMass);
      const weight = totalMass * GRAVITY;
      const imbalanceWeight = imbalanceMass * GRAVITY;
      const dynamicFactor = 1.15 + Math.max(0, config.speed - .6) * .18;
      const inputForce = imbalanceWeight / (config.pulley.ma * config.pulley.efficiency);
      const tension = weight * dynamicFactor / config.pulley.ma;
      const ropeStrength = config.rope.strength * (1 + upgrades.rope * .10) * (event?.ropeFactor || 1);
      const safeWorkingLoad = ropeStrength / 3;
      const requiredPower = imbalanceWeight * config.speed / config.pulley.efficiency;
      const selectedPower = config.motor.power * (1 + upgrades.motor * .10);
      const availablePower = Math.min(selectedPower, mission.powerLimit) * (event?.powerFactor || 1);
      const energy = imbalanceWeight * mission.height / config.pulley.efficiency / 1000;
      const ropeLength = mission.height * config.pulley.ma;
      const cost = config.pulley.cost + config.rope.cost + config.motor.cost + (config.brake ? 100 : 0) + Math.round(config.counterweight * .35);
      const budget = mission.budget + (event?.budgetDelta || 0);
      const ropeRatio = safeWorkingLoad / Math.max(1, tension);
      const powerRatio = availablePower / Math.max(1, requiredPower);
      const balanceSafe = config.counterweight <= totalMass * 1.05;
      let safety = 25 + Math.min(30, ropeRatio * 23) + Math.min(25, powerRatio * 19) + (config.brake ? 15 : 0) + upgrades.brake * 5;
      if (!balanceSafe) safety -= 25;
      safety = Math.round(Math.max(0, Math.min(100, safety)));
      const checks = {
        rope: tension <= safeWorkingLoad,
        power: requiredPower <= availablePower,
        brake: config.brake,
        budget: cost <= budget,
        balance: balanceSafe,
        battery: !event?.needsBattery || upgrades.battery > 0
      };
      return { totalMass, weight, inputForce, tension, safeWorkingLoad, requiredPower, availablePower, energy, ropeLength, cost, budget, safety, checks, success: Object.values(checks).every(Boolean) };
    }
  }

  class AudioEngine {
    constructor() { this.context = null; this.enabled = true; }
    prepare() { if (!this.enabled || this.context) return; const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (AudioContextClass) this.context = new AudioContextClass(); }
    tone(frequency, duration, type = 'sine', volume = .04, endFrequency = frequency) { if (!this.enabled) return; this.prepare(); if (!this.context) return; if (this.context.state === 'suspended') this.context.resume(); const time = this.context.currentTime; const oscillator = this.context.createOscillator(); const gain = this.context.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), time + duration); gain.gain.setValueAtTime(.001, time); gain.gain.exponentialRampToValueAtTime(volume, time + .02); gain.gain.exponentialRampToValueAtTime(.001, time + duration); oscillator.connect(gain).connect(this.context.destination); oscillator.start(time); oscillator.stop(time + duration + .03); }
    click() { this.tone(430, .07, 'triangle', .028, 520); }
    motor() { this.tone(115, .65, 'sawtooth', .035, 180); }
    fail() { this.tone(210, .33, 'sawtooth', .05, 95); }
    success() { [523, 659, 784, 1047].forEach((frequency, index) => setTimeout(() => this.tone(frequency, .19, 'triangle', .05), index * 105)); }
    unlock() { [440, 660, 880].forEach((frequency, index) => setTimeout(() => this.tone(frequency, .15, 'sine', .045), index * 80)); }
  }

  class RescueGame {
    constructor() {
      this.audio = new AudioEngine();
      this.save = this.readSave();
      this.state = { missionIndex: Math.min(this.save.unlocked - 1, MISSIONS.length - 1), score: 0, coins: this.save.coins || 0, mode: 'easy', pulley: PULLEYS[0], rope: ROPES[0], motor: MOTORS[1], counterweight: 0, speed: .6, brake: true, event: null, testing: false, timerId: null, remaining: 90, modalAction: 'start' };
      this.bind(); this.renderTools(); this.renderUpgrades(); this.loadMission(); this.renderAchievements(); this.updateHud(); this.updateAnalysis();
    }
    readSave() { const defaults = { unlocked: 1, coins: 0, highScore: 0, completed: 0, bestTime: null, stars: 0, upgrades: { motor: 0, rope: 0, brake: 0, battery: 0 }, achievements: [] }; try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); return { ...defaults, ...parsed, upgrades: { ...defaults.upgrades, ...(parsed.upgrades || {}) } }; } catch { return defaults; } }
    writeSave() { this.save.coins = this.state.coins; this.save.highScore = Math.max(this.save.highScore, this.state.score); localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save)); }
    bind() {
      ui.test.addEventListener('click', () => this.testSystem());
      ui.counterRange.addEventListener('input', () => { this.state.counterweight = Number(ui.counterRange.value); this.updateAnalysis(); });
      ui.speedRange.addEventListener('input', () => { this.state.speed = Number(ui.speedRange.value); this.updateAnalysis(); });
      ui.brake.addEventListener('change', () => { this.state.brake = ui.brake.checked; this.updateAnalysis(); });
      ui.modeButtons.forEach((button) => button.addEventListener('click', () => this.setMode(button.dataset.mode)));
      ui.sound.addEventListener('click', () => { this.audio.enabled = !this.audio.enabled; ui.sound.textContent = this.audio.enabled ? '🔊' : '🔇'; ui.sound.setAttribute('aria-pressed', String(this.audio.enabled)); ui.sound.setAttribute('aria-label', this.audio.enabled ? 'ปิดเสียง' : 'เปิดเสียง'); if (this.audio.enabled) this.audio.click(); });
      ui.modalPrimary.addEventListener('click', () => this.modalPrimary());
      document.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !this.state.testing && !ui.modal.classList.contains('visible')) this.testSystem(); });
    }
    mission() { return MISSIONS[this.state.missionIndex]; }
    pickEvent() { const mission = this.mission(); if (mission.fixedEvent) return EVENTS[mission.fixedEvent]; if (this.state.missionIndex < 2 || Math.random() > .42) return null; const eventKeys = ['rope', 'heat', 'rain', 'load', 'budget']; return EVENTS[eventKeys[Math.floor(Math.random() * eventKeys.length)]]; }
    loadMission() {
      const mission = this.mission(); this.state.event = this.pickEvent(); this.state.testing = false; this.state.counterweight = 0; this.state.speed = .6; this.state.brake = true; ui.counterRange.value = '0'; ui.speedRange.value = '.6'; ui.brake.checked = true;
      ui.missionName.textContent = mission.name; ui.missionStory.textContent = mission.story; ui.passengers.textContent = `${mission.passengers} คน`; ui.mass.textContent = `${mission.mass + (this.state.event?.addedMass || 0)} kg`; ui.height.textContent = `${mission.height} m`; ui.powerLimit.textContent = `${mission.powerLimit.toLocaleString('th-TH')} W`; ui.budget.textContent = `${mission.budget + (this.state.event?.budgetDelta || 0)} Coins`;
      ui.event.hidden = !this.state.event; if (this.state.event) ui.event.textContent = `${this.state.event.icon} เหตุการณ์: ${this.state.event.name} — ${this.state.event.text}`;
      ui.victims.textContent = mission.passengers > 5 ? '🧑‍🚒🧑‍🔧👩‍⚕️' : mission.passengers > 2 ? '🧑‍🔧👩‍⚕️' : '🧑‍🔧'; ui.floors.innerHTML = Array.from({ length: 6 }, (_, index) => `<span>F${index + 1}</span>`).join('');
      ui.cab.className = 'lift-cab'; ui.counterweight.className = 'counterweight'; ui.cab.style.transform = ''; ui.counterweight.style.transform = ''; ui.ropeVisual.className = 'rope-sensor'; ui.rigging.classList.remove('moving'); ui.motorVisual.className = 'motor-visual'; ui.pulleyVisual.className = `pulley-cluster ma-${this.state.pulley.ma}`; this.setLight('', 'รอการออกแบบ'); ui.sceneMessage.textContent = 'เลือกอุปกรณ์ แล้วกด “ทดสอบระบบ”'; ui.explanation.textContent = 'ค่าทุกช่องจะเปลี่ยนตามอุปกรณ์ที่เลือก เพื่อให้เห็นผลของหลักฟิสิกส์ทันที';
      this.startHardTimer(); this.updateHud(); this.updateAnalysis();
    }
    startHardTimer() { clearInterval(this.state.timerId); ui.timerBox.hidden = this.state.mode !== 'hard'; this.state.remaining = this.state.missionIndex === MISSIONS.length - 1 ? 75 : 90; ui.timer.textContent = this.state.remaining; if (this.state.mode !== 'hard') return; this.state.timerId = setInterval(() => { this.state.remaining -= 1; ui.timer.textContent = this.state.remaining; ui.timerBox.classList.toggle('danger', this.state.remaining <= 15); if (this.state.remaining <= 0) { clearInterval(this.state.timerId); this.showFailure(['หมดเวลาก่อนเริ่มระบบ']); } }, 1000); }
    config() { return { pulley: this.state.pulley, rope: this.state.rope, motor: this.state.motor, counterweight: this.state.counterweight, speed: this.state.speed, brake: this.state.brake }; }
    result() { return PhysicsEngine.calculate(this.config(), this.mission(), this.state.event, this.save.upgrades); }
    updateHud() { ui.level.textContent = this.state.missionIndex + 1; ui.score.textContent = this.state.score.toLocaleString('th-TH'); ui.coins.textContent = this.state.coins; ui.mission.textContent = `${this.state.missionIndex + 1}/${MISSIONS.length}`; }
    updateAnalysis() {
      const result = this.result(); const hide = this.state.mode === 'hard' && !this.state.testing;
      ui.force.textContent = hide ? '? N' : `${Math.round(result.inputForce).toLocaleString('th-TH')} N`; ui.tension.textContent = hide ? '? N' : `${Math.round(result.tension).toLocaleString('th-TH')} N`; ui.energy.textContent = hide ? '? kJ' : `${result.energy.toFixed(1)} kJ`; ui.ropeLength.textContent = `${result.ropeLength.toFixed(0)} m`; ui.cost.textContent = `${result.cost} / ${result.budget}`; ui.safety.textContent = hide ? '?' : `${result.safety}%`; ui.safetyBar.style.width = hide ? '0%' : `${result.safety}%`;
      ui.force.className = result.checks.power ? 'good' : 'bad'; ui.tension.className = result.checks.rope ? 'good' : 'bad'; ui.cost.className = result.checks.budget ? 'good' : 'bad'; ui.counterLabel.textContent = `${this.state.counterweight} kg`; ui.speedLabel.textContent = `${this.state.speed.toFixed(1)} m/s`; ui.pulleyVisual.className = `pulley-cluster ma-${this.state.pulley.ma}`; ui.counterweight.style.height = `${Math.min(92, 48 + this.state.counterweight / 12)}px`; this.drawRig(0);
      if (this.state.mode === 'easy') ui.hint.textContent = this.easyHint(result); else if (this.state.mode === 'normal') ui.hint.textContent = 'สังเกตค่าที่เป็นสีแดง แล้วปรับอุปกรณ์ให้ผ่านทุกข้อ'; else ui.hint.textContent = 'โหมด Hard ซ่อนค่าคำนวณจนกว่าจะทดสอบ และมีเวลาจำกัด';
      this.renderTools();
    }
    easyHint(result) { if (!result.checks.battery) return 'คำแนะนำ: อัปเกรดแบตเตอรี่สำรองใน Rescue Lab ก่อนทดสอบ'; if (!result.checks.rope) return 'คำแนะนำ: เพิ่ม Mechanical Advantage หรือเลือกเชือกเสริมแรง เพื่อลดแรงตึงต่อเส้น'; if (!result.checks.power) return 'คำแนะนำ: เพิ่มน้ำหนักถ่วงใกล้เคียงมวลห้องโดยสาร หรือลดความเร็ว'; if (!result.checks.brake) return 'คำแนะนำ: ระบบกู้ภัยต้องติดตั้งเบรกฉุกเฉิน'; if (!result.checks.budget) return 'คำแนะนำ: ค่าอุปกรณ์เกินงบ ลองเลือกระบบที่เรียบง่ายขึ้น'; if (!result.checks.balance) return 'คำแนะนำ: น้ำหนักถ่วงไม่ควรเกิน 105% ของมวลห้องโดยสาร'; return 'ระบบมีแนวโน้มพร้อมทดสอบ: แรง กำลัง เชือก เบรก และงบผ่านเกณฑ์'; }
    pulleyMarkup(x, y, linkedToCab = false) { return `${linkedToCab ? `<line x1="${x}" y1="${y + 13}" x2="${x}" y2="${y + 24}" stroke="#8ea4b8" stroke-width="4"/>` : ''}<circle class="rig-pulley-wheel" cx="${x}" cy="${y}" r="13"></circle><circle class="rig-pulley-hub" cx="${x}" cy="${y}" r="4"></circle>`; }
    drawRig(progress = 0) {
      const cabY = 323 - 248 * progress;
      const counterY = 92 + 215 * progress;
      const ma = this.state.pulley.ma;
      let ropePath;
      let driveX;
      let pulleys;
      if (ma === 1) {
        ropePath = `M 300 ${cabY} L 300 45 L 220 45 L 220 ${counterY}`;
        driveX = 300;
        pulleys = `${this.pulleyMarkup(300, 45)}${this.pulleyMarkup(220, 45)}`;
      } else if (ma === 2) {
        ropePath = `M 247 50 L 247 ${cabY} Q 267 ${cabY + 22} 287 ${cabY} L 287 45 L 220 45 L 220 ${counterY}`;
        driveX = 287;
        pulleys = `<circle class="rig-anchor" cx="247" cy="50" r="5"></circle>${this.pulleyMarkup(267, cabY, true)}${this.pulleyMarkup(287, 45)}${this.pulleyMarkup(220, 45)}`;
      } else {
        ropePath = `M 230 50 L 230 ${cabY} Q 248 ${cabY + 22} 266 ${cabY} L 266 45 L 284 45 L 284 ${cabY} Q 302 ${cabY + 22} 320 ${cabY} L 320 45 L 220 45 L 220 ${counterY}`;
        driveX = 320;
        pulleys = `<circle class="rig-anchor" cx="230" cy="50" r="5"></circle>${this.pulleyMarkup(248, cabY, true)}${this.pulleyMarkup(275, 45)}${this.pulleyMarkup(302, cabY, true)}${this.pulleyMarkup(320, 45)}${this.pulleyMarkup(220, 45)}`;
      }
      ui.rigRope.setAttribute('d', ropePath);
      ui.rigDrive.setAttribute('d', `M 120 38 L ${driveX} 38`);
      ui.rigPulleys.innerHTML = pulleys;
    }
    animateLift() {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = reducedMotion ? 60 : 3200;
      const cabTravel = Math.max(145, ui.cab.parentElement.clientHeight - ui.cab.offsetHeight - 40);
      const counterTravel = cabTravel * .82;
      ui.rigging.classList.add('moving');
      return new Promise((resolve) => {
        const startedAt = performance.now();
        const step = (time) => {
          const rawProgress = Math.min(1, (time - startedAt) / duration);
          const progress = .5 - Math.cos(Math.PI * rawProgress) / 2;
          ui.cab.style.transform = `translateY(${-cabTravel * progress}px)`;
          ui.counterweight.style.transform = `translateY(${counterTravel * progress}px)`;
          this.drawRig(progress);
          if (rawProgress < 1) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
    }
    renderTools() { this.renderChoice(ui.pulleyTools, PULLEYS, 'pulley'); this.renderChoice(ui.ropeTools, ROPES, 'rope'); this.renderChoice(ui.motorTools, MOTORS, 'motor'); }
    renderChoice(container, items, key) { container.innerHTML = ''; items.forEach((item) => { const button = document.createElement('button'); button.type = 'button'; button.className = `tool-button ${this.state[key].id === item.id ? 'selected' : ''}`; button.setAttribute('aria-pressed', String(this.state[key].id === item.id)); const detail = key === 'pulley' ? `MA ${item.ma}` : key === 'rope' ? `${(item.strength / 1000).toFixed(0)} kN` : `${(item.power / 1000).toFixed(1)} kW`; button.innerHTML = `<span>${item.icon}</span><b>${item.name}<br>${detail}</b><small>${item.cost}</small>`; button.addEventListener('click', () => { if (this.state.testing) return; this.state[key] = item; this.audio.click(); this.updateAnalysis(); }); container.append(button); }); }
    renderUpgrades() { ui.upgrades.innerHTML = ''; UPGRADE_INFO.forEach((upgrade) => { const level = this.save.upgrades[upgrade.id]; const cost = upgrade.baseCost * (level + 1); const button = document.createElement('button'); button.type = 'button'; button.className = 'upgrade-button'; button.disabled = level >= 3 || this.state.coins < cost; button.innerHTML = `${upgrade.icon} ${upgrade.name} Lv.${level} · ${level >= 3 ? 'MAX' : `${cost} Coins`}<br>${upgrade.note}`; button.addEventListener('click', () => this.buyUpgrade(upgrade)); ui.upgrades.append(button); }); }
    buyUpgrade(upgrade) { const level = this.save.upgrades[upgrade.id]; const cost = upgrade.baseCost * (level + 1); if (level >= 3 || this.state.coins < cost) return; this.state.coins -= cost; this.save.upgrades[upgrade.id] += 1; this.writeSave(); this.audio.unlock(); this.updateHud(); this.renderUpgrades(); this.updateAnalysis(); ui.sceneMessage.textContent = `อัปเกรด ${upgrade.name} เป็น Level ${level + 1} แล้ว`; }
    setMode(mode) { if (this.state.testing) return; this.state.mode = mode; ui.modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mode === mode)); ui.modeLabel.textContent = mode.toUpperCase(); this.audio.click(); this.startHardTimer(); this.updateAnalysis(); }
    setLight(className, text) { ui.light.className = `system-light ${className}`; ui.light.querySelector('span').textContent = text; }
    async testSystem() {
      if (this.state.testing) return; this.state.testing = true; ui.test.disabled = true; clearInterval(this.state.timerId); const result = this.result(); this.updateAnalysis(); this.setLight('ready', 'กำลังทดสอบ'); ui.sceneMessage.textContent = 'มอเตอร์เริ่มทำงาน เชือกเคลื่อนผ่านรอกอย่างต่อเนื่อง...'; ui.motorVisual.classList.add('running'); ui.pulleyVisual.classList.add('spinning'); ui.ropeVisual.classList.add('moving'); ui.rigging.classList.add('moving'); this.audio.motor(); await this.wait(1100);
      if (result.success) { await this.animateLift(); this.completeMission(result); } else { ui.cab.classList.add('failed'); this.audio.fail(); await this.wait(450); this.showFailure(this.failureReasons(result)); }
      ui.motorVisual.classList.remove('running'); ui.pulleyVisual.classList.remove('spinning'); ui.ropeVisual.classList.remove('moving'); ui.rigging.classList.remove('moving'); ui.test.disabled = false;
    }
    failureReasons(result) { const reasons = []; if (!result.checks.rope) reasons.push(`เชือกไม่ปลอดภัย: แรงตึง ${Math.round(result.tension)} N เกิน Safe Working Load ${Math.round(result.safeWorkingLoad)} N`); if (!result.checks.power) reasons.push(`กำลังไม่พอ: ต้องใช้ ${Math.round(result.requiredPower)} W แต่มี ${Math.round(result.availablePower)} W`); if (!result.checks.brake) reasons.push('ไม่มีเบรกฉุกเฉิน ระบบกู้ภัยจึงไม่ผ่านมาตรฐาน'); if (!result.checks.budget) reasons.push(`ค่าอุปกรณ์ ${result.cost} เกินงบ ${result.budget}`); if (!result.checks.balance) reasons.push('น้ำหนักถ่วงมากเกินไป อาจดึงห้องโดยสารพุ่งขึ้น'); if (!result.checks.battery) reasons.push('ไฟดับและยังไม่มีแบตเตอรี่สำรอง'); return reasons; }
    showFailure(reasons) { this.state.testing = false; this.setLight('failure', 'ทดสอบไม่ผ่าน'); ui.sceneMessage.textContent = 'ระบบหยุดอย่างปลอดภัย ปรับแบบแล้วทดลองอีกครั้ง'; ui.explanation.textContent = reasons.join(' · '); this.state.modalAction = 'retry'; this.showModal('SYSTEM CHECK FAILED', 'ระบบยังไม่ปลอดภัย', reasons.join(' '), '🛑', 'กลับไปแก้แบบ', false, ''); }
    completeMission(result) {
      const timeBonus = this.state.mode === 'hard' && this.state.remaining > 0; const energyEfficient = result.energy < result.totalMass * GRAVITY * this.mission().height / 1000 * .55; const appropriatePulley = result.tension < result.safeWorkingLoad * .75; const budgetEfficient = result.cost <= result.budget * .8; let stars = 1; if (energyEfficient) stars += 1; if (result.safety >= 85 && appropriatePulley) stars += 1;
      let gained = 500 + (energyEfficient ? 200 : 0) + (appropriatePulley ? 150 : 0) + (result.safety >= 80 ? 300 : 0) + (budgetEfficient ? 150 : 0) + (timeBonus ? 100 : 0); if (this.state.mode === 'hard') gained = Math.round(gained * 1.25); const coins = 80 + stars * 40;
      this.state.score += gained; this.state.coins += coins; this.save.completed += 1; this.save.stars = Math.max(this.save.stars, stars); this.save.unlocked = Math.max(this.save.unlocked, Math.min(MISSIONS.length, this.state.missionIndex + 2)); if (this.state.mode === 'hard') { const timeLimit = this.state.missionIndex === MISSIONS.length - 1 ? 75 : 90; const elapsed = timeLimit - this.state.remaining; this.save.bestTime = this.save.bestTime === null ? elapsed : Math.min(this.save.bestTime, elapsed); } this.writeSave();
      this.setLight('success', 'ช่วยเหลือสำเร็จ'); ui.sceneMessage.textContent = 'ผู้ประสบภัยถึงชั้นปลอดภัยแล้ว!'; ui.floatScore.textContent = `+${gained}`; ui.floatScore.classList.remove('active'); void ui.floatScore.offsetWidth; ui.floatScore.classList.add('active'); ui.explanation.textContent = `ระบบรอก MA ${this.state.pulley.ma} ทำให้แรงที่มอเตอร์ออกเหลือ ${Math.round(result.inputForce)} N แต่ต้องดึงเชือก ${result.ropeLength.toFixed(0)} m งานของระบบประมาณ ${result.energy.toFixed(1)} kJ`; this.audio.success(); this.updateHud(); this.renderUpgrades(); this.renderAchievements();
      const finalMission = this.state.missionIndex === MISSIONS.length - 1; this.state.modalAction = finalMission ? 'restart' : 'next'; this.showModal('RESCUE COMPLETE', finalMission ? 'ภารกิจกู้ภัยทั้งหมดสำเร็จ!' : 'ช่วยเหลือสำเร็จ!', `คุณออกแบบระบบที่ผ่านทั้งแรงตึง กำลัง เบรก และงบประมาณ พร้อมอธิบายได้ด้วยหลักงานและพลังงาน`, '🏆', finalMission ? 'เล่นใหม่' : 'ภารกิจถัดไป', true, `<span class="result-chip">${'⭐'.repeat(stars)}</span><span class="result-chip">+${coins} Coins</span><span class="result-chip">+${gained}</span>`);
    }
    renderAchievements() { const achievements = [ { icon: '🦸', name: 'Rescue Hero', unlocked: this.save.completed >= 1 }, { icon: '⚙️', name: 'Pulley Master', unlocked: this.save.stars >= 3 }, { icon: '🔋', name: 'Energy Saver', unlocked: this.save.completed >= 3 }, { icon: '🛡️', name: 'Safe Engineer', unlocked: this.save.upgrades.brake >= 1 }, { icon: '🏗️', name: 'Elevator Expert', unlocked: this.save.unlocked >= 6 }, { icon: '🧠', name: 'Physics Genius', unlocked: this.save.completed >= 6 } ]; this.save.achievements = achievements.filter((item) => item.unlocked).map((item) => item.name); localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save)); ui.achievements.innerHTML = achievements.map((item) => `<span class="achievement ${item.unlocked ? 'unlocked' : ''}">${item.icon} ${item.name}</span>`).join(''); }
    showModal(kicker, title, message, icon, primary, exit, result) { ui.modalKicker.textContent = kicker; ui.modalTitle.textContent = title; ui.modalMessage.textContent = message; ui.modalIcon.textContent = icon; ui.modalPrimary.textContent = primary; ui.modalExit.hidden = !exit; ui.modalResult.hidden = !result; ui.modalResult.innerHTML = result; ui.modal.classList.add('visible'); }
    modalPrimary() { this.audio.prepare(); this.audio.click(); ui.modal.classList.remove('visible'); if (this.state.modalAction === 'next') this.state.missionIndex += 1; else if (this.state.modalAction === 'restart') this.state.missionIndex = 0; if (this.state.modalAction !== 'retry' && this.state.modalAction !== 'start') this.loadMission(); else if (this.state.modalAction === 'retry') { this.state.testing = false; ui.cab.classList.remove('failed'); ui.cab.style.transform = ''; ui.counterweight.style.transform = ''; this.drawRig(0); this.startHardTimer(); } this.state.modalAction = 'playing'; }
    wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
  }

  new RescueGame();
})();
