/* =========================================================
   dashboard.js — Logic for dashboard.html and admin.html
   ========================================================= */

const isAdminPage = window.__isAdminPage === true;

// ─── Guard: Redirect if not logged in ────────────────────
if (!requireAuth()) {
  // requireAuth() handles redirect
}

// ─── On Page Load ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Populate navbar immediately from cache
  populateNavbar(cachedUser);

  // Admin page: enforce admin role client-side first
  if (isAdminPage && cachedUser.role !== 'admin') {
    showToast('⛔ Access denied. Admin only.', 'error');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    return;
  }

  try {
    if (isAdminPage) {
      await loadAdminPage();
    } else {
      await loadDashboardPage();
    }
  } catch (err) {
    showToast('⚠️ Could not load data. Check server.', 'warning');
    console.error(err);
  }
});

// ─── Populate Navbar User Pill ────────────────────────────
function populateNavbar(user) {
  const avatar   = document.getElementById('userAvatar');
  const pillName = document.getElementById('userPillName');
  const pillRole = document.getElementById('userPillRole');

  if (!user.username) return;
  if (avatar)   avatar.textContent   = user.username.charAt(0).toUpperCase();
  if (pillName) pillName.textContent = user.username;
  if (pillRole) {
    pillRole.textContent = user.role === 'admin' ? '👑 Admin' : '👤 User';
    pillRole.className   = `badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`;
    pillRole.style.marginLeft = '4px';
  }
}

