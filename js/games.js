// ==================== เกมการศึกษา (Games Hub) ====================
// ตัวกรองเป็นเพียงการจัดมุมมอง ไม่แตะข้อมูลหรือระบบภายในเกมเดิม
(function () {
  const subjectLabels = { english: 'ภาษาอังกฤษ', math: 'คณิตศาสตร์', science: 'วิทยาศาสตร์' };
  let selectedLaunch = null;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function classroomOptions(subject) {
    const classes = typeof appState !== 'undefined' && Array.isArray(appState.classes) ? appState.classes : [];
    const matching = classes.filter((item) => String(item.subject || '').trim() === subjectLabels[subject]);
    const other = classes.filter((item) => !matching.includes(item));
    return { classes, ordered: [...matching, ...other] };
  }

  function closeGameClassroomSetup() {
    document.getElementById('modal-game-classroom')?.classList.remove('show');
  }

  function openGameClassroomSetup(launch) {
    selectedLaunch = launch;
    let modal = document.getElementById('modal-game-classroom');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-game-classroom';
      modal.className = 'modal-overlay';
      modal.style.zIndex = '9000';
      modal.addEventListener('click', (event) => { if (event.target === modal) closeGameClassroomSetup(); });
      document.body.appendChild(modal);
    }
    const { classes, ordered } = classroomOptions(launch.subject);
    const activeClassId = typeof currentClassId !== 'undefined' ? currentClassId : null;
    const defaultClassId = ordered.find((item) => item.id === activeClassId)?.id || ordered[0]?.id || '';
    const options = ordered.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === defaultClassId ? ' selected' : ''}>${escapeHtml(item.subject)} · ${escapeHtml(item.className)}</option>`).join('');
    modal.innerHTML = `<div class="bottom-sheet games-classroom-sheet" role="dialog" aria-modal="true" aria-labelledby="game-classroom-title">
      <div class="modal-header"><h3 id="game-classroom-title">ใช้กับห้องเรียน</h3><button class="btn btn-text" type="button" aria-label="ปิด" data-game-classroom-close><i class="hgi-stroke hgi-cancel-01"></i></button></div>
      <p class="games-classroom-game"><strong>${escapeHtml(launch.name)}</strong><span>เลือกห้องที่จะใช้เล่นบนจอในคาบนี้</span></p>
      ${classes.length ? `<label class="form-group"><span>ห้องเรียน</span><select id="game-classroom-select" class="form-control" style="appearance:auto;">${options}</select></label>
      <p class="games-classroom-note">เกมจะเปิดทันที คะแนนและการเข้าร่วมของนักเรียนจะเพิ่มในขั้นถัดไป</p>
      <div class="games-classroom-actions"><button class="btn" type="button" data-game-classroom-close>ยกเลิก</button><button class="btn btn-primary" type="button" data-game-classroom-start><i class="hgi-stroke hgi-play"></i> เปิดเกมกับห้องนี้</button></div>` : `<p class="games-classroom-note">เพิ่มห้องเรียนก่อน เพื่อเริ่มกิจกรรมกับห้องของคุณ</p><div class="games-classroom-actions"><button class="btn" type="button" data-game-classroom-close>ปิด</button><button class="btn btn-primary" type="button" data-game-classroom-add>ไปเพิ่มห้องเรียน</button></div>`}
    </div>`;
    modal.querySelectorAll('[data-game-classroom-close]').forEach((button) => button.addEventListener('click', closeGameClassroomSetup));
    modal.querySelector('[data-game-classroom-add]')?.addEventListener('click', () => { closeGameClassroomSetup(); window.navigateToWebScreen?.('classrooms'); });
    modal.querySelector('[data-game-classroom-start]')?.addEventListener('click', () => {
      const selectedId = modal.querySelector('#game-classroom-select')?.value;
      const selectedClass = classes.find((item) => item.id === selectedId);
      if (!selectedClass || !selectedLaunch) return;
      const params = new URLSearchParams({ classroom: selectedClass.id, classroomName: selectedClass.className || '', subject: selectedClass.subject || '' });
      window.location.href = `${selectedLaunch.url}${selectedLaunch.url.includes('?') ? '&' : '?'}${params.toString()}`;
    });
    modal.classList.add('show');
  }

  function addClassroomLaunchButtons(root) {
    root.querySelectorAll('[data-game-card]').forEach((card) => {
      if (card.dataset.classroomLaunchReady === 'true') return;
      const quickStart = card.querySelector('.games-play-button');
      const name = card.querySelector('h4')?.textContent?.trim();
      if (!quickStart || !name) return;
      card.dataset.classroomLaunchReady = 'true';
      const actions = document.createElement('div');
      actions.className = 'games-launch-actions';
      quickStart.before(actions);
      actions.appendChild(quickStart);
      const classroomButton = document.createElement('button');
      classroomButton.type = 'button';
      classroomButton.className = 'games-classroom-button';
      classroomButton.innerHTML = '<i class="hgi-stroke hgi-school"></i> ใช้กับห้องเรียน';
      classroomButton.addEventListener('click', () => openGameClassroomSetup({ name, url: quickStart.getAttribute('href'), subject: card.dataset.gameSubject }));
      actions.appendChild(classroomButton);
    });
  }

  function initGamesFilters() {
    const root = document.getElementById('web-screen-games');
    if (!root || root.dataset.filtersReady === 'true') return;
    root.dataset.filtersReady = 'true';
    let selectedSubject = 'all';
    let selectedGrade = 'all';
    const cards = [...root.querySelectorAll('[data-game-card]')];
    const sections = [...root.querySelectorAll('[data-game-section]')];
    const count = root.querySelector('#games-filter-count');
    const empty = root.querySelector('#games-empty-state');
    addClassroomLaunchButtons(root);

    function render() {
      let visible = 0;
      cards.forEach((card) => {
        const subjectMatch = selectedSubject === 'all' || card.dataset.gameSubject === selectedSubject;
        const grades = (card.dataset.gameGrade || '').split(/\s+/);
        const gradeMatch = selectedGrade === 'all' || grades.includes(selectedGrade);
        const show = subjectMatch && gradeMatch;
        card.hidden = !show;
        if (show) visible += 1;
      });
      sections.forEach((section) => {
        const hasVisibleCard = section.querySelector('[data-game-card]:not([hidden])');
        section.hidden = !hasVisibleCard;
      });
      if (count) count.textContent = `${visible} เกม`;
      if (empty) empty.hidden = visible !== 0;
    }

    root.querySelectorAll('[data-game-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.gameFilter;
        if (type === 'subject') selectedSubject = button.dataset.gameValue;
        if (type === 'grade') selectedGrade = button.dataset.gameValue;
        root.querySelectorAll(`[data-game-filter="${type}"]`).forEach((item) => item.classList.toggle('is-active', item === button));
        render();
      });
    });
    render();
  }

  window.initGamesFilters = initGamesFilters;
  window.closeGameClassroomSetup = closeGameClassroomSetup;
  document.addEventListener('DOMContentLoaded', initGamesFilters);
  window.addEventListener('hashchange', initGamesFilters);
})();
