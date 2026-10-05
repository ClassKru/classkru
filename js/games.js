// ==================== เกมการศึกษา (Games Hub) ====================
// ตัวกรองเป็นเพียงการจัดมุมมอง ไม่แตะข้อมูลหรือระบบภายในเกมเดิม
(function () {

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
  document.addEventListener('DOMContentLoaded', initGamesFilters);
  window.addEventListener('hashchange', initGamesFilters);
})();
