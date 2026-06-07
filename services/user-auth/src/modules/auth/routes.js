const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../lib/db');
const logger = require('../../lib/logger');
const { getChannel } = require('../../lib/rabbitmq');

// POST /api/auth/register
// POST /api/auth/register
// POST /api/auth/register
const registerHandler = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            'INSERT INTO users (email, password_hash, name, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, email, name',
            [email, hashedPassword, name]
        );

        const user = result.rows[0];

        // Publish Event
        const channel = getChannel();
        if (channel) {
            channel.sendToQueue('USER_CREATED', Buffer.from(JSON.stringify(user)));
        }

        res.status(201).json(user);
    } catch (err) {
        logger.error('Error registering user', err);
        res.status(500).json({ error: 'Registration failed' });
    }
};

router.post('/register', registerHandler);
router.post('/signup', registerHandler); // Alias for frontend compatibility

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
        logger.error('Error logging in', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'dev-jwt-secret-123456'
        );

        const userId = decoded.userId || decoded.id;

        if (!userId) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        const result = await pool.query(
            `
            SELECT id, email, name, created_at
            FROM users
            WHERE id = $1
            `,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = {
            id: result.rows[0].id,
            email: result.rows[0].email,
            name: result.rows[0].name || null,
            firstName: '',
            lastName: '',
            role: 'user',
            isActive: true,
            createdAt: result.rows[0].created_at
        };

        res.json({
            success: true,
            data: user,
            user
        });
    } catch (err) {
        console.error('[AUTH] /me error:', err.message);
        logger.error('Error fetching current user', err);
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
