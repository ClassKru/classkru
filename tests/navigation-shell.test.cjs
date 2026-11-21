const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const home = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'shell.js'), 'utf8');
const sidebarCss = fs.readFileSync(path.join(root, 'css', '16-sidebar-redesign.css'), 'utf8');

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

assert.match(sidebarCss, /--sidebar-rail-width: 220px/, 'desktop sidebar keeps a fixed expanded width');
assert.match(sidebarCss, /--sidebar-open-width: 220px/, 'hover and focus do not change sidebar width');
assert.match(sidebarCss, /\.main-content \{ margin-left: 220px; \}/, 'workspace aligns with the expanded sidebar');
assert.match(sidebarCss, /\.swipe-overlay \{ left: 220px; \}/, 'desktop overlays align with the expanded sidebar');
assert.match(sidebarCss, /\.nav-item\.active > span \{ opacity: 0\.72; \}/, 'active label is more visible at rest');
assert.match(sidebarCss, /opacity: 0\.46;\s*transform: translateX\(8px\);/, 'all labels remain visible as faint hints while resting slightly offset');
assert.match(sidebarCss, /\.nav-item:hover > span,[\s\S]*\.nav-item:focus-visible > span \{[\s\S]*opacity: 1;\s*transform: translateX\(0\);/, 'hover and keyboard focus clarify and align only the current label');
assert.match(sidebarCss, /transition: opacity 300ms ease-out, transform 300ms ease-out/, 'label emphasis animates smoothly without changing sidebar width');
assert.doesNotMatch(sidebarCss, /\.nav-item:focus > span/, 'pointer click does not leave a menu label revealed');
assert.match(sidebarCss, /\.sidebar:hover \.sidebar-menu \.nav-item:not\(:hover\) > span,[\s\S]*opacity: 0\.46/, 'non-pointed labels stay faint while one label is highlighted');
assert.doesNotMatch(sidebarCss, /\.nav-item:focus > span/, 'pointer click does not leave a menu label revealed');
assert.match(sidebarCss, /@media \(hover: none\) and \(min-width: 769px\)[\s\S]*opacity: 1/, 'touch-first desktop layouts show labels without hover');
assert.match(sidebarCss, /\.sidebar\.is-click-collapsed \.sidebar-menu \.nav-item > span/, 'touch labels stay available when the legacy collapsed class is present');
assert.match(sidebarCss, /prefers-reduced-motion: reduce[\s\S]*transition: none/, 'reduced-motion preference disables sidebar transitions');
assert.doesNotMatch(sidebarCss, /sidebar-tooltip/, 'floating tooltip styles are removed');
assert.doesNotMatch(js, /sidebarTooltip|splitTooltipGraphemes/, 'navigation no longer types tooltip text in JavaScript');

assert.match(home, /const appScreens = new Set\(\[/, 'landing page recognizes app deep-links');
assert.match(home, /location\.replace\(`index\.html\$\{location\.search\}\$\{location\.hash\}`\)/, 'landing page forwards app deep-links to the SPA');
assert.match(home, /'timetable'/, 'timetable deep-link is included');
assert.match(home, /'reports'/, 'reports deep-link is included');
assert.match(home, /'curriculum'/, 'curriculum deep-link is included');
assert.match(home, /'tools'/, 'tools deep-link is included');
assert.match(js, /const ROUTABLE_SCREENS = \[[^\]]*'curriculum'[^\]]*'tools'/, 'all app screens are routable from hash URLs');

console.log('navigation shell tests passed');
