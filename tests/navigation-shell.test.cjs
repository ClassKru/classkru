const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const home = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'shell.js'), 'utf8');
const baseCss = fs.readFileSync(path.join(root, 'css', '01-base-layout.css'), 'utf8');
const responsiveCss = fs.readFileSync(path.join(root, 'css', '08-responsive-toast.css'), 'utf8');

assert.match(html, /id="desktop-navigation"/, 'desktop navigation has one generated mount point');
assert.match(html, /id="mobile-bottom-nav"/, 'mobile quick navigation has one generated mount point');
assert.match(html, /id="mobile-more-navigation"/, 'mobile more navigation has one generated mount point');
assert.doesNotMatch(html, /class="nav-item active"/, 'navigation items are not duplicated in static HTML');

assert.match(js, /const APP_NAVIGATION = \[/, 'navigation uses a shared data source');
assert.match(js, /function renderAppNavigation\(\)/, 'all navigation variants render from the shared source');
assert.match(js, /function updateNavigationState\(screenId\)/, 'active state is updated centrally');
assert.match(js, /desktopScreens: \['classrooms', 'students', 'scores', 'reports', 'checkin'\]/, 'classroom flows stay highlighted on desktop');
assert.match(js, /screens: \['checkin'\][^\n]+mobileOrder: 3/, 'mobile check-in keeps its dedicated active item');
assert.match(js, /id: 'curriculum'[^\n]+screens: \['curriculum'\]/, 'curriculum catalog is available from the shared main navigation');
assert.match(html, /id="web-screen-curriculum"/, 'curriculum catalog has a dedicated screen');

assert.match(baseCss, /--sidebar-rail-width: 80px/, 'desktop sidebar defaults to a compact rail');
assert.match(baseCss, /\.sidebar:hover,[\s\S]{0,100}\.sidebar:has\(:focus-visible\)[\s\S]{0,100}width: var\(--sidebar-open-width\)/, 'sidebar expands for mouse and keyboard users');
assert.match(baseCss, /\.main-content \{[\s\S]{0,100}margin-left: 80px/, 'desktop content aligns with the compact rail');
assert.match(responsiveCss, /@media \(min-width: 769px\) and \(max-width: 1024px\)[\s\S]*--sidebar-rail-width: 72px/, 'tablet rail uses the compact breakpoint width');

assert.match(home, /const appScreens = new Set\(\[/, 'landing page recognizes app deep-links');
assert.match(home, /location\.replace\(`index\.html\$\{location\.search\}\$\{location\.hash\}`\)/, 'landing page forwards app deep-links to the SPA');
assert.match(home, /'timetable'/, 'timetable deep-link is included');
assert.match(home, /'reports'/, 'reports deep-link is included');
assert.match(home, /'curriculum'/, 'curriculum deep-link is included');
assert.match(home, /'tools'/, 'tools deep-link is included');
assert.match(js, /const ROUTABLE_SCREENS = \[[^\]]*'curriculum'[^\]]*'tools'/, 'all app screens are routable from hash URLs');

console.log('navigation shell tests passed');
