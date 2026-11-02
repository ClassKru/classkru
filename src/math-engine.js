// Extracted from the existing Math Wizard question adapter; no renderer dependencies.
const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (items) => items[random(0, items.length - 1)];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = random(0, i);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function makeOptions(answer, formatter = (value) => String(value), distance = 4) {
  const choices = new Set([formatter(answer)]);
  let guard = 0;
  while (choices.size < 4 && guard < 100) {
    const delta = random(-distance, distance);
    if (delta) choices.add(formatter(answer + delta));
    guard += 1;
  }
  let fallback = 1;
  while (choices.size < 4) {
    choices.add(formatter(answer + distance + fallback));
    fallback += 1;
  }
  return shuffle([...choices]);
}

function makeEasyQuestion() {
  const addition = Math.random() > 0.48;
  let a;
  let b;
  if (addition) {
    a = random(1, 15);
    b = random(1, 20 - a);
  } else {
    a = random(2, 20);
    b = random(1, a - 1);
  }
  const answer = addition ? a + b : a - b;
  return { text: a + ' ' + (addition ? '+' : '−') + ' ' + b + ' = ?', answer: String(answer), choices: makeOptions(answer) };
}

function makeMediumQuestion() {
  if (Math.random() > 0.46) {
    const a = random(2, 12);
    const b = random(2, 12);
    const answer = a * b;
    return { text: a + ' × ' + b + ' = ?', answer: String(answer), choices: makeOptions(answer, String, 12) };
  }
  const divisor = random(2, 12);
  const answer = random(2, 12);
  return { text: (divisor * answer) + ' ÷ ' + divisor + ' = ?', answer: String(answer), choices: makeOptions(answer, String, 5) };
}

function makeHardQuestion() {
  const version = random(0, 2);
  if (version === 0) {
    const a = random(2, 9);
    const b = random(2, 8);
    const c = random(2, 6);
    const answer = (a + b) * c;
    return { text: '(' + a + ' + ' + b + ') × ' + c + ' = ?', answer: String(answer), choices: makeOptions(answer, String, 10) };
  }
  if (version === 1) {
    const denominator = pick([2, 3, 4, 5, 6, 8]);
    const a = random(1, denominator - 1);
    const b = random(1, denominator - 1);
    const numerator = a + b;
    const divisor = gcd(numerator, denominator);
    const n = numerator / divisor;
    const d = denominator / divisor;
    const answer = d === 1 ? String(n) : n + '/' + d;
    const choices = new Set([answer]);
    while (choices.size < 4) {
      const wrongN = Math.max(1, n + pick([-2, -1, 1, 2]));
      const wrongD = Math.max(2, d + pick([-1, 1, 2]));
      if (wrongN * d !== n * wrongD) choices.add(wrongN + '/' + wrongD);
    }
    return { text: a + '/' + denominator + ' + ' + b + '/' + denominator + ' = ?', answer, choices: shuffle([...choices]) };
  }
  const a = random(11, 49) / 10;
  const b = random(11, 49) / 10;
  const answer = Math.round((a + b) * 10) / 10;
  return { text: a.toFixed(1) + ' + ' + b.toFixed(1) + ' = ?', answer: answer.toFixed(1), choices: makeOptions(answer, (value) => Number(value).toFixed(1), 1) };
}

export function createQuestion(difficulty = 'easy') {
  if (difficulty === 'medium') return makeMediumQuestion();
  if (difficulty === 'hard') return makeHardQuestion();
  return makeEasyQuestion();
}
