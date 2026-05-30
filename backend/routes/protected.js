const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/dashboard  (any authenticated user)
// ─────────────────────────────────────────────
router.get('/dashboard', authenticate, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const totalUsers = db.get('users').size().value();

  res.json({
    success: true,
    message: `Welcome to your dashboard, ${user.username}!`,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        marks: user.marks,
        fees: user.fees,
        timetable: user.timetable
      },
      stats: {
        totalUsers,
        serverTime: new Date().toISOString(),
        sessionActive: true
      }
    }
  });
});

// ─────────────────────────────────────────────
// GET /api/admin  (admin role only)
// ─────────────────────────────────────────────
router.get('/admin', authenticate, authorize('admin'), (req, res) => {
  const allUsers = db.get('users').map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
    marks: u.marks,
    fees: u.fees,
    timetable: u.timetable
  })).value();

  const blacklistedTokens = db.get('tokens').size().value();

  res.json({
    success: true,
    message: 'Admin panel — full system access granted.',
    data: {
      users: allUsers,
      systemStats: {
        totalUsers: allUsers.length,
        adminCount: allUsers.filter(u => u.role === 'admin').length,
        userCount: allUsers.filter(u => u.role === 'user').length,
        blacklistedTokens,
        serverTime: new Date().toISOString(),
        nodeVersion: process.version,
        uptime: Math.floor(process.uptime()) + 's'
      }
    }
  });
});

// ─────────────────────────────────────────────
// DELETE /api/admin/users/:id  (admin only)
// ─────────────────────────────────────────────
router.delete('/admin/users/:id', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  }

  const user = db.get('users').find({ id }).value();
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  db.get('users').remove({ id }).write();

  res.json({ success: true, message: `User "${user.username}" has been deleted.` });
});

// ─────────────────────────────────────────────
// PATCH /api/admin/users/:id/role  (admin only)
// ─────────────────────────────────────────────
router.patch('/admin/users/:id/role', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role. Must be "admin" or "user".' });
  }

  const user = db.get('users').find({ id }).value();
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  db.get('users').find({ id }).assign({ role }).write();

  res.json({
    success: true,
    message: `User "${user.username}" role updated to "${role}".`,
    user: { ...user, role }
  });
});

// ─────────────────────────────────────────────
// PATCH /api/admin/users/:id/data  (admin only)
// ─────────────────────────────────────────────
router.patch('/admin/users/:id/data', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const { marks, fees, timetable } = req.body;

  const user = db.get('users').find({ id }).value();
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const updates = {};
  if (marks) updates.marks = marks;
  if (fees) updates.fees = fees;
  if (timetable) updates.timetable = timetable;

  db.get('users').find({ id }).assign(updates).write();

  res.json({
    success: true,
    message: `Student details for "${user.username}" updated successfully.`,
    user: { ...user, ...updates }
  });
});

module.exports = router;
