/* =========================================
   FRACTION PIZZA MASTER — OFFLINE GAME ENGINE
   No localStorage, cookies, personal fields, or network result submission.
   ========================================= */
(() => {
  'use strict';

  const DATA = window.FractionPizzaData;
  const $ = (id) => document.getElementById(id);
  const ui = {
    screens: [...document.querySelectorAll('.screen')], hud: $('round-hud'), questionNumber: $('question-number'), score: $('score-value'), combo: $('combo-value'), timer: $('timer-value'),
    challenge: $('challenge-button'), practice: $('practice-button'), how: $('how-button'), lessonGrid: $('lesson-grid'), orderTitle: $('order-title'), orderSubtitle: $('order-subtitle'), orderLabel: $('order-label'), visual: $('visual-area'), answers: $('answer-area'), feedback: $('feedback'), feedbackIcon: $('feedback-icon'), feedbackText: $('feedback-text'),
    pause: $('pause-button'), clear: $('clear-button'), hint: $('hint-button'), submit: $('submit-button'), resultScore: $('result-score'), resultCorrect: $('result-correct'), resultAccuracy: $('result-accuracy'), resultTime: $('result-time'), resultStars: $('result-stars'), resultMedal: $('result-medal'), reviewBox: $('review-box'), replay: $('replay-button'), review: $('review-button'),
    sound: $('sound-button'), motion: $('motion-button'), text: $('text-button'), modal: $('modal'), modalIcon: $('modal-icon'), modalTitle: $('modal-title'), modalContent: $('modal-content'), modalPrimary: $('modal-primary'), modalSecondary: $('modal-secondary')
  };

  const GAME_STATES = Object.freeze({ HOME:'HOME', LESSONS:'LESSON_SELECTION', PLAYING:'PLAYING', FEEDBACK:'ANSWER_FEEDBACK', PAUSED:'PAUSED', COMPLETE:'GAME_COMPLETE', ERROR:'ERROR' });

  class SoundEngine {
    constructor() { this.context = null; this.enabled = true; }
    prepare() { if (!this.enabled || this.context) return; const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (AudioContextClass) this.context = new AudioContextClass(); }
    tone(frequency, duration, type = 'sine', volume = .035, end = frequency) { if (!this.enabled) return; this.prepare(); if (!this.context) return; if (this.context.state === 'suspended') this.context.resume(); const now = this.context.currentTime; const oscillator = this.context.createOscillator(); const gain = this.context.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+duration); gain.gain.setValueAtTime(.001,now); gain.gain.exponentialRampToValueAtTime(volume,now+.015); gain.gain.exponentialRampToValueAtTime(.001,now+duration); oscillator.connect(gain).connect(this.context.destination); oscillator.start(now); oscillator.stop(now+duration+.02); }
    select() { this.tone(390,.06,'triangle',.025,480); }
    correct() { [523,659,784].forEach((frequency,index)=>setTimeout(()=>this.tone(frequency,.17,'triangle',.045),index*85)); }
    gentleWrong() { this.tone(260,.2,'sine',.035,190); }
    combo() { [660,880,1100].forEach((frequency,index)=>setTimeout(()=>this.tone(frequency,.12,'sine',.04),index*55)); }
    finish() { [523,659,784,1047].forEach((frequency,index)=>setTimeout(()=>this.tone(frequency,.2,'triangle',.05),index*95)); }
  }

  class FractionPizzaGame {
    constructor() {
      this.audio = new SoundEngine();
      this.state = GAME_STATES.HOME;
      this.mode = 'challenge';
      this.category = null;
      this.round = [];
      this.index = 0;
      this.score = 0;
      this.combo = 0;
      this.correct = 0;
      this.wrong = 0;
      this.currentAttempts = 0;
      this.hintUsed = false;
      this.selectedSlices = new Set();
      this.selectedAnswer = null;
      this.history = [];
      this.timerId = null;
      this.remaining = 0;
      this.roundStartedAt = 0;
      this.awaitingNext = false;
      this.motionEnabled = true;
      this.largeText = false;
      this.modalAction = 'close';
      this.bind();
      this.renderLessons();
      this.initializeGame();
    }

    initializeGame() {
      try {
        DATA.runFractionMathTests();
        this.goTo('home');
      } catch {
        this.state = GAME_STATES.ERROR;
        this.showModal('⚠️','ไม่สามารถเริ่มเกม','การตรวจสอบคณิตศาสตร์ภายในไม่ผ่าน กรุณารีเฟรชหน้าอีกครั้ง','close');
      }
    }

    bind() {
      ui.challenge.addEventListener('click',()=>this.startGame('challenge'));
      ui.practice.addEventListener('click',()=>this.goTo('lessons'));
      ui.how.addEventListener('click',()=>this.showHowTo());
      document.querySelectorAll('[data-go="home"]').forEach(button=>button.addEventListener('click',()=>this.goTo('home')));
      ui.clear.addEventListener('click',()=>this.clearSelection());
      ui.hint.addEventListener('click',()=>this.showHint());
      ui.submit.addEventListener('click',()=>this.submitAnswer());
      ui.pause.addEventListener('click',()=>this.pauseGame());
      ui.replay.addEventListener('click',()=>this.startGame(this.mode,this.category));
      ui.review.addEventListener('click',()=>ui.reviewBox.classList.toggle('visible'));
      ui.sound.addEventListener('click',()=>this.toggleSound());
      ui.motion.addEventListener('click',()=>this.toggleMotion());
      ui.text.addEventListener('click',()=>this.toggleTextSize());
      ui.modalPrimary.addEventListener('click',()=>this.handleModalPrimary());
      ui.modalSecondary.addEventListener('click',()=>this.exitRound());
      document.addEventListener('keydown',event=>{ if(event.key==='Escape'&&this.state===GAME_STATES.PLAYING)this.pauseGame(); });
    }

    renderLessons() {
      ui.lessonGrid.innerHTML='';
      DATA.lessons.forEach(lesson=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='lesson-card';
        button.innerHTML=`<span class="lesson-icon">${lesson.icon}</span><span><h3>${lesson.title}</h3><p>${lesson.description}</p></span><small>${lesson.level}</small>`;
        button.addEventListener('click',()=>this.startGame('practice',lesson.id));
        ui.lessonGrid.append(button);
      });
    }

    goTo(name) {
      const screenId=`screen-${name}`;
      ui.screens.forEach(screen=>screen.classList.toggle('active',screen.id===screenId));
      ui.hud.hidden=name!=='game';
      if(name==='home')this.state=GAME_STATES.HOME;
      if(name==='lessons')this.state=GAME_STATES.LESSONS;
      if(name==='result')this.state=GAME_STATES.COMPLETE;
      window.scrollTo({top:0,behavior:this.motionEnabled?'smooth':'auto'});
    }

    startGame(mode,category=null) {
      this.audio.prepare();
      this.audio.select();
      this.mode=mode;
      this.category=category;
      this.round=this.createRound(mode,category);
      if(!this.round.length){this.showModal('⚠️','ไม่พบโจทย์','ยังไม่มีโจทย์ในหัวข้อนี้ กรุณาเลือกหัวข้ออื่น','close');return;}
      this.index=0;this.score=0;this.combo=0;this.correct=0;this.wrong=0;this.history=[];this.roundStartedAt=performance.now();
      this.goTo('game');
      this.state=GAME_STATES.PLAYING;
      this.loadQuestion();
    }

    createRound(mode,category) {
      if(mode==='practice')return this.shuffle(DATA.questions.filter(question=>question.category===category)).slice(0,10);
      const byType=type=>this.shuffle(DATA.questions.filter(question=>question.type===type));
      return this.shuffle([...byType('build-fraction').slice(0,3),...byType('read-fraction').slice(0,2),...byType('choose-equivalent').slice(0,3),...byType('compare-fractions').slice(0,2)]);
    }

    shuffle(items) {
      const copy=[...items];
      for(let index=copy.length-1;index>0;index-=1){const other=Math.floor(Math.random()*(index+1));[copy[index],copy[other]]=[copy[other],copy[index]];}
      return copy;
    }

    currentQuestion(){return this.round[this.index];}

    loadQuestion() {
      clearInterval(this.timerId);
      this.state=GAME_STATES.PLAYING;
      this.currentAttempts=0;this.hintUsed=false;this.selectedSlices=new Set();this.selectedAnswer=null;this.awaitingNext=false;
      const question=this.currentQuestion();
      ui.questionNumber.textContent=`${this.index+1}/${this.round.length}`;
      ui.score.textContent=this.score.toLocaleString('th-TH');
      ui.combo.textContent=this.combo;
      ui.orderLabel.textContent=this.mode==='practice'?'ออเดอร์ฝึกซ้อม':'ออเดอร์ของลูกค้า';
      ui.orderTitle.textContent=question.instruction;
      ui.orderSubtitle.textContent=this.instructionFor(question.type);
      ui.submit.textContent='ส่งออเดอร์ 🍽️';ui.submit.disabled=false;
      ui.clear.disabled=false;ui.hint.disabled=false;
      this.setFeedback('👨‍🍳','อ่านออเดอร์ แล้วเริ่มทำพิซซ่าได้เลย','');
      this.renderQuestion(question);
      ui.timer.parentElement.classList.remove('timer-danger');
      if(this.mode==='challenge'){this.remaining=question.timeLimit;this.startTimer();}else{this.remaining=0;ui.timer.textContent='∞';}
    }

    instructionFor(type) {
      return { 'build-fraction':'แตะชิ้นพิซซ่าตามจำนวนที่ลูกค้าต้องการ','read-fraction':'ดูส่วนที่ระบายสี แล้วเลือกเศษส่วนให้ตรงกับภาพ','choose-equivalent':'เลือกถาดที่มีปริมาณเท่ากับถาดตัวอย่าง','compare-fractions':'เลือกเครื่องหมายที่ทำให้ประโยคถูกต้อง' }[type];
    }

    startTimer() {
      clearInterval(this.timerId);ui.timer.textContent=this.remaining;
      this.timerId=setInterval(()=>{this.remaining-=1;ui.timer.textContent=Math.max(0,this.remaining);ui.timer.parentElement.classList.toggle('timer-danger',this.remaining<=5);if(this.remaining<=0){clearInterval(this.timerId);this.handleTimeUp();}},1000);
    }

    handleTimeUp() {
      if(this.state!==GAME_STATES.PLAYING)return;
      this.currentAttempts=Math.max(this.currentAttempts,2);
      this.combo=0;this.wrong+=1;
      this.finishCurrent(false,'หมดเวลาแล้ว มาดูคำอธิบายและลองออเดอร์ถัดไปกัน');
    }

    renderQuestion(question) {
      ui.visual.innerHTML='';ui.answers.innerHTML='';
      if(question.type==='build-fraction'){
        ui.visual.append(this.createPizza(question.denominator,0,true,'พิซซ่าสำหรับเลือก'));
      } else if(question.type==='read-fraction'){
        ui.visual.append(this.createPizza(question.denominator,question.numerator,false,'พิซซ่าตัวอย่าง'));
        this.renderFractionChoices(question);
      } else if(question.type==='choose-equivalent'){
        ui.visual.append(this.createPizza(question.source.denominator,question.source.numerator,false,`ถาดตัวอย่าง ${question.source.numerator}/${question.source.denominator}`));
        const optionWrap=document.createElement('div');optionWrap.className='answer-area';
        this.shuffle(question.options).forEach(option=>{const key=`${option.numerator}/${option.denominator}`;const button=document.createElement('button');button.type='button';button.className='pizza-option';button.dataset.answer=key;button.setAttribute('aria-label',`เลือกพิซซ่า ${key}`);button.append(this.createPizza(option.denominator,option.numerator,false,key,true));button.addEventListener('click',()=>this.chooseAnswer(key,button,'.pizza-option'));optionWrap.append(button);});
        ui.answers.append(optionWrap);
      } else if(question.type==='compare-fractions'){
        ui.visual.append(this.createPizza(question.left.denominator,question.left.numerator,false,`${question.left.numerator}/${question.left.denominator}`));
        const versus=document.createElement('strong');versus.textContent='กับ';versus.className='versus';ui.visual.append(versus);
        ui.visual.append(this.createPizza(question.right.denominator,question.right.numerator,false,`${question.right.numerator}/${question.right.denominator}`));
        const symbols=document.createElement('div');symbols.className='answer-area comparison-symbols';['>','<','='].forEach(symbol=>{const button=document.createElement('button');button.type='button';button.className='answer-choice';button.textContent=symbol;button.setAttribute('aria-label',symbol==='>'?'มากกว่า':symbol==='<'?'น้อยกว่า':'เท่ากับ');button.addEventListener('click',()=>this.chooseAnswer(symbol,button,'.answer-choice'));symbols.append(button);});ui.answers.append(symbols);
      }
    }

    createPizza(denominator,selectedCount=0,interactive=false,title='',compact=false) {
      const wrap=document.createElement('div');wrap.className='pizza-wrap';
      if(title){const heading=document.createElement('h3');heading.textContent=title;wrap.append(heading);}
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 200 200');svg.setAttribute('class','pizza-svg');svg.setAttribute('role','group');svg.setAttribute('aria-label',`พิซซ่าแบ่ง ${denominator} ชิ้น${selectedCount?` ระบายสี ${selectedCount} ชิ้น`:''}`);
      const radius=86;const center=100;const step=Math.PI*2/denominator;
      for(let index=0;index<denominator;index+=1){const start=-Math.PI/2+index*step;const end=start+step;const x1=center+radius*Math.cos(start);const y1=center+radius*Math.sin(start);const x2=center+radius*Math.cos(end);const y2=center+radius*Math.sin(end);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${step>Math.PI?1:0} 1 ${x2} ${y2} Z`);path.setAttribute('class',`pizza-slice ${index<selectedCount?'locked-selected':''}`);path.dataset.slice=String(index);if(interactive){path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',`ชิ้นที่ ${index+1} จาก ${denominator}`);path.addEventListener('click',()=>this.selectPizzaSlice(index,path));path.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.selectPizzaSlice(index,path);}});}svg.append(path);}
      const crust=document.createElementNS('http://www.w3.org/2000/svg','circle');crust.setAttribute('cx','100');crust.setAttribute('cy','100');crust.setAttribute('r','88');crust.setAttribute('class','pizza-crust');svg.append(crust);
      const centerCircle=document.createElementNS('http://www.w3.org/2000/svg','circle');centerCircle.setAttribute('cx','100');centerCircle.setAttribute('cy','100');centerCircle.setAttribute('r','7');centerCircle.setAttribute('class','pizza-center');svg.append(centerCircle);
      [[70,65],[127,63],[64,125],[133,128],[101,88],[103,143]].forEach(([cx,cy])=>{const topping=document.createElementNS('http://www.w3.org/2000/svg','circle');topping.setAttribute('cx',cx);topping.setAttribute('cy',cy);topping.setAttribute('r','6');topping.setAttribute('class','pizza-topping');svg.append(topping);});
      wrap.append(svg);
      if(!interactive&&title&&!compact){const label=document.createElement('span');label.className='fraction-label';label.textContent=`${selectedCount}/${denominator}`;wrap.append(label);}
      return wrap;
    }

    renderFractionChoices(question) {
      const correct={numerator:question.numerator,denominator:question.denominator};
      const correctKey=`${correct.numerator}/${correct.denominator}`;
      const distractors=[];
      const keys=new Set([correctKey]);
      const denominators=[question.denominator,2,3,4,5,6,8,10,12];
      denominators.forEach(denominator=>{
        for(let numerator=1;numerator<=denominator;numerator+=1){
          const key=`${numerator}/${denominator}`;
          if(!keys.has(key)&&!FractionPizzaData.areFractionsEquivalent(correct,{numerator,denominator})){
            keys.add(key);distractors.push({numerator,denominator});
          }
        }
      });
      const choices=[correct,...this.shuffle(distractors).slice(0,3)];
      this.shuffle(choices).forEach(fraction=>{const key=`${fraction.numerator}/${fraction.denominator}`;const button=document.createElement('button');button.type='button';button.className='answer-choice';button.innerHTML=`<span class="fraction-stack"><span>${fraction.numerator}</span><span>${fraction.denominator}</span></span>`;button.setAttribute('aria-label',`เศษ ${fraction.numerator} ส่วน ${fraction.denominator}`);button.addEventListener('click',()=>this.chooseAnswer(key,button,'.answer-choice'));ui.answers.append(button);});
    }

    selectPizzaSlice(index,path) {
      if(this.state!==GAME_STATES.PLAYING||this.awaitingNext)return;
      if(this.selectedSlices.has(index)){this.selectedSlices.delete(index);path.classList.remove('selected');path.setAttribute('aria-pressed','false');}else{this.selectedSlices.add(index);path.classList.add('selected');path.setAttribute('aria-pressed','true');}
      this.audio.select();
      this.setFeedback('🍕',`เลือกแล้ว ${this.selectedSlices.size} ชิ้น`,'');
    }

    chooseAnswer(value,button,selector) {
      if(this.state!==GAME_STATES.PLAYING||this.awaitingNext)return;
      this.selectedAnswer=value;
      ui.answers.querySelectorAll(selector).forEach(item=>item.classList.toggle('selected',item===button));
      this.audio.select();
    }

    clearSelection() {
      if(this.awaitingNext)return;
      this.selectedSlices.clear();this.selectedAnswer=null;
      ui.visual.querySelectorAll('.pizza-slice.selected').forEach(slice=>slice.classList.remove('selected'));
      ui.answers.querySelectorAll('.selected').forEach(answer=>answer.classList.remove('selected'));
      this.setFeedback('↺','ล้างคำตอบแล้ว ลองเลือกใหม่ได้เลย','');this.audio.select();
    }

    submitAnswer() {
      if(this.awaitingNext){this.nextQuestion();return;}
      if(this.state!==GAME_STATES.PLAYING)return;
      const question=this.currentQuestion();
      if(question.type==='build-fraction'&&!this.selectedSlices.size){this.setFeedback('💡','แตะเลือกพิซซ่าอย่างน้อยหนึ่งชิ้นก่อนส่งออเดอร์','error');return;}
      if(question.type!=='build-fraction'&&this.selectedAnswer===null){this.setFeedback('💡','เลือกคำตอบก่อนส่งออเดอร์','error');return;}
      this.currentAttempts+=1;
      const correct=this.validateAnswer(question);
      if(correct)this.showCorrectFeedback(question);else this.showIncorrectFeedback(question);
    }

    validateAnswer(question) {
      if(question.type==='build-fraction')return this.selectedSlices.size===question.numerator;
      if(question.type==='read-fraction')return this.selectedAnswer===`${question.numerator}/${question.denominator}`;
      if(question.type==='choose-equivalent'){const [numerator,denominator]=this.selectedAnswer.split('/').map(Number);return DATA.areFractionsEquivalent({numerator,denominator},question.source);}
      if(question.type==='compare-fractions')return this.selectedAnswer===question.answer;
      return false;
    }

    showCorrectFeedback(question) {
      clearInterval(this.timerId);this.state=GAME_STATES.FEEDBACK;this.correct+=1;this.combo+=1;
      const gained=this.calculateScore();this.score+=gained;
      ui.score.textContent=this.score.toLocaleString('th-TH');ui.combo.textContent=this.combo;
      ui.visual.querySelectorAll('.pizza-slice.selected').forEach(slice=>slice.classList.add('correct'));
      this.setFeedback('🎉',`ยอดเยี่ยม! ${question.explanation} · +${gained} คะแนนรอบนี้`,'success');
      this.audio.correct();if(this.combo>=3)this.audio.combo();
      this.finishCurrent(true);
    }

    showIncorrectFeedback(question) {
      this.combo=0;ui.combo.textContent='0';this.audio.gentleWrong();
      let message=this.friendlyCorrection(question);
      if(this.mode==='practice'||this.currentAttempts<2){this.setFeedback('🙂',`${message} ลองปรับออเดอร์แล้วส่งอีกครั้งได้เลย`,'error');return;}
      clearInterval(this.timerId);this.wrong+=1;this.setFeedback('🧑‍🍳',`${message} ${question.explanation}`,'error');this.finishCurrent(false);
    }

    friendlyCorrection(question) {
      if(question.type==='build-fraction'){const difference=this.selectedSlices.size-question.numerator;if(difference>0)return`ตอนนี้เลือก ${this.selectedSlices.size} ชิ้น แต่ต้องการ ${question.numerator} ชิ้น ลองนำออก ${difference} ชิ้น`;return`ตอนนี้เลือก ${this.selectedSlices.size} ชิ้น ยังขาดอีก ${Math.abs(difference)} ชิ้น`;}
      if(question.type==='read-fraction')return`ตัวส่วน ${question.denominator} มาจากจำนวนชิ้นทั้งหมด และตัวเศษ ${question.numerator} มาจากชิ้นที่ระบายสี`;
      if(question.type==='choose-equivalent')return'พื้นที่ของสองเศษส่วนยังไม่เท่ากัน ลองเปรียบเทียบด้วยการคูณไขว้';
      return'ลองเปรียบเทียบพื้นที่พิซซ่าทั้งสองถาด หรือคูณไขว้ก่อนเลือกเครื่องหมาย';
    }

    calculateScore() {
      const attemptScore=this.currentAttempts===1?100:60;
      const speedBonus=this.mode==='challenge'?Math.max(0,Math.min(50,this.remaining*2)):0;
      const hintPenalty=this.hintUsed?20:0;
      const multiplier=this.combo>=5?2:this.combo>=3?1.5:this.combo>=2?1.2:1;
      return Math.max(0,Math.round((attemptScore+speedBonus-hintPenalty)*multiplier));
    }

    finishCurrent(correct,prefix='') {
      this.awaitingNext=true;this.state=GAME_STATES.FEEDBACK;
      ui.submit.textContent=this.index===this.round.length-1?'ดูผลรอบนี้ 🌟':'ออเดอร์ถัดไป →';ui.clear.disabled=true;ui.hint.disabled=true;
      this.history.push({question:this.currentQuestion(),correct,attempts:this.currentAttempts,hintUsed:this.hintUsed});
      if(prefix&&!correct)this.setFeedback('⏰',`${prefix} ${this.currentQuestion().explanation}`,'error');
    }

    nextQuestion() {
      if(this.index>=this.round.length-1){this.completeGame();return;}
      this.index+=1;this.loadQuestion();
    }

    showHint() {
      if(this.awaitingNext)return;
      this.hintUsed=true;this.setFeedback('💡',this.currentQuestion().hint,'');this.audio.select();
    }

    completeGame() {
      clearInterval(this.timerId);this.audio.finish();
      const total=this.round.length;const accuracy=total?Math.round(this.correct/total*100):0;const elapsed=Math.round((performance.now()-this.roundStartedAt)/1000);const stars=accuracy>=90?3:accuracy>=70?2:accuracy>=50?1:0;
      ui.resultScore.textContent=this.score.toLocaleString('th-TH');ui.resultCorrect.textContent=`${this.correct}/${total}`;ui.resultAccuracy.textContent=`${accuracy}%`;ui.resultTime.textContent=this.formatTime(elapsed);ui.resultStars.textContent='★'.repeat(stars)+'☆'.repeat(3-stars);ui.resultMedal.textContent=stars===3?'🏆':stars===2?'🌟':stars===1?'🍕':'🧑‍🍳';
      this.renderReview();this.goTo('result');
    }

    renderReview() {
      ui.reviewBox.classList.remove('visible');
      ui.reviewBox.innerHTML=this.history.map((entry,index)=>`<article class="review-item"><b>${entry.correct?'✅':'🔎'} ข้อ ${index+1}: ${entry.question.instruction}</b><p>${entry.question.explanation}</p></article>`).join('');
    }

    pauseGame() {
      if(this.state!==GAME_STATES.PLAYING)return;
      clearInterval(this.timerId);this.state=GAME_STATES.PAUSED;
      this.showModal('⏸️','พักครัวสักครู่','กดเล่นต่อเมื่อพร้อม เวลาจะไม่เดินระหว่างพัก','resume',true);
    }

    exitRound() {clearInterval(this.timerId);ui.modal.classList.remove('visible');ui.modal.hidden=true;this.goTo('home');}

    showHowTo() {this.showModal('🍕','วิธีเล่น','ตัวส่วนบอกจำนวนชิ้นทั้งหมด ตัวเศษบอกจำนวนชิ้นที่ต้องเลือก แตะพิซซ่าแล้วกดส่งออเดอร์ เกมรองรับเมาส์ หน้าจอสัมผัส และปุ่ม Enter หรือ Space','close');}

    showModal(icon,title,content,action,showExit=false) {
      this.modalAction=action;ui.modalIcon.textContent=icon;ui.modalTitle.textContent=title;ui.modalContent.innerHTML=`<p>${content}</p>`;ui.modalPrimary.textContent=action==='resume'?'เล่นต่อ':'เข้าใจแล้ว';ui.modalSecondary.hidden=!showExit;ui.modal.hidden=false;ui.modal.classList.add('visible');
    }

    handleModalPrimary() {
      ui.modal.classList.remove('visible');ui.modal.hidden=true;
      if(this.modalAction==='resume'){this.state=GAME_STATES.PLAYING;if(this.mode==='challenge')this.startTimer();}
    }

    toggleSound() {this.audio.enabled=!this.audio.enabled;ui.sound.textContent=this.audio.enabled?'🔊':'🔇';ui.sound.setAttribute('aria-pressed',String(this.audio.enabled));ui.sound.setAttribute('aria-label',this.audio.enabled?'ปิดเสียง':'เปิดเสียง');if(this.audio.enabled){this.audio.prepare();this.audio.select();}}
    toggleMotion() {this.motionEnabled=!this.motionEnabled;document.body.classList.toggle('motion-off',!this.motionEnabled);ui.motion.textContent=this.motionEnabled?'✨':'⏹';ui.motion.setAttribute('aria-pressed',String(!this.motionEnabled));ui.motion.setAttribute('aria-label',this.motionEnabled?'ปิดแอนิเมชัน':'เปิดแอนิเมชัน');}
    toggleTextSize() {this.largeText=!this.largeText;document.documentElement.style.setProperty('--text-scale',this.largeText?'1.12':'1');ui.text.textContent=this.largeText?'A−':'A+';ui.text.setAttribute('aria-label',this.largeText?'ลดขนาดตัวอักษร':'เพิ่มขนาดตัวอักษร');}
    setFeedback(icon,text,type) {ui.feedbackIcon.textContent=icon;ui.feedbackText.textContent=text;ui.feedback.className=`feedback ${type}`;}
    formatTime(seconds) {return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
  }

  new FractionPizzaGame();
})();
