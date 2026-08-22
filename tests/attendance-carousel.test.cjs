const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'attendance.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', '06-attendance.css'), 'utf8');

assert.match(html, /id="swipe-card-preview-previous"/, 'previous student preview is present');
assert.match(html, /id="swipe-card-preview-next"/, 'next student preview is present');
assert.match(html, /onclick="moveSwipeStudent\(-1\)"/, 'previous fallback button is present');
assert.match(html, /onclick="moveSwipeStudent\(1\)"/, 'next fallback button is present');
assert.match(html, /id="swipe-student-slider"[^>]*type="range"/, 'student navigation uses a range slider');
assert.match(html, /oninput="selectSwipeStudentFromSlider\(this\.value\)"/, 'the card follows the slider while it moves');
assert.doesNotMatch(html, /swipe-slider-current-label|swipe-slider-first|swipe-slider-last|swipe-card-position/, 'slider adds no duplicate student name or number labels');
assert.doesNotMatch(html, /onclick="onSwipeCardTap\(event\)"/, 'tapping the card must not mark attendance');
assert.doesNotMatch(html, /ontouchstart|ontouchmove|ontouchend/, 'the student card no longer owns a swipe gesture');
assert.doesNotMatch(js, /function onSwipeCardTap/, 'legacy tap-to-present gesture is removed');
assert.match(js, /function selectSwipeStudentFromSlider\(value\)/, 'slider selects a roster index directly');
assert.doesNotMatch(js, /calculateSwipeMomentum|spinSwipeStudents|SWIPE_MOMENTUM/, 'momentum navigation is removed');
assert.doesNotMatch(js, /selectSwipeStudentFromSlider[\s\S]{0,500}markSwipeStatus|selectSwipeStudentFromSlider[\s\S]{0,500}autoSaveAttendance/, 'moving the slider must not save attendance');
assert.match(js, /const previousStatus = swipeResults\[student\.id\] \|\| ''/, 'an existing mark can be changed and undone');
assert.match(js, /autoSaveAttendance\(\);[\s\S]*if \(swipeStudentIndex === markedIndex && swipeStudentIndex < c\.students\.length - 1\) swipeStudentIndex\+\+/, 'button saves before advancing the same visible card');
assert.match(css, /\.swipe-card-preview\.previous/, 'stacked previous card has carousel styling');
assert.match(css, /\.swipe-student-slider::\-webkit-slider-thumb/, 'slider has a touch-friendly mobile thumb');
assert.match(css, /\.swipe-btn\.active/, 'saved status is highlighted when revisiting a student');

console.log('attendance carousel tests passed');
