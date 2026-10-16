'use strict';

const { callRpc } = require('./supabase-admin');

const DEFAULT_DAILY_LIMIT = 15;
const QUOTA_TIME_ZONE = process.env.AI_QUOTA_TIMEZONE || 'Asia/Bangkok';

function dailyLimit() {
  const value = Number(process.env.AI_DAILY_GENERATION_LIMIT || DEFAULT_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 && value <= 1000 ? value : DEFAULT_DAILY_LIMIT;
}

function quotaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: QUOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date()).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeQuota(value) {
  const row = Array.isArray(value) ? value[0] : value;
  const limit = Number(row?.limit);
  const used = Number(row?.used);
  const remaining = Number(row?.remaining);
  return {
    allowed: row?.allowed !== false,
    date: String(row?.date || quotaDate()),
    limit: Number.isFinite(limit) ? limit : dailyLimit(),
    used: Number.isFinite(used) ? Math.max(used, 0) : 0,
    remaining: Number.isFinite(remaining) ? Math.max(remaining, 0) : dailyLimit()
  };
}

function rpcArgs(teacherId, date = quotaDate()) {
  return { p_teacher_id: teacherId, p_usage_date: date, p_daily_limit: dailyLimit() };
}

async function getAiQuota(teacherId) {
  return normalizeQuota(await callRpc('get_ai_daily_generation_quota', rpcArgs(teacherId)));
}

async function consumeAiQuota(teacherId) {
  const quota = normalizeQuota(await callRpc('consume_ai_daily_generation_quota', rpcArgs(teacherId)));
  if (!quota.allowed) {
    const error = new Error('วันนี้ใช้โควตาการสร้าง AI ครบแล้ว');
    error.code = 'AI_DAILY_LIMIT_REACHED';
    error.status = 429;
    error.quota = quota;
    throw error;
  }
  return quota;
}

async function releaseAiQuota(teacherId, date) {
  return normalizeQuota(await callRpc('release_ai_daily_generation_quota', rpcArgs(teacherId, date)));
}

module.exports = { dailyLimit, quotaDate, getAiQuota, consumeAiQuota, releaseAiQuota };
