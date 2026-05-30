/* =========================================================
   auth.js — Shared utilities used across all pages
   ========================================================= */

const API = 'http://localhost:5000/api';

// ─── Alert Box ────────────────────────────────────────────
function showAlert(message, type) {
  const box = document.getElementById('alertBox');
  if (!box) return;
  if (!message) { box.style.display = 'none'; return; }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  box.style.display = 'flex';
  box.className = `alert alert-${type}`;
  box.innerHTML = `<span class="alert-icon">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
}

// ─── Toast Notification ───────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const colors = {
    success: '#10b981',
    error:   '#ef4444',
    warning: '#f59e0b',
    info:    '#3b82f6'
  };
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.borderLeftColor = colors[type] || colors.info;
  toast.style.borderLeft = `3px solid ${colors[type] || colors.info}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ─── Button Loading State ─────────────────────────────────
function setLoading(btn, isLoading) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle('loading', isLoading);
}

// ─── Format Date ──────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Get stored token ─────────────────────────────────────
function getToken() {
  return localStorage.getItem('accessToken');
}

// ─── Auth fetch helper (adds Bearer token) ────────────────
async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });

  // Auto-handle token expiry — attempt refresh
  if (res.status === 401) {
    const data = await res.json();
    if (data.expired) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        // Retry with new token
        headers.Authorization = `Bearer ${getToken()}`;
        return fetch(url, { ...options, headers });
      } else {
        logoutAndRedirect();
        return;
      }
    }
  }
  return res;
}

// ─── Token refresh ────────────────────────────────────────
async function tryRefreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const data = await res.json();
    if (res.ok && data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Logout ───────────────────────────────────────────────
async function logoutAndRedirect() {
  try {
    await authFetch(`${API}/auth/logout`, { method: 'POST' });
  } catch (_) { /* ignore */ }
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// ─── Require authentication guard ────────────────────────
function requireAuth() {
  const token = getToken();
  if (!token) {
    showToast('🔒 Please log in to access this page.', 'warning');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
    return false;
  }
  return true;
}

// ─── Logout button handler (shared) ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      setLoading(logoutBtn, true);
      logoutBtn.textContent = 'Signing out…';
      await logoutAndRedirect();
    });
  }
});
