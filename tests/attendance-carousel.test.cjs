const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'attendance.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', '06-attendance.css'), 'utf8');

assert.match(html, /onclick="moveSwipeStudent\(-1\)"/, 'previous fallback button is present');
assert.match(html, /onclick="moveSwipeStudent\(1\)"/, 'next fallback button is present');
assert.doesNotMatch(html, /id="swipe-card-preview-(previous|next)"/, 'background previous/next student previews are removed');
assert.doesNotMatch(html, /id="swipe-student-slider"[^>]*type="range"/, 'student slider is removed from the action-focused mobile view');
assert.doesNotMatch(html, /oninput="selectSwipeStudentFromSlider\(this\.value\)"/, 'no slider-driven student navigation remains in the markup');
assert.doesNotMatch(html, /swipe-slider-current-label|swipe-slider-first|swipe-slider-last|swipe-card-position/, 'slider adds no duplicate student name or number labels');
assert.doesNotMatch(html, /เลื่อนแถบด้านล่างเพื่อเปลี่ยนนักเรียน|swipe-card-guide/, 'the card has no redundant slider instruction');
assert.doesNotMatch(html, /swipe-progress-bar/, 'duplicate progress bar is removed because checked count already communicates progress');
assert.doesNotMatch(html, /onclick="onSwipeCardTap\(event\)"/, 'tapping the card must not mark attendance');
assert.doesNotMatch(html, /ontouchstart|ontouchmove|ontouchend/, 'the student card no longer owns a swipe gesture');
assert.doesNotMatch(js, /function onSwipeCardTap/, 'legacy tap-to-present gesture is removed');
assert.doesNotMatch(js, /function selectSwipeStudentFromSlider/, 'legacy slider navigation function is removed');
assert.doesNotMatch(js, /calculateSwipeMomentum|spinSwipeStudents|SWIPE_MOMENTUM/, 'momentum navigation is removed');
assert.match(js, /const previousStatus = swipeResults\[student\.id\] \|\| ''/, 'an existing mark can be changed and undone');
assert.match(js, /autoSaveAttendance\(\);[\s\S]*if \(swipeStudentIndex === markedIndex && swipeStudentIndex < c\.students\.length - 1\) swipeStudentIndex\+\+/, 'button saves before advancing the same visible card');
assert.doesNotMatch(css, /swipe-card-preview/, 'legacy background card styling is removed');
assert.doesNotMatch(css, /swipe-progress-bar/, 'legacy progress bar styling is removed');
assert.doesNotMatch(css, /swipe-student-slider/, 'legacy slider styling is removed');
assert.match(css, /\.swipe-btn\.active/, 'saved status is highlighted when revisiting a student');

console.log('attendance carousel tests passed');
