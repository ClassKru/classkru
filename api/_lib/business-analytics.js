'use strict';

const { selectRows } = require('./supabase-admin');

const PAGE_SIZE = 1000;
const MAX_ROWS = 20000;
const WORK_TABLES = Object.freeze([
  { name: 'classrooms', select: 'teacher_id,created_at,updated_at', order: 'updated_at.desc,teacher_id.asc,id.asc', all: true },
  { name: 'timetable_entries', select: 'teacher_id,updated_at', order: 'updated_at.desc,teacher_id.asc,week.asc,day_of_week.asc,period.asc', all: true },
  { name: 'students', select: 'teacher_id,updated_at', order: 'updated_at.desc,teacher_id.asc,id.asc' },
  { name: 'classroom_students', select: 'teacher_id,updated_at', order: 'updated_at.desc,teacher_id.asc,classroom_id.asc,student_id.asc' },
  { name: 'attendance_records', select: 'teacher_id,updated_at', order: 'updated_at.desc,teacher_id.asc,classroom_id.asc,student_id.asc,attendance_date.asc' },
  { name: 'score_items', select: 'teacher_id,updated_at', order: 'updated_at.desc,teacher_id.asc,classroom_id.asc,id.asc' },
  { name: 'student_scores', select: 'teacher_id,updated_at', order: 'updated_at.desc,teacher_id.asc,classroom_id.asc,score_item_id.asc,student_id.asc' }
]);

function thaiDayStart(now) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Date.parse(`${value.year}-${value.month}-${value.day}T00:00:00+07:00`);
}

async function loadAll(table, select, filters = {}, order = 'updated_at.desc,id.asc', read = selectRows) {
  const rows = [];
  while (rows.length <= MAX_ROWS) {
    const page = await read(table, { select, filters, order, limit: PAGE_SIZE, offset: rows.length });
    if (!Array.isArray(page)) throw new Error('Invalid analytics response');
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  const error = new Error('Business analytics source exceeded its safe read limit');
  error.code = 'ANALYTICS_LIMIT_EXCEEDED';
  throw error;
}

function summarize({ teachers, orders, classrooms, timetable_entries = [], students = [], classroom_students = [], attendance_records, score_items, student_scores = [] }, now = new Date()) {
  const nowMs = now.getTime();
  const sevenDays = nowMs - 7 * 86400000;
  const thirtyDays = nowMs - 30 * 86400000;
  const today = thaiDayStart(now);
  const accountsById = new Map();
  for (const row of teachers) {
    if (!row.teacher_id || row.deleted_at) continue;
    accountsById.set(row.teacher_id, {
      teacherId: row.teacher_id,
      email: row.email,
      registeredAt: row.created_at,
      subscriptionStatus: row.subscription_status,
      paidUntil: row.paid_until,
      classrooms: 0,
      timetableEntries: 0,
      attendance30d: 0,
      scoreItems30d: 0,
      studentScores30d: 0,
      lastRecordedAt: null,
      recordedToday: false,
      recorded7d: false,
      recorded30d: false,
      hasPaid: false
    });
  }
  const record = (row, kind) => {
    const account = accountsById.get(row.teacher_id);
    if (!account) return;
    const timestamp = Date.parse(row.updated_at || row.created_at || '');
    if (kind === 'classrooms') account.classrooms++;
    if (kind === 'timetable_entries') account.timetableEntries++;
    if (Number.isNaN(timestamp) || timestamp > nowMs) return;
    if (!account.lastRecordedAt || timestamp > Date.parse(account.lastRecordedAt)) {
      account.lastRecordedAt = new Date(timestamp).toISOString();
    }
    if (timestamp >= thirtyDays) {
      account.recorded30d = true;
      if (kind === 'attendance_records') account.attendance30d++;
      if (kind === 'score_items') account.scoreItems30d++;
      if (kind === 'student_scores') account.studentScores30d++;
    }
    if (timestamp >= sevenDays) account.recorded7d = true;
    if (timestamp >= today) account.recordedToday = true;
  };
  classrooms.forEach(row => record(row, 'classrooms'));
  timetable_entries.forEach(row => record(row, 'timetable_entries'));
  students.forEach(row => record(row, 'students'));
  classroom_students.forEach(row => record(row, 'classroom_students'));
  attendance_records.forEach(row => record(row, 'attendance_records'));
  score_items.forEach(row => record(row, 'score_items'));
  student_scores.forEach(row => record(row, 'student_scores'));

  const paidOrders = orders.filter(row => row.status === 'paid');
  for (const row of paidOrders) {
    const account = accountsById.get(row.teacher_id);
    if (account) account.hasPaid = true;
  }
  const accounts = [...accountsById.values()].sort((a, b) =>
    (Date.parse(b.lastRecordedAt || '') || 0) - (Date.parse(a.lastRecordedAt || '') || 0) || String(a.email).localeCompare(String(b.email))
  );
  return {
    generatedAt: now.toISOString(),
    definition: 'การใช้งาน = มีการบันทึกหรือแก้ไขข้อมูลห้องเรียน ตารางสอน นักเรียน เช็กชื่อ หรือคะแนนบนคลาวด์; ไม่รวมการเปิดเว็บอย่างเดียว',
    accounts: {
      total: accounts.length,
      eligible: accounts.filter(row => !['expired', 'suspended'].includes(row.subscriptionStatus) && (!row.paidUntil || Date.parse(row.paidUntil) >= nowMs)).length,
      trial: accounts.filter(row => row.subscriptionStatus === 'trial').length,
      activated: accounts.filter(row => row.classrooms > 0).length,
      recordedToday: accounts.filter(row => row.recordedToday).length,
      recorded7d: accounts.filter(row => row.recorded7d).length,
      recorded30d: accounts.filter(row => row.recorded30d).length,
      paid: accounts.filter(row => row.hasPaid).length,
      expired: accounts.filter(row => row.subscriptionStatus === 'expired').length
    },
    payments: {
      paidOrders: paidOrders.length,
      paidAmountSatang: paidOrders.reduce((total, row) => total + Number(row.amount_satang || 0), 0)
    },
    rows: accounts
  };
}

async function loadBusinessAnalytics(now = new Date(), read = selectRows) {
  const since30d = new Date(now.getTime() - 30 * 86400000).toISOString();
  const [teachers, orders, ...workRows] = await Promise.all([
    loadAll('teacher_profiles', 'teacher_id,email,created_at,subscription_status,paid_until,deleted_at,updated_at', {}, 'updated_at.desc,teacher_id.asc', read),
    loadAll('payment_orders', 'teacher_id,amount_satang,status,updated_at', {}, 'updated_at.desc,id.asc', read),
    ...WORK_TABLES.map(table => loadAll(table.name, table.select,
      table.all ? { deleted_at: 'is.null' } : { deleted_at: 'is.null', updated_at: `gte.${since30d}` }, table.order, read))
  ]);
  return summarize({ teachers, orders, ...Object.fromEntries(WORK_TABLES.map((table, i) => [table.name, workRows[i]])) }, now);
}

module.exports = { loadBusinessAnalytics, summarize, thaiDayStart };