// ═════════════════════════════════════════════════════════
//   DASHBOARD PAGE
// ═════════════════════════════════════════════════════════
async function loadDashboardPage() {
  const res = await authFetch(`${API}/dashboard`);
  if (!res) return;

  const data = await res.json();
  if (!res.ok || !data.success) {
    showToast(data.message || 'Failed to load dashboard.', 'error');
    return;
  }

  const { user, stats } = data.data;

  // Update hero
  document.getElementById('heroName').textContent    = `Hey, ${user.username}! 👋`;
  const heroBadge = document.getElementById('heroBadge');
  if (heroBadge) {
    heroBadge.textContent = user.role === 'admin' ? '👑 Admin' : '🎓 Student';
    heroBadge.className   = `badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`;
  }

  // Calculate & Display Academic performance
  if (user.marks && user.marks.length > 0) {
    const tableBody = document.getElementById('marksTableBody');
    tableBody.innerHTML = user.marks.map(m => `
      <tr>
        <td><div style="font-weight:600;color:var(--text-primary);">${escapeHtml(m.course)}</div></td>
        <td style="text-align:center;">${m.score}%</td>
        <td style="text-align:center;"><span class="badge badge-user" style="padding:0.2rem 0.5rem;text-transform:none;">${m.grade}</span></td>
      </tr>
    `).join('');

    // GPA mapping
    const gradePoints = { 'A+': 4.0, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D': 1.0, 'F': 0.0 };
    const totalGPA = user.marks.reduce((acc, curr) => acc + (gradePoints[curr.grade] || 3.0), 0);
    const avgGPA = (totalGPA / user.marks.length).toFixed(2);

    document.getElementById('statGPA').textContent = `${avgGPA} / 4.0`;
    document.getElementById('gpaBadge').textContent = `Cumulative GPA: ${avgGPA}`;
  } else {
    document.getElementById('marksTableBody').innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">No marks recorded yet.</td></tr>`;
    document.getElementById('statGPA').textContent = 'N/A';
  }

  // Populate Timetable
  if (user.timetable && user.timetable.length > 0) {
    const list = document.getElementById('timetableList');
    list.innerHTML = user.timetable.map(t => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:0.8rem 1rem; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:var(--radius-md);">
        <div>
          <div style="font-weight:600; font-size:0.9rem; color:var(--text-primary);">${escapeHtml(t.course)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${t.day} · Room ${t.room}</div>
        </div>
        <div style="font-size:0.8rem; font-weight:500; color:var(--accent-secondary);">${t.time}</div>
      </div>
    `).join('');

    document.getElementById('statTodayClasses').textContent = `${user.timetable.length} Classes`;
  } else {
    document.getElementById('timetableList').innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:1rem;">No classes scheduled.</div>`;
    document.getElementById('statTodayClasses').textContent = '0 Classes';
  }

  // Populate Financial Fees details
  if (user.fees) {
    const { total, paid, balance, status } = user.fees;
    document.getElementById('feeTotal').textContent = `₹${total.toLocaleString('en-IN')}`;
    document.getElementById('feePaid').textContent = `₹${paid.toLocaleString('en-IN')}`;
    document.getElementById('feeBalance').textContent = `₹${balance.toLocaleString('en-IN')}`;
    
    // Status Badge
    const statusEl = document.getElementById('feeStatusBadge');
    statusEl.textContent = status;
    statusEl.className = `badge ${status === 'Paid' ? 'badge-online' : status === 'Partial' ? 'badge-admin' : 'badge-danger'}`;
    
    document.getElementById('statFeeStatus').textContent = status;

    // Progress Bar
    const percent = Math.round((paid / total) * 100);
    const progressBar = document.getElementById('feeProgressBar');
    progressBar.style.width = `${percent}%`;

    // Pay Fees Handler
    const payBtn = document.getElementById('payFeesBtn');
    payBtn.replaceWith(payBtn.cloneNode(true)); // remove old listeners
    document.getElementById('payFeesBtn').addEventListener('click', () => {
      const amount = prompt(`💳 Online Tuition Payment Gateway\nOutstanding Tuition: ₹${balance.toLocaleString('en-IN')}\nEnter payment amount (₹):`, balance);
      if (amount === null) return;
      const payVal = parseInt(amount);
      if (isNaN(payVal) || payVal <= 0) {
        showToast('❌ Invalid payment amount entered.', 'error');
        return;
      }

      showToast('🔄 Initializing secure payment gateway…', 'info', 1500);
      setTimeout(() => {
        showToast('🔒 Authenticating secure transaction…', 'info', 1500);
        setTimeout(() => {
          showToast(`✅ Payment of ₹${payVal.toLocaleString('en-IN')} successful!`, 'success');
          // Mock update page state
          const newPaid = Math.min(total, paid + payVal);
          const newBal = Math.max(0, total - newPaid);
          const newStatus = newBal === 0 ? 'Paid' : 'Partial';
          
          user.fees.paid = newPaid;
          user.fees.balance = newBal;
          user.fees.status = newStatus;
          
          // Re-trigger load to display updated mock stats immediately!
          loadDashboardPage();
        }, 1500);
      }, 1500);
    });
  }

  // Update account info
  document.getElementById('infoId').textContent        = user.id;
  document.getElementById('infoUsername').textContent  = user.username;
  document.getElementById('infoEmail').textContent     = user.email;
  document.getElementById('infoRole').innerHTML        =
    `<span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">${user.role === 'admin' ? '👑 Admin' : '🎓 Student'}</span>`;
  document.getElementById('infoCreated').textContent   = formatDate(user.createdAt);
  document.getElementById('infoLastLogin').textContent = formatDate(user.lastLogin);

  // Token display
  const token = getToken();
  const tokenEl = document.getElementById('tokenDisplay');
  if (tokenEl && token) {
    const parts = token.split('.');
    tokenEl.innerHTML =
      `<span style="color:#a855f7">${parts[0]}</span>` +
      `<span style="color:var(--text-muted)">.</span>` +
      `<span style="color:#3b82f6">${parts[1]}</span>` +
      `<span style="color:var(--text-muted)">.</span>` +
      `<span style="color:#10b981">${parts[2]}</span>`;
  }

  // Copy token button
  const copyBtn = document.getElementById('copyTokenBtn');
  if (copyBtn && token) {
    copyBtn.replaceWith(copyBtn.cloneNode(true));
    document.getElementById('copyTokenBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(token).then(() => {
        showToast('📋 Token copied to clipboard!', 'success', 2000);
      });
    });
  }

  // Show/hide admin link
  const adminLink = document.getElementById('adminLink');
  if (adminLink && user.role !== 'admin') {
    adminLink.style.display = 'none';
  }

  // Token expiry countdown
  startTokenCountdown();
}

// ─── Token Countdown Timer ────────────────────────────────
function startTokenCountdown() {
  const el = document.getElementById('statTokenExp');
  if (!el) return;

  const token = getToken();
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      el.textContent = remaining > 0
        ? `${m}:${s.toString().padStart(2, '0')}`
        : 'Expired';

      if (remaining === 0) {
        el.style.color = 'var(--error)';
        showToast('⏰ Session token expired. Refreshing…', 'warning');
      } else if (remaining < 60) {
        el.style.color = 'var(--warning)';
      }
    };

    tick();
    setInterval(tick, 1000);
  } catch (e) {
    el.textContent = '15m';
  }
}

// ═════════════════════════════════════════════════════════
//   ADMIN PAGE (STUDENT PORTAL ADMINISTRATION)
// ═════════════════════════════════════════════════════════
let currentAdminUsers = []; // Cache list of users locally

