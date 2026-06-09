const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../lib/db');
const logger = require('../../lib/logger');
const { getChannel } = require('../../lib/rabbitmq');

// POST /api/auth/register
// POST /api/auth/signup
const registerHandler = async (req, res) => {
    const { email, password, name, firstName, lastName } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const fullName =
            name ||
            [firstName, lastName].filter(Boolean).join(' ') ||
            email.split('@')[0];

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `
            INSERT INTO users (email, password_hash, name, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, email, name
            `,
            [email, hashedPassword, fullName]
        );

        const user = result.rows[0];

        try {
            const channel = getChannel();

            if (channel) {
                channel.sendToQueue(
                    'USER_CREATED',
                    Buffer.from(JSON.stringify(user)),
                    { persistent: true }
                );
            } else {
                console.warn('RabbitMQ channel is not available. User registration succeeded without publishing event.');
            }
        } catch (mqError) {
            console.warn('RabbitMQ publish failed, but user registration succeeded:', mqError.message);
        }

        return res.status(201).json(user);
    } catch (err) {
        logger.error('Error registering user', err);

        if (err.code === '23505') {
            return res.status(409).json({ error: 'Email already exists' });
        }

        return res.status(500).json({ error: 'Registration failed' });
    }
};

router.post('/register', registerHandler);
router.post('/signup', registerHandler);

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                id: user.id,
                email: user.email,
                role: user.role || 'user'
            },
            process.env.JWT_SECRET || 'dev-jwt-secret-123456',
            { expiresIn: '1h' }
        );

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role || 'user'
            }
        });
    } catch (err) {
        logger.error('Error logging in', err);
        return res.status(500).json({ error: 'Login failed' });
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

        console.log('[AUTH] /me decoded payload:', decoded);

        const userId = decoded.userId || decoded.id || decoded.sub;

        if (!userId) {
            console.error('[AUTH] /me invalid token payload:', decoded);
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

        return res.json({
            success: true,
            data: user,
            user
        });
    } catch (err) {
        console.error('[AUTH] /me error:', err.message);
        logger.error('Error fetching current user', err);
        return res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
