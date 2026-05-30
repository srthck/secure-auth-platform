const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required.'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    // Check duplicate email
    const existingUser = db.get('users').find({ email: email.toLowerCase() }).value();
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    // Check duplicate username
    const existingUsername = db.get('users').find({ username }).value();
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Assign role - only allow 'admin' if explicitly set and no admins exist yet
    const existingAdmins = db.get('users').filter({ role: 'admin' }).value();
    const assignedRole = (role === 'admin' && existingAdmins.length === 0) ? 'admin' : 'user';

    const defaultStudentData = {
      marks: [
        { course: 'CS-101: Computer Science Fundamentals', score: 92, grade: 'A' },
        { course: 'MATH-201: Calculus & Linear Algebra', score: 85, grade: 'A-' },
        { course: 'PHY-102: Computational Physics', score: 78, grade: 'B+' },
        { course: 'ENG-110: Technical Communication', score: 95, grade: 'A+' }
      ],
      fees: {
        total: 85000,
        paid: 60000,
        balance: 25000,
        status: 'Partial' // Paid, Partial, Unpaid
      },
      timetable: [
        { day: 'Monday', time: '09:00 AM - 10:30 AM', course: 'MATH-201', room: 'L-201' },
        { day: 'Monday', time: '11:00 AM - 12:30 PM', course: 'CS-101', room: 'Lab-4' },
        { day: 'Wednesday', time: '09:00 AM - 10:30 AM', course: 'MATH-201', room: 'L-201' },
        { day: 'Wednesday', time: '01:00 PM - 02:30 PM', course: 'PHY-102', room: 'Phy-Lab' },
        { day: 'Thursday', time: '11:00 AM - 12:30 PM', course: 'CS-101', room: 'Lab-4' },
        { day: 'Friday', time: '10:00 AM - 11:30 AM', course: 'ENG-110', room: 'Seminar-A' }
      ]
    };

    // Create user object
    const newUser = {
      id: uuidv4(),
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: assignedRole,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      ...(assignedRole === 'user' ? defaultStudentData : {})
    };

    // Save to DB
    db.get('users').push(newUser).write();

    // Generate tokens
    const tokenPayload = { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Find user
    const user = db.get('users').find({ email: email.toLowerCase() }).value();
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Update last login
    db.get('users')
      .find({ id: user.id })
      .assign({ lastLogin: new Date().toISOString() })
      .write();

    // Generate tokens
    const tokenPayload = { id: user.id, username: user.username, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.status(200).json({
      success: true,
      message: `Welcome back, ${user.username}!`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = db.get('users').find({ id: decoded.id }).value();

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const tokenPayload = { id: user.id, username: user.username, email: user.email, role: user.role };
    const newAccessToken = generateAccessToken(tokenPayload);

    res.json({ success: true, accessToken: newAccessToken });

  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
router.post('/logout', authenticate, (req, res) => {
  try {
    // Blacklist the current token
    db.get('tokens').push({ token: req.token, invalidatedAt: new Date().toISOString() }).write();

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during logout.' });
  }
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }
  });
});

module.exports = router;
