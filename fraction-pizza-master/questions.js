/* =========================================
   FRACTION PIZZA MASTER — QUESTION BANK
   All calculations use integers, not decimal equality.
   ========================================= */
(() => {
  'use strict';

  function greatestCommonDivisor(a, b) {
    let first = Math.abs(a);
    let second = Math.abs(b);
    while (second) [first, second] = [second, first % second];
    return first || 1;
  }

  function leastCommonMultiple(a, b) {
    return Math.abs(a * b) / greatestCommonDivisor(a, b);
  }

  function simplifyFraction(numerator, denominator) {
    if (!denominator) throw new Error('Denominator must not be zero');
    const sign = denominator < 0 ? -1 : 1;
    const divisor = greatestCommonDivisor(numerator, denominator);
    return { numerator: sign * numerator / divisor, denominator: Math.abs(denominator) / divisor };
  }

  function areFractionsEquivalent(first, second) {
    return first.numerator * second.denominator === second.numerator * first.denominator;
  }

  function compareFractions(first, second) {
    const left = first.numerator * second.denominator;
    const right = second.numerator * first.denominator;
    return left === right ? 0 : left > right ? 1 : -1;
  }

  function addFractions(first, second) {
    const denominator = leastCommonMultiple(first.denominator, second.denominator);
    return simplifyFraction(first.numerator * (denominator / first.denominator) + second.numerator * (denominator / second.denominator), denominator);
  }

  function convertImproperToMixedNumber(fraction) {
    const whole = Math.trunc(fraction.numerator / fraction.denominator);
    const remainder = Math.abs(fraction.numerator % fraction.denominator);
    const simplified = simplifyFraction(remainder, fraction.denominator);
    return { whole, numerator: remainder ? simplified.numerator : 0, denominator: simplified.denominator };
  }

  const buildSpecs = [[1,2],[1,3],[2,3],[1,4],[2,4],[3,4],[2,5],[3,5],[3,6],[5,6],[3,8],[5,8]];
  const readSpecs = [[1,2],[2,3],[1,4],[3,4],[2,5],[4,5],[3,6],[5,8],[7,10]];
  const equivalentSpecs = [
    [[1,2],[2,4],[[2,3],[3,4],[1,4]]], [[1,3],[2,6],[[2,3],[3,6],[1,2]]], [[2,3],[4,6],[[3,4],[2,6],[5,6]]],
    [[1,4],[2,8],[[2,4],[3,8],[1,8]]], [[2,5],[4,10],[[3,5],[2,10],[5,10]]], [[3,4],[6,8],[[4,8],[5,8],[7,8]]],
    [[3,5],[6,10],[[5,10],[7,10],[4,5]]], [[5,6],[10,12],[[8,12],[9,12],[11,12]]]
  ];
  const compareSpecs = [[[1,2],[1,3]],[[3,4],[5,8]],[[2,3],[3,5]],[[2,4],[1,2]],[[3,8],[1,2]],[[4,5],[7,10]],[[5,6],[7,8]],[[6,10],[3,5]],[[1,4],[2,3]]];

  const questions = [
    ...buildSpecs.map(([numerator, denominator], index) => ({ id:`build-${index + 1}`, category:'fraction-basic', difficulty: denominator <= 4 ? 1 : 2, type:'build-fraction', numerator, denominator, instruction:`เลือกพิซซ่าให้ได้ ${numerator}/${denominator}`, timeLimit:30, hint:`ตัวส่วน ${denominator} คือจำนวนชิ้นทั้งหมด ตัวเศษ ${numerator} คือจำนวนชิ้นที่ต้องเลือก`, explanation:`${numerator}/${denominator} หมายถึง แบ่งพิซซ่าเป็น ${denominator} ส่วนเท่า ๆ กัน แล้วเลือก ${numerator} ส่วน` })),
    ...readSpecs.map(([numerator, denominator], index) => ({ id:`read-${index + 1}`, category:'read-fraction', difficulty: denominator <= 4 ? 1 : 2, type:'read-fraction', numerator, denominator, instruction:'พิซซ่าที่ระบายสีแทนเศษส่วนใด', timeLimit:25, hint:`นับชิ้นที่ระบายสีก่อน แล้วนับชิ้นทั้งหมด`, explanation:`ระบายสี ${numerator} ชิ้น จากทั้งหมด ${denominator} ชิ้น จึงเขียนเป็น ${numerator}/${denominator}` })),
    ...equivalentSpecs.map(([source, answer, distractors], index) => ({ id:`equivalent-${index + 1}`, category:'equivalent-fraction', difficulty:index < 3 ? 1 : 2, type:'choose-equivalent', source:{numerator:source[0],denominator:source[1]}, answer:{numerator:answer[0],denominator:answer[1]}, options:[answer,...distractors].map(([numerator,denominator])=>({numerator,denominator})), instruction:`พิซซ่า ${source[0]}/${source[1]} เท่ากับข้อใด`, timeLimit:30, hint:'เศษส่วนที่เท่ากันต้องแทนพื้นที่เท่ากัน ลองคูณไขว้เพื่อตรวจสอบ', explanation:`${source[0]}/${source[1]} และ ${answer[0]}/${answer[1]} มีค่าเท่ากัน เพราะ ${source[0]} × ${answer[1]} = ${answer[0]} × ${source[1]}` })),
    ...compareSpecs.map(([left,right], index) => { const relation=compareFractions({numerator:left[0],denominator:left[1]},{numerator:right[0],denominator:right[1]}); const symbol=relation>0?'>':relation<0?'<':'='; return { id:`compare-${index + 1}`, category:'fraction-comparison', difficulty:index < 3 ? 1 : 2, type:'compare-fractions', left:{numerator:left[0],denominator:left[1]}, right:{numerator:right[0],denominator:right[1]}, answer:symbol, instruction:`เปรียบเทียบ ${left[0]}/${left[1]} กับ ${right[0]}/${right[1]}`, timeLimit:30, hint:'ลองดูพื้นที่พิซซ่าที่ถูกเลือก หรือใช้การคูณไขว้', explanation:`คูณไขว้ได้ ${left[0]} × ${right[1]} = ${left[0]*right[1]} และ ${right[0]} × ${left[1]} = ${right[0]*left[1]} ดังนั้น ${left[0]}/${left[1]} ${symbol} ${right[0]}/${right[1]}` }; })
  ];

  const lessons = [
    { id:'fraction-basic', icon:'🍕', title:'รู้จักเศษส่วน', description:'แตะเลือกชิ้นพิซซ่าตามตัวเศษและตัวส่วน', level:'เริ่มต้น' },
    { id:'read-fraction', icon:'👀', title:'อ่านเศษส่วนจากภาพ', description:'ดูพิซซ่าที่ระบายสีแล้วอ่านเป็นเศษส่วน', level:'เริ่มต้น' },
    { id:'equivalent-fraction', icon:'⚖️', title:'เศษส่วนที่เท่ากัน', description:'เปรียบเทียบพื้นที่ที่เท่ากันแม้แบ่งคนละจำนวน', level:'ปานกลาง' },
    { id:'fraction-comparison', icon:'🔍', title:'เปรียบเทียบเศษส่วน', description:'เลือกเครื่องหมายมากกว่า น้อยกว่า หรือเท่ากับ', level:'ปานกลาง' }
  ];

  function runFractionMathTests() {
    const checks = [
      areFractionsEquivalent({numerator:1,denominator:2},{numerator:2,denominator:4}),
      compareFractions({numerator:2,denominator:3},{numerator:3,denominator:5}) === 1,
      areFractionsEquivalent(addFractions({numerator:1,denominator:4},{numerator:2,denominator:4}),{numerator:3,denominator:4}),
      areFractionsEquivalent(addFractions({numerator:1,denominator:2},{numerator:1,denominator:4}),{numerator:3,denominator:4}),
      simplifyFraction(6,8).numerator === 3 && simplifyFraction(6,8).denominator === 4,
      convertImproperToMixedNumber({numerator:7,denominator:4}).whole === 1 && convertImproperToMixedNumber({numerator:7,denominator:4}).numerator === 3
    ];
    if (checks.some((check) => !check)) throw new Error('Fraction math self-test failed');
    return true;
  }

  window.FractionPizzaData = Object.freeze({ questions, lessons, greatestCommonDivisor, leastCommonMultiple, simplifyFraction, areFractionsEquivalent, compareFractions, addFractions, convertImproperToMixedNumber, runFractionMathTests });
})();
