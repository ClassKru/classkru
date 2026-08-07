/* =========================================
   MOLECULE BUILDER — CHEMISTRY ENGINE
   ========================================= */
(() => {
  'use strict';

  class ChemistryEngine {
    constructor(dataset) {
      this.elements = new Map(dataset.elements.map((element) => [element.symbol, element]));
      this.molecules = dataset.molecules;
    }

    getElement(symbol) {
      return this.elements.get(symbol);
    }

    bondOrder(type) {
      return { single: 1, double: 2, triple: 3, ionic: 0 }[type] ?? 1;
    }

    atomCounts(atoms) {
      return atoms.reduce((counts, atom) => {
        counts[atom.symbol] = (counts[atom.symbol] || 0) + 1;
        return counts;
      }, {});
    }

    formatFormula(counts, preferredOrder = []) {
      const symbols = [...new Set([...preferredOrder, ...Object.keys(counts).sort()])];
      return symbols
        .filter((symbol) => counts[symbol])
        .map((symbol) => `${symbol}${counts[symbol] > 1 ? this.toSubscript(counts[symbol]) : ''}`)
        .join('') || '—';
    }

    toSubscript(value) {
      const digits = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
      return String(value).split('').map((digit) => digits[digit]).join('');
    }

    valenceUsed(atomId, bonds) {
      return bonds.reduce((total, bond) => {
        if (bond.a !== atomId && bond.b !== atomId) return total;
        return total + this.bondOrder(bond.type);
      }, 0);
    }

    canCreateBond(atomA, atomB, type, bonds) {
      if (!atomA || !atomB || atomA.id === atomB.id) return { ok: false, message: 'ต้องเลือกอะตอมคนละตัว' };
      if (bonds.some((bond) => (bond.a === atomA.id && bond.b === atomB.id) || (bond.a === atomB.id && bond.b === atomA.id))) {
        return { ok: false, message: 'อะตอมคู่นี้มีพันธะอยู่แล้ว ลบก่อนเปลี่ยนชนิดพันธะ' };
      }
      const elementA = this.getElement(atomA.symbol);
      const elementB = this.getElement(atomB.symbol);
      if (type === 'ionic') {
        const metalAndNonmetal = (elementA.metal && !elementB.metal) || (!elementA.metal && elementB.metal);
        const polyatomicIonLink = [atomA.symbol, atomB.symbol].sort().join('-') === 'N-O';
        return metalAndNonmetal || polyatomicIonLink ? { ok: true } : { ok: false, message: 'พันธะไอออนิกต้องเชื่อมไอออนต่างประจุ เช่น โลหะ–อโลหะ หรือหมู่ไอออนที่เหมาะสม' };
      }
      const order = this.bondOrder(type);
      if (this.valenceUsed(atomA.id, bonds) + order > elementA.valence) return { ok: false, message: `${atomA.symbol} จะมีพันธะเกินเวเลนซ์ ${elementA.valence}` };
      if (this.valenceUsed(atomB.id, bonds) + order > elementB.valence) return { ok: false, message: `${atomB.symbol} จะมีพันธะเกินเวเลนซ์ ${elementB.valence}` };
      return { ok: true };
    }

    validate(atoms, bonds, target) {
      const actualCounts = this.atomCounts(atoms);
      const expectedCounts = target.atoms;
      const allSymbols = new Set([...Object.keys(actualCounts), ...Object.keys(expectedCounts)]);
      const countErrors = [...allSymbols].filter((symbol) => (actualCounts[symbol] || 0) !== (expectedCounts[symbol] || 0));
      if (countErrors.length) return { ok: false, code: 'atom-count', message: 'จำนวนหรือชนิดของอะตอมยังไม่ตรงกับภารกิจ', detail: countErrors };

      const overValence = atoms.filter((atom) => this.valenceUsed(atom.id, bonds) > this.getElement(atom.symbol).valence);
      if (overValence.length) return { ok: false, code: 'valence', message: 'มีอะตอมที่สร้างพันธะเกินเวเลนซ์', detail: overValence.map((atom) => atom.symbol) };
      if (!this.isConnected(atoms, bonds)) return { ok: false, code: 'connected', message: 'อะตอมบางส่วนยังไม่ได้เชื่อมเป็นโครงสร้างเดียวกัน', detail: [] };

      const actualBonds = this.bondSignatures(atoms, bonds);
      const expectedBonds = this.expectedBondSignatures(target.bonds);
      const bondTypesMatch = actualBonds.size === expectedBonds.size && [...expectedBonds].every(([signature, count]) => actualBonds.get(signature) === count);
      if (!bondTypesMatch) return { ok: false, code: 'bonds', message: 'จำนวนหรือชนิดของพันธะยังไม่ตรงกับโครงสร้างที่เสถียร', detail: [] };
      return { ok: true, code: 'success', message: 'โครงสร้างผ่านการตรวจสอบทางเคมี' };
    }

    isConnected(atoms, bonds) {
      if (!atoms.length) return false;
      const visited = new Set([atoms[0].id]);
      const queue = [atoms[0].id];
      while (queue.length) {
        const current = queue.shift();
        bonds.forEach((bond) => {
          const next = bond.a === current ? bond.b : bond.b === current ? bond.a : null;
          if (next && !visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        });
      }
      return visited.size === atoms.length;
    }

    bondSignatures(atoms, bonds) {
      const atomMap = new Map(atoms.map((atom) => [atom.id, atom.symbol]));
      const signatures = new Map();
      bonds.forEach((bond) => {
        const pair = [atomMap.get(bond.a), atomMap.get(bond.b)].sort().join('-');
        const signature = `${pair}:${bond.type}`;
        signatures.set(signature, (signatures.get(signature) || 0) + 1);
      });
      return signatures;
    }

    expectedBondSignatures(bonds) {
      const signatures = new Map();
      bonds.forEach(([first, second, , type]) => {
        const signature = `${[first, second].sort().join('-')}:${type}`;
        signatures.set(signature, (signatures.get(signature) || 0) + 1);
      });
      return signatures;
    }
  }

  window.ChemistryEngine = ChemistryEngine;
})();