async function loadAdminPage() {
  const res = await authFetch(`${API}/admin`);
  if (!res) return;

  const data = await res.json();

  if (res.status === 403) {
    showToast('⛔ Access denied. Admin only.', 'error');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    return;
  }

  if (!res.ok || !data.success) {
    showToast(data.message || 'Failed to load admin data.', 'error');
    return;
  }

  const { users, systemStats } = data.data;
  currentAdminUsers = users;

  // Calculate total outstanding balance
  let totalOutstanding = 0;
  users.forEach(u => {
    if (u.role === 'user' && u.fees) {
      totalOutstanding += u.fees.balance;
    }
  });

  // Populate system stats
  document.getElementById('sysTotal').textContent   = systemStats.totalUsers;
  document.getElementById('sysAdmins').textContent  = systemStats.adminCount;
  document.getElementById('sysRegular').textContent = systemStats.userCount;
  document.getElementById('sysTokens').textContent  = `₹${totalOutstanding.toLocaleString('en-IN')}`;
  document.getElementById('sysNode').textContent    = systemStats.nodeVersion;
  document.getElementById('sysUptime').textContent  = systemStats.uptime;

  // Render user table
  renderUsersTable(users);

  // Refresh button
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.replaceWith(refreshBtn.cloneNode(true));
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    showToast('🔄 Refreshing records…', 'info', 1500);
    await loadAdminPage();
  });

  // Setup Modal Actions
  setupModalListeners();
}

// ─── Render Users Table ───────────────────────────────────
function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <div class="empty-title">No members recorded</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = users.map(user => {
    const isCurrentUser = user.id === currentUser.id;
    
    let gpaDisplay = '—';
    let feesDisplay = '—';
    let statusBadgeClass = 'badge-admin';
    let statusLabel = 'Staff';
    
    if (user.role === 'user') {
      statusLabel = 'Student';
      statusBadgeClass = 'badge-user';

      // GPA calculation
      if (user.marks && user.marks.length > 0) {
        const gradePoints = { 'A+': 4.0, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'D': 1.0, 'F': 0.0 };
        const totalPoints = user.marks.reduce((acc, curr) => acc + (gradePoints[curr.grade] || 3.0), 0);
        gpaDisplay = `${(totalPoints / user.marks.length).toFixed(2)} GPA`;
      } else {
        gpaDisplay = '0.00 GPA';
      }

      // Fees progress
      if (user.fees) {
        feesDisplay = `₹${user.fees.paid.toLocaleString('en-IN')} / ₹${user.fees.total.toLocaleString('en-IN')}`;
        statusLabel = user.fees.status;
        statusBadgeClass = user.fees.status === 'Paid' ? 'badge-online' : user.fees.status === 'Partial' ? 'badge-admin' : 'badge-danger';
      }
    } else {
      statusLabel = '👑 Administrator';
      statusBadgeClass = 'badge-admin';
    }

    return `
      <tr id="row-${user.id}">
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="user-avatar" style="width:34px;height:34px;font-size:0.85rem;background:linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));">
              ${user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(user.username)}</div>
              ${isCurrentUser ? '<div style="font-size:0.7rem;color:var(--accent-secondary);">● You (Current Session)</div>' : ''}
            </div>
          </div>
        </td>
        <td>${escapeHtml(user.email)}</td>
        <td style="text-align:center; font-weight:500;">${gpaDisplay}</td>
        <td style="text-align:center; font-size:0.82rem;">${feesDisplay}</td>
        <td>
          <span class="badge ${statusBadgeClass}">
            ${statusLabel}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${user.id}')" style="padding:0.4rem 0.8rem;">
              ✏️ Edit Student
            </button>
            ${!isCurrentUser ? `
              <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}', '${escapeHtml(user.username)}')" style="padding:0.4rem 0.6rem;">
                🗑️
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── Setup Modal Listeners ────────────────────────────────
function setupModalListeners() {
  const closeBtn = document.getElementById('closeModalBtn');
  const roleSelect = document.getElementById('editRole');
  const editForm = document.getElementById('editForm');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeEditModal);
  }

  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      const studentFields = document.getElementById('studentDataFields');
      if (e.target.value === 'admin') {
        studentFields.style.display = 'none';
      } else {
        studentFields.style.display = 'block';
      }
    });
  }

  if (editForm) {
    editForm.replaceWith(editForm.cloneNode(true));
    document.getElementById('editForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveStudentDetails();
    });
  }
}

