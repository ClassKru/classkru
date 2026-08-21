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
assert.match(html, /id="swipe-card-position"/, 'roster position is visible');
assert.doesNotMatch(html, /onclick="onSwipeCardTap\(event\)"/, 'tapping the card must not mark attendance');
assert.doesNotMatch(js, /function onSwipeCardTap/, 'legacy tap-to-present gesture is removed');
assert.match(js, /deltaX > SWIPE_THRESHOLD[\s\S]*moveSwipeStudent\(-1\)/, 'swiping right goes to the previous student');
assert.match(js, /deltaX < -SWIPE_THRESHOLD[\s\S]*moveSwipeStudent\(1\)/, 'swiping left goes to the next student');
assert.doesNotMatch(js, /deltaX > SWIPE_THRESHOLD[\s\S]{0,100}markSwipeStatus/, 'swiping must not save a status');
assert.match(js, /const previousStatus = swipeResults\[student\.id\] \|\| ''/, 'an existing mark can be changed and undone');
assert.match(js, /autoSaveAttendance\(\);[\s\S]*if \(swipeStudentIndex === markedIndex && swipeStudentIndex < c\.students\.length - 1\) swipeStudentIndex\+\+/, 'button saves before advancing the same visible card');
assert.match(css, /\.swipe-card-preview\.previous/, 'stacked previous card has carousel styling');
assert.match(css, /\.swipe-btn\.active/, 'saved status is highlighted when revisiting a student');

console.log('attendance carousel tests passed');
