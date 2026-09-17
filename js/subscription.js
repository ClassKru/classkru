// Billing foundation. The test flag is intentionally explicit and temporary.
// Production entitlement checks must move server-side before real payments are enabled.
const CK_BILLING_MODE = 'test';

function subscriptionCurrentEmail() {
  return String(localStorage.getItem('classmanager_email') || '').trim();
}

function subscriptionDaysLeft() {
  if (CK_BILLING_MODE === 'test') return 999;
  return 0;
}

function renderSubscriptionPage() {
  const email = subscriptionCurrentEmail();
  const emailEl = document.getElementById('subscription-account-email');
  const modeEl = document.getElementById('subscription-mode-label');
  const daysEl = document.getElementById('subscription-days-left');
  const expiryEl = document.getElementById('subscription-expiry');
  if (emailEl) emailEl.textContent = email || 'บัญชีที่เข้าสู่ระบบ';
  if (modeEl) modeEl.textContent = CK_BILLING_MODE === 'test' ? 'โหมดทดลองระบบสมาชิก' : 'ระบบสมาชิก';
  if (daysEl) daysEl.textContent = CK_BILLING_MODE === 'test' ? 'ใช้งานได้' : String(subscriptionDaysLeft());
  if (expiryEl) expiryEl.textContent = CK_BILLING_MODE === 'test' ? 'ยังไม่จำกัดในช่วงทดสอบ' : 'รอข้อมูลการสมัครสมาชิก';
}

function startSubscriptionCheckout() {
  const status = document.getElementById('subscription-action-status');
  if (!status) return;
  status.textContent = CK_BILLING_MODE === 'test'
    ? 'โหมดทดสอบ: ยังไม่เชื่อมต่อการรับเงินจริง ระบบจะเปิดใช้งานบัญชีนี้ให้โดยอัตโนมัติ'
    : 'กำลังเตรียมรายการชำระเงิน…';
}

document.addEventListener('DOMContentLoaded', renderSubscriptionPage);