// ─── Open Edit Modal ──────────────────────────────────────
window.openEditModal = function(userId) {
  const user = currentAdminUsers.find(u => u.id === userId);
  if (!user) return;

  const modal = document.getElementById('editModal');
  const roleSelect = document.getElementById('editRole');
  const studentFields = document.getElementById('studentDataFields');
  
  document.getElementById('modalTitle').textContent = `✏️ Edit Profile: ${user.username}`;
  document.getElementById('editUserId').value = user.id;
  roleSelect.value = user.role;

  if (user.role === 'admin') {
    studentFields.style.display = 'none';
  } else {
    studentFields.style.display = 'block';
    
    // Populate subject performance scores
    const scoreCS   = document.getElementById('scoreCS');
    const scoreMath = document.getElementById('scoreMath');
    const scorePhy  = document.getElementById('scorePhy');
    const scoreEng  = document.getElementById('scoreEng');
    
    const csMark   = user.marks.find(m => m.course.startsWith('CS-101')) || { score: 0 };
    const mathMark = user.marks.find(m => m.course.startsWith('MATH-201')) || { score: 0 };
    const phyMark  = user.marks.find(m => m.course.startsWith('PHY-102')) || { score: 0 };
    const engMark  = user.marks.find(m => m.course.startsWith('ENG-110')) || { score: 0 };

    scoreCS.value   = csMark.score;
    scoreMath.value = mathMark.score;
    scorePhy.value  = phyMark.score;
    scoreEng.value  = engMark.score;

    // Populate tuition ledger
    if (user.fees) {
      document.getElementById('feesPaidAmt').value  = user.fees.paid;
      document.getElementById('feesTotalAmt').value = user.fees.total;
    }
  }

  modal.style.display = 'flex';
};

// ─── Close Edit Modal ─────────────────────────────────────
function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

// ─── Save Student Details ─────────────────────────────────
async function saveStudentDetails() {
  const userId = document.getElementById('editUserId').value;
  const role   = document.getElementById('editRole').value;
  const saveBtn = document.getElementById('saveModalBtn');

  setLoading(saveBtn, true);

  try {
    // 1. Save role
    const resRole = await authFetch(`${API}/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
    
    if (!resRole.ok) {
      const errData = await resRole.json();
      showToast(errData.message || 'Failed to update role.', 'error');
      setLoading(saveBtn, false);
      return;
    }

    // 2. If it's a student (user), save marks and fees
    if (role === 'user') {
      const scoreCS   = parseInt(document.getElementById('scoreCS').value) || 0;
      const scoreMath = parseInt(document.getElementById('scoreMath').value) || 0;
      const scorePhy  = parseInt(document.getElementById('scorePhy').value) || 0;
      const scoreEng  = parseInt(document.getElementById('scoreEng').value) || 0;

      const paidVal   = parseInt(document.getElementById('feesPaidAmt').value) || 0;
      const totalVal  = 85000; // constant invoice

      // Compute grades from percentages
      const getGrade = (score) => {
        if (score >= 90) return 'A';
        if (score >= 80) return 'A-';
        if (score >= 70) return 'B+';
        if (score >= 60) return 'B';
        if (score >= 50) return 'C';
        return 'F';
      };

      const updatedMarks = [
        { course: 'CS-101: Computer Science Fundamentals', score: scoreCS, grade: getGrade(scoreCS) },
        { course: 'MATH-201: Calculus & Linear Algebra', score: scoreMath, grade: getGrade(scoreMath) },
        { course: 'PHY-102: Computational Physics', score: scorePhy, grade: getGrade(scorePhy) },
        { course: 'ENG-110: Technical Communication', score: scoreEng, grade: getGrade(scoreEng) }
      ];

      const balance = Math.max(0, totalVal - paidVal);
      const updatedFees = {
        total: totalVal,
        paid: Math.min(totalVal, paidVal),
        balance,
        status: balance === 0 ? 'Paid' : paidVal > 0 ? 'Partial' : 'Unpaid'
      };

      // Send student records PATCH
      const resData = await authFetch(`${API}/admin/users/${userId}/data`, {
        method: 'PATCH',
        body: JSON.stringify({ marks: updatedMarks, fees: updatedFees })
      });

      if (!resData.ok) {
        const errData = await resData.json();
        showToast(errData.message || 'Failed to update student academic performance.', 'error');
        setLoading(saveBtn, false);
        return;
      }
    }

    showToast('✅ Profile and academic ledger saved successfully!', 'success');
    closeEditModal();
    await loadAdminPage();

  } catch (err) {
    showToast('Server connection error.', 'error');
  } finally {
    setLoading(saveBtn, false);
  }
}

// ─── Delete User ──────────────────────────────────────────
async function deleteUser(userId, username) {
  if (!confirm(`⚠️ Are you sure you want to permanently delete user "${username}"?\nThis removes all their academic and financial records.`)) return;

  try {
    const res = await authFetch(`${API}/admin/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`🗑️ "${username}" deleted from files.`, 'success');
      const row = document.getElementById(`row-${userId}`);
      if (row) {
        row.style.opacity = '0';
        row.style.transition = 'opacity 0.4s';
        setTimeout(() => row.remove(), 400);
      }
      setTimeout(() => loadAdminPage(), 450); // reload stats
    } else {
      showToast(data.message || 'Failed to delete user.', 'error');
    }
  } catch (err) {
    showToast('Server error.', 'error');
  }
}

// ─── HTML Escape ──────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
