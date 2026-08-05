/* =========================================
   MOLECULE BUILDER — INTERACTIVE LAB
   ========================================= */
(() => {
  'use strict';

  const STORAGE_KEY = 'classkru-molecule-builder-v1';
  const $ = (id) => document.getElementById(id);
  const ui = {
    level: $('level-value'), xp: $('xp-value'), coins: $('coin-value'), mission: $('mission-value'), time: $('time-value'),
    atomList: $('atom-list'), area: $('building-area'), bondLayer: $('bond-layer'), ghost: $('ghost-guide'), particles: $('particle-layer'), empty: $('empty-message'),
    missionNumber: $('mission-number'), missionPrompt: $('mission-prompt'), targetFormula: $('target-formula'), bondButtons: [...document.querySelectorAll('[data-bond]')], modeButtons: [...document.querySelectorAll('[data-mode]')],
    deleteButton: $('delete-button'), clearButton: $('clear-button'), hintButton: $('hint-button'), checkButton: $('check-button'), feedback: $('feedback'), selection: $('selection-message'),
    zoomIn: $('zoom-in'), zoomOut: $('zoom-out'), zoomLabel: $('zoom-label'), formula: $('current-formula'), atomCount: $('atom-count'), bondCount: $('bond-count'), bondType: $('bond-type'), valence: $('valence-status'), status: $('structure-status'),
    knowledge: $('knowledge-card'), moleculeBadge: $('molecule-badge'), knowledgeName: $('knowledge-name'), knowledgeDescription: $('knowledge-description'), knowledgeState: $('knowledge-state'), knowledgeBoiling: $('knowledge-boiling'), knowledgeMelting: $('knowledge-melting'), knowledgeBond: $('knowledge-bond'), knowledgeUse: $('knowledge-use'), achievements: $('achievement-list'),
    journalButton: $('journal-button'), journalModal: $('journal-modal'), journalClose: $('journal-close'), journalGrid: $('journal-grid'), sound: $('sound-button'),
    modal: $('modal'), modalIcon: $('modal-icon'), modalKicker: $('modal-kicker'), modalTitle: $('modal-title'), modalMessage: $('modal-message'), modalRewards: $('modal-rewards'), modalPrimary: $('modal-primary'), modalSecondary: $('modal-secondary')
  };

  class LabAudio {
    constructor() { this.context = null; this.enabled = true; }
    prepare() { if (!this.enabled || this.context) return; const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (AudioContextClass) this.context = new AudioContextClass(); }
    tone(frequency, duration, type = 'sine', volume = .04, endFrequency = frequency) { if (!this.enabled) return; this.prepare(); if (!this.context) return; if (this.context.state === 'suspended') this.context.resume(); const now = this.context.currentTime; const oscillator = this.context.createOscillator(); const gain = this.context.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration); gain.gain.setValueAtTime(.001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .015); gain.gain.exponentialRampToValueAtTime(.001, now + duration); oscillator.connect(gain).connect(this.context.destination); oscillator.start(now); oscillator.stop(now + duration + .02); }
    drag() { this.tone(310, .06, 'triangle', .025, 420); }
    bond() { this.tone(560, .1, 'sine', .04, 820); }
    error() { this.tone(180, .24, 'sawtooth', .045, 90); }
    success() { [523, 659, 784, 1047].forEach((frequency, index) => setTimeout(() => this.tone(frequency, .2, 'triangle', .05), index * 95)); }
    bonus() { [740, 988, 1175].forEach((frequency, index) => setTimeout(() => this.tone(frequency, .14, 'sine', .04), index * 65)); }
  }

  class MoleculeGame {
    constructor(dataset) {
      this.engine = new window.ChemistryEngine(dataset);
      this.dataset = dataset;
      this.audio = new LabAudio();
      this.save = this.readSave();
      this.state = { missionIndex: Math.min(this.save.level - 1, dataset.molecules.length - 1), mode: 'easy', atoms: [], bonds: [], selected: [], bondType: 'single', zoom: 1, atomSerial: 0, attempts: 0, timerId: null, remaining: 180, modalAction: 'start', dragging: null };
      this.bind();
      this.renderAtomLibrary();
      this.loadMission();
      this.renderJournal();
      this.renderAchievements();
      this.updateHud();
    }

    readSave() {
      const defaults = { level: 1, xp: 0, coins: 0, journal: [], achievements: [], bestTime: null, bondTypes: [], gamesPlayed: 0 };
      try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return defaults; }
    }
    writeSave() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save)); }
    target() { return this.dataset.molecules[this.state.missionIndex]; }

    bind() {
      ui.area.addEventListener('dragover', (event) => { event.preventDefault(); ui.area.classList.add('is-over'); });
      ui.area.addEventListener('dragleave', () => ui.area.classList.remove('is-over'));
      ui.area.addEventListener('drop', (event) => { event.preventDefault(); ui.area.classList.remove('is-over'); const symbol = event.dataTransfer.getData('text/plain'); const point = this.areaPoint(event.clientX, event.clientY); this.addAtom(symbol, point.x, point.y); });
      ui.bondButtons.forEach((button) => button.addEventListener('click', () => this.setBondType(button.dataset.bond)));
      ui.modeButtons.forEach((button) => button.addEventListener('click', () => this.setMode(button.dataset.mode)));
      ui.deleteButton.addEventListener('click', () => this.deleteSelected());
      ui.clearButton.addEventListener('click', () => this.clearCanvas());
      ui.hintButton.addEventListener('click', () => this.showHint());
      ui.checkButton.addEventListener('click', () => this.checkMolecule());
      ui.zoomIn.addEventListener('click', () => this.setZoom(this.state.zoom + .1));
      ui.zoomOut.addEventListener('click', () => this.setZoom(this.state.zoom - .1));
      ui.journalButton.addEventListener('click', () => this.openJournal());
      ui.journalClose.addEventListener('click', () => ui.journalModal.classList.remove('visible'));
      ui.modalPrimary.addEventListener('click', () => this.modalPrimary());
      ui.modalSecondary.addEventListener('click', () => this.openJournal());
      ui.sound.addEventListener('click', () => { this.audio.enabled = !this.audio.enabled; ui.sound.textContent = this.audio.enabled ? '🔊' : '🔇'; ui.sound.setAttribute('aria-pressed', String(this.audio.enabled)); ui.sound.setAttribute('aria-label', this.audio.enabled ? 'ปิดเสียง' : 'เปิดเสียง'); if (this.audio.enabled) this.audio.drag(); });
      window.addEventListener('resize', () => this.renderBonds());
      document.addEventListener('keydown', (event) => { if (event.key === 'Delete' || event.key === 'Backspace') { if (this.state.selected.length) { event.preventDefault(); this.deleteSelected(); } } if (event.key === 'Enter' && !ui.modal.classList.contains('visible') && document.activeElement === ui.area) this.checkMolecule(); });
    }

    renderAtomLibrary() {
      ui.atomList.innerHTML = '';
      this.dataset.elements.forEach((element) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'atom-source';
        button.draggable = true;
        button.dataset.symbol = element.symbol;
        button.style.setProperty('--atom-color', element.color);
        button.setAttribute('aria-label', `เพิ่ม ${element.thai} สัญลักษณ์ ${element.symbol} เวเลนซ์ ${element.valence}`);
        button.innerHTML = `<b>${element.symbol}</b><span>${element.thai}</span><small>${element.atomicNumber} · V${element.valence}</small>`;
        button.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/plain', element.symbol); event.dataTransfer.effectAllowed = 'copy'; this.audio.drag(); });
        button.addEventListener('click', () => this.addAtom(element.symbol));
        ui.atomList.append(button);
      });
    }

    loadMission() {
      const target = this.target();
      this.clearCanvas(false);
      this.state.attempts = 0;
      this.state.remaining = Math.max(90, 180 - this.state.missionIndex * 6);
      ui.knowledge.hidden = true;
      ui.missionNumber.textContent = String(this.state.missionIndex + 1).padStart(2, '0');
      ui.ghost.dataset.formula = target.displayFormula;
      this.updateMissionPrompt();
      if (this.state.modalAction === 'start') {
        clearInterval(this.state.timerId);
        ui.time.textContent = this.state.remaining;
      } else {
        this.startTimer();
      }
      this.updateHud();
      this.updateAnalysis();
    }

    updateMissionPrompt() {
      const target = this.target();
      ui.area.classList.toggle('easy', this.state.mode === 'easy');
      if (this.state.mode === 'hard') {
        ui.missionPrompt.textContent = `สร้าง ${target.thaiName}`;
        ui.targetFormula.textContent = '';
      } else if (this.state.mode === 'expert') {
        ui.missionPrompt.textContent = 'สร้างสารตามสูตร';
        ui.targetFormula.textContent = target.displayFormula;
      } else {
        ui.missionPrompt.textContent = `สร้าง ${target.thaiName}`;
        ui.targetFormula.textContent = target.displayFormula;
      }
    }

    startTimer() {
      clearInterval(this.state.timerId);
      ui.time.textContent = this.state.remaining;
      this.state.timerId = setInterval(() => {
        this.state.remaining -= 1;
        ui.time.textContent = Math.max(0, this.state.remaining);
        ui.time.parentElement.classList.toggle('danger', this.state.remaining <= 20);
        if (this.state.remaining <= 0) {
          clearInterval(this.state.timerId);
          this.state.remaining = 0;
          this.setFeedback('หมดเวลาแล้ว แต่คุณยังทดลองต่อได้โดยไม่รับโบนัสเวลา', 'error');
        }
      }, 1000);
    }

    setMode(mode) {
      this.state.mode = mode;
      ui.modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
      this.updateMissionPrompt();
      this.audio.drag();
    }

    setBondType(type) {
      this.state.bondType = type;
      ui.bondButtons.forEach((button) => button.classList.toggle('active', button.dataset.bond === type));
      ui.selection.textContent = `เลือกอะตอม 2 ตัวเพื่อสร้างพันธะ${{ single: 'เดี่ยว', double: 'คู่', triple: 'สาม', ionic: 'ไอออนิก' }[type]}`;
      this.audio.drag();
    }

    areaPoint(clientX, clientY) {
      const rect = ui.area.getBoundingClientRect();
      return { x: Math.max(38, Math.min(rect.width - 38, clientX - rect.left)), y: Math.max(38, Math.min(rect.height - 38, clientY - rect.top)) };
    }

    addAtom(symbol, x, y) {
      const element = this.engine.getElement(symbol);
      if (!element) return;
      const count = this.state.atoms.length;
      const rect = ui.area.getBoundingClientRect();
      const angle = count * 2.1;
      const position = { x: x ?? rect.width / 2 + Math.cos(angle) * Math.min(125, 32 + count * 8), y: y ?? rect.height / 2 + Math.sin(angle) * Math.min(125, 32 + count * 8) };
      const atom = { id: `atom-${++this.state.atomSerial}`, symbol, x: Math.max(38, Math.min(rect.width - 38, position.x)), y: Math.max(38, Math.min(rect.height - 38, position.y)) };
      this.state.atoms.push(atom);
      this.createAtomNode(atom, element);
      this.audio.drag();
      this.updateAnalysis();
    }

    createAtomNode(atom, element) {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'canvas-atom';
      node.dataset.atomId = atom.id;
      node.style.left = `${atom.x}px`;
      node.style.top = `${atom.y}px`;
      node.style.setProperty('--atom-color', element.color);
      node.style.setProperty('--zoom', this.state.zoom);
      node.setAttribute('aria-label', `${element.thai} ${element.symbol} ใช้เวเลนซ์ 0 จาก ${element.valence}`);
      node.innerHTML = `<span>${element.symbol}</span><small class="atom-valence">0/${element.valence}</small>`;
      this.bindAtomPointer(node, atom);
      ui.area.append(node);
    }

    bindAtomPointer(node, atom) {
      node.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        node.setPointerCapture(event.pointerId);
        this.state.dragging = { atom, startX: event.clientX, startY: event.clientY, originX: atom.x, originY: atom.y, moved: false };
      });
      node.addEventListener('pointermove', (event) => {
        const drag = this.state.dragging;
        if (!drag || drag.atom.id !== atom.id) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.hypot(dx, dy) > 4) drag.moved = true;
        const rect = ui.area.getBoundingClientRect();
        atom.x = Math.max(35, Math.min(rect.width - 35, drag.originX + dx));
        atom.y = Math.max(35, Math.min(rect.height - 35, drag.originY + dy));
        node.style.left = `${atom.x}px`;
        node.style.top = `${atom.y}px`;
        this.renderBonds();
      });
      node.addEventListener('pointerup', () => {
        const drag = this.state.dragging;
        this.state.dragging = null;
        if (drag && !drag.moved) this.selectAtom(atom.id);
      });
    }

    selectAtom(atomId) {
      if (this.state.selected.includes(atomId)) {
        this.state.selected = this.state.selected.filter((id) => id !== atomId);
        this.renderSelection();
        return;
      }
      this.state.selected.push(atomId);
      if (this.state.selected.length === 2) this.createBond();
      this.renderSelection();
    }

    createBond() {
      const [firstId, secondId] = this.state.selected;
      const first = this.state.atoms.find((atom) => atom.id === firstId);
      const second = this.state.atoms.find((atom) => atom.id === secondId);
      const existingBond = this.state.bonds.find((bond) => (bond.a === firstId && bond.b === secondId) || (bond.a === secondId && bond.b === firstId));
      const bondsWithoutPair = existingBond ? this.state.bonds.filter((bond) => bond.id !== existingBond.id) : this.state.bonds;
      const check = this.engine.canCreateBond(first, second, this.state.bondType, bondsWithoutPair);
      if (!check.ok) {
        this.setFeedback(check.message, 'error');
        [firstId, secondId].forEach((id) => this.atomNode(id)?.classList.add('invalid'));
        setTimeout(() => [firstId, secondId].forEach((id) => this.atomNode(id)?.classList.remove('invalid')), 450);
        this.audio.error();
      } else {
        if (existingBond) existingBond.type = this.state.bondType;
        else this.state.bonds.push({ id: `bond-${Date.now()}-${this.state.bonds.length}`, a: firstId, b: secondId, type: this.state.bondType });
        this.setFeedback(`${existingBond ? 'เปลี่ยนเป็น' : 'สร้าง'}พันธะ${{ single: 'เดี่ยว', double: 'คู่', triple: 'สาม', ionic: 'ไอออนิก' }[this.state.bondType]}สำเร็จ`, '');
        this.audio.bond();
      }
      this.state.selected = [];
      this.updateAnalysis();
    }

    renderSelection() {
      document.querySelectorAll('.canvas-atom').forEach((node) => node.classList.toggle('selected', this.state.selected.includes(node.dataset.atomId)));
      ui.selection.textContent = this.state.selected.length ? `เลือกแล้ว ${this.state.selected.length}/2 อะตอม` : 'เลือกอะตอม 2 ตัวเพื่อสร้างพันธะ';
    }

    deleteSelected() {
      if (!this.state.selected.length) {
        this.setFeedback('เลือกอะตอมที่ต้องการลบก่อน', 'error');
        return;
      }
      const selectedSet = new Set(this.state.selected);
      this.state.atoms = this.state.atoms.filter((atom) => !selectedSet.has(atom.id));
      this.state.bonds = this.state.bonds.filter((bond) => !selectedSet.has(bond.a) && !selectedSet.has(bond.b));
      this.state.selected.forEach((id) => this.atomNode(id)?.remove());
      this.state.selected = [];
      this.updateAnalysis();
      this.audio.drag();
    }

    clearCanvas(update = true) {
      this.state.atoms = [];
      this.state.bonds = [];
      this.state.selected = [];
      ui.area.querySelectorAll('.canvas-atom').forEach((node) => node.remove());
      ui.bondLayer.innerHTML = '';
      if (update) {
        this.setFeedback('ล้างพื้นที่ทดลองแล้ว เริ่มสร้างโครงสร้างใหม่ได้เลย', '');
        this.updateAnalysis();
      }
    }

    atomNode(id) { return ui.area.querySelector(`[data-atom-id="${id}"]`); }

    renderBonds() {
      ui.bondLayer.innerHTML = '';
      this.state.bonds.forEach((bond) => {
        const first = this.state.atoms.find((atom) => atom.id === bond.a);
        const second = this.state.atoms.find((atom) => atom.id === bond.b);
        if (!first || !second) return;
        const count = { single: 1, double: 2, triple: 3, ionic: 1 }[bond.type];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const length = Math.hypot(dx, dy) || 1;
        const perpendicularX = -dy / length;
        const perpendicularY = dx / length;
        for (let index = 0; index < count; index += 1) {
          const offset = (index - (count - 1) / 2) * 8;
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', first.x + perpendicularX * offset);
          line.setAttribute('y1', first.y + perpendicularY * offset);
          line.setAttribute('x2', second.x + perpendicularX * offset);
          line.setAttribute('y2', second.y + perpendicularY * offset);
          line.setAttribute('class', `bond-line ${bond.type === 'ionic' ? 'ionic' : ''}`);
          ui.bondLayer.append(line);
        }
      });
    }

    updateAnalysis() {
      const counts = this.engine.atomCounts(this.state.atoms);
      ui.formula.textContent = this.engine.formatFormula(counts, this.target().atomOrder);
      ui.atomCount.textContent = this.state.atoms.length;
      ui.bondCount.textContent = this.state.bonds.length;
      const types = [...new Set(this.state.bonds.map((bond) => ({ single: 'เดี่ยว', double: 'คู่', triple: 'สาม', ionic: 'ไอออนิก' })[bond.type]))];
      ui.bondType.textContent = types.join(', ') || '—';
      const invalidAtoms = this.state.atoms.filter((atom) => this.engine.valenceUsed(atom.id, this.state.bonds) > this.engine.getElement(atom.symbol).valence);
      ui.valence.textContent = invalidAtoms.length ? 'เกินเวเลนซ์' : this.state.atoms.length ? 'ไม่เกินเวเลนซ์' : 'พร้อมเริ่ม';
      ui.status.textContent = invalidAtoms.length ? 'ต้องแก้ไข' : 'กำลังสร้าง';
      ui.status.className = `status-chip ${invalidAtoms.length ? 'error' : ''}`;
      ui.empty.hidden = this.state.atoms.length > 0;
      this.state.atoms.forEach((atom) => {
        const element = this.engine.getElement(atom.symbol);
        const used = this.engine.valenceUsed(atom.id, this.state.bonds);
        const node = this.atomNode(atom.id);
        if (node) {
          node.querySelector('.atom-valence').textContent = `${used}/${element.valence}`;
          node.setAttribute('aria-label', `${element.thai} ${element.symbol} ใช้เวเลนซ์ ${used} จาก ${element.valence}`);
        }
      });
      this.renderBonds();
      this.renderSelection();
    }

    checkMolecule() {
      if (!this.state.atoms.length) {
        this.setFeedback('เพิ่มอะตอมลงในพื้นที่ทดลองก่อนวิเคราะห์', 'error');
        this.audio.error();
        return;
      }
      this.state.attempts += 1;
      const result = this.engine.validate(this.state.atoms, this.state.bonds, this.target());
      if (result.ok) this.completeMission(); else {
        let message = result.message;
        if (this.state.attempts >= 3) message += ` · คำใบ้: ${this.target().hint[Math.min(this.state.attempts - 3, this.target().hint.length - 1)]}`;
        this.setFeedback(message, 'error');
        ui.status.textContent = 'ยังไม่ถูก';
        ui.status.className = 'status-chip error';
        this.audio.error();
      }
    }

    completeMission() {
      clearInterval(this.state.timerId);
      const target = this.target();
      const timeBonus = this.state.remaining > 0 ? Math.min(100, this.state.remaining) : 0;
      const modeMultiplier = { easy: 1, normal: 1.15, hard: 1.35, expert: 1.55 }[this.state.mode];
      const gainedXp = Math.round((100 + timeBonus) * modeMultiplier);
      const gainedCoins = Math.round(40 * modeMultiplier);
      this.save.xp += gainedXp;
      this.save.coins += gainedCoins;
      if (!this.save.journal.includes(target.id)) this.save.journal.push(target.id);
      target.bonds.forEach(([, , , type]) => { if (!this.save.bondTypes.includes(type)) this.save.bondTypes.push(type); });
      const elapsed = Math.max(0, Math.max(90, 180 - this.state.missionIndex * 6) - this.state.remaining);
      this.save.bestTime = this.save.bestTime === null ? elapsed : Math.min(this.save.bestTime, elapsed);
      this.save.level = Math.max(this.save.level, Math.min(this.dataset.molecules.length, this.state.missionIndex + 2));
      this.writeSave();
      this.state.atoms.forEach((atom) => this.atomNode(atom.id)?.classList.add('discovered'));
      ui.bondLayer.querySelectorAll('.bond-line').forEach((line) => line.classList.add('active'));
      this.spawnParticles();
      this.showKnowledge(target);
      this.renderAchievements();
      this.renderJournal();
      this.updateHud();
      this.setFeedback(`สำเร็จ! ${target.thaiName} (${target.displayFormula}) ผ่านการตรวจสูตร เวเลนซ์ และพันธะ`, 'success');
      ui.status.textContent = 'โครงสร้างถูกต้อง';
      ui.status.className = 'status-chip valid';
      this.audio.success();
      const lastMission = this.state.missionIndex === this.dataset.molecules.length - 1;
      this.state.modalAction = lastMission ? 'restart' : 'next';
      this.showModal('MOLECULE DISCOVERED', lastMission ? 'คุณเป็น Master Chemist แล้ว!' : `ค้นพบ ${target.thaiName}!`, `${target.description} บันทึกข้อมูลนี้ลง Chemical Journal แล้ว`, '✨', lastMission ? 'เริ่มชุดภารกิจใหม่' : 'ภารกิจถัดไป', true, `<span class="reward-chip">+${gainedXp} XP</span><span class="reward-chip">+${gainedCoins} Coins</span><span class="reward-chip">${target.displayFormula}</span>`);
    }

    showKnowledge(target) {
      ui.knowledge.hidden = false;
      ui.moleculeBadge.textContent = target.displayFormula;
      ui.knowledgeName.textContent = `${target.thaiName} · ${target.name}`;
      ui.knowledgeDescription.textContent = target.description;
      ui.knowledgeState.textContent = target.state;
      ui.knowledgeBoiling.textContent = target.boiling;
      ui.knowledgeMelting.textContent = target.melting;
      ui.knowledgeBond.textContent = target.bondType;
      ui.knowledgeUse.textContent = target.use;
    }

    showHint() {
      const hints = this.target().hint;
      const index = Math.min(Math.floor(this.state.attempts / 2), hints.length - 1);
      this.setFeedback(`คำใบ้: ${hints[index]}`, '');
      this.audio.bonus();
    }

    setZoom(value) {
      this.state.zoom = Math.max(.7, Math.min(1.4, Number(value.toFixed(1))));
      ui.zoomLabel.textContent = `${Math.round(this.state.zoom * 100)}%`;
      this.state.atoms.forEach((atom) => this.atomNode(atom.id)?.style.setProperty('--zoom', this.state.zoom));
    }

    spawnParticles() {
      ui.particles.innerHTML = '';
      for (let index = 0; index < 20; index += 1) {
        const spark = document.createElement('i');
        spark.className = 'spark';
        spark.style.left = `${45 + Math.random() * 10}%`;
        spark.style.top = `${45 + Math.random() * 10}%`;
        spark.style.setProperty('--spark-x', `${(Math.random() - .5) * 420}px`);
        spark.style.setProperty('--spark-y', `${(Math.random() - .5) * 300}px`);
        ui.particles.append(spark);
      }
    }

    achievementData() {
      return [
        { name: 'First Molecule', icon: '🧪', unlocked: this.save.journal.length >= 1 },
        { name: 'Water Master', icon: '💧', unlocked: this.save.journal.includes('water') },
        { name: 'Organic Explorer', icon: '🌿', unlocked: this.save.journal.includes('methane') || this.save.journal.includes('glucose') },
        { name: 'Bond Expert', icon: '🔗', unlocked: ['single', 'double', 'triple', 'ionic'].every((type) => this.save.bondTypes.includes(type)) },
        { name: 'Periodic Genius', icon: '⚛️', unlocked: this.save.journal.length >= 8 },
        { name: 'Master Chemist', icon: '🏆', unlocked: this.save.journal.length >= this.dataset.molecules.length }
      ];
    }

    renderAchievements() {
      const achievements = this.achievementData();
      this.save.achievements = achievements.filter((item) => item.unlocked).map((item) => item.name);
      this.writeSave();
      ui.achievements.innerHTML = achievements.map((item) => `<span class="achievement ${item.unlocked ? 'unlocked' : ''}">${item.icon} ${item.name}</span>`).join('');
    }

    renderJournal() {
      ui.journalGrid.innerHTML = this.dataset.molecules.map((molecule) => {
        const unlocked = this.save.journal.includes(molecule.id);
        return `<article class="journal-entry ${unlocked ? '' : 'locked'}"><b>${unlocked ? molecule.displayFormula : '???'}</b><strong>${unlocked ? `${molecule.thaiName} · ${molecule.name}` : 'ยังไม่ค้นพบ'}</strong><p>${unlocked ? `${molecule.state} · ${molecule.bondType}<br>${molecule.use}` : 'ทำภารกิจเพื่อบันทึกข้อมูลลงสมุด'}</p></article>`;
      }).join('');
    }

    openJournal() { this.renderJournal(); ui.journalModal.classList.add('visible'); }
    updateHud() { ui.level.textContent = this.save.level; ui.xp.textContent = this.save.xp; ui.coins.textContent = this.save.coins; ui.mission.textContent = `${this.state.missionIndex + 1}/${this.dataset.molecules.length}`; }
    setFeedback(message, type) { ui.feedback.textContent = message; ui.feedback.className = `feedback ${type}`; }

    showModal(kicker, title, message, icon, primary, journal, rewards) {
      ui.modalKicker.textContent = kicker;
      ui.modalTitle.textContent = title;
      ui.modalMessage.textContent = message;
      ui.modalIcon.textContent = icon;
      ui.modalPrimary.textContent = primary;
      ui.modalSecondary.hidden = !journal;
      ui.modalRewards.hidden = !rewards;
      ui.modalRewards.innerHTML = rewards;
      ui.modal.classList.add('visible');
    }

    modalPrimary() {
      this.audio.prepare();
      this.audio.drag();
      ui.modal.classList.remove('visible');
      if (this.state.modalAction === 'next') this.state.missionIndex += 1;
      if (this.state.modalAction === 'restart') this.state.missionIndex = 0;
      if (this.state.modalAction === 'next' || this.state.modalAction === 'restart') this.loadMission();
      if (this.state.modalAction === 'start') {
        this.save.gamesPlayed += 1;
        this.writeSave();
        this.startTimer();
      }
      this.state.modalAction = 'playing';
    }
  }

  async function loadDataset() {
    try {
      const response = await fetch('molecules.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (fetchError) {
      return await new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.overrideMimeType('application/json');
        request.open('GET', 'molecules.json', true);
        request.onload = () => {
          try { resolve(JSON.parse(request.responseText)); } catch (parseError) { reject(parseError); }
        };
        request.onerror = () => reject(fetchError);
        request.send();
      });
    }
  }

  loadDataset()
    .then((dataset) => new MoleculeGame(dataset))
    .catch(() => {
      ui.modalTitle.textContent = 'ไม่สามารถอ่านข้อมูลโมเลกุล';
      ui.modalMessage.textContent = 'กรุณาเปิดเกมผ่านเว็บไซต์ ClassKru เพื่อให้เบราว์เซอร์สามารถโหลด molecules.json ได้อย่างปลอดภัย';
      ui.modalPrimary.hidden = true;
    });
})();
