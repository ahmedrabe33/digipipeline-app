const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../../lib/db');
const logger = require('../../lib/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-123456';

const extractToken = (req) => {
    const authHeader = req.headers.authorization || '';

    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    return authHeader;
};

const authenticate = (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = {
            id: decoded.userId || decoded.id,
            email: decoded.email,
            role: decoded.role || 'user'
        };

        if (!req.user.id) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        next();
    } catch (err) {
        console.error('[USERS] Auth error:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const splitName = (name) => {
    const safeName = name || '';
    const parts = safeName.trim().split(/\s+/).filter(Boolean);

    return {
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || ''
    };
};

const formatUser = (user) => {
    const names = splitName(user.name);

    return {
        id: user.id,
        email: user.email,
        name: user.name || null,
        firstName: names.firstName,
        lastName: names.lastName,
        role: 'user',
        isActive: true,
        createdAt: user.created_at
    };
};

// GET /api/users
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT id, email, name, created_at
            FROM users
            ORDER BY created_at DESC
            `
        );

        const users = result.rows.map(formatUser);

        res.json({
            success: true,
            data: {
                users
            }
        });
    } catch (err) {
        console.error('[USERS] List users error:', err.message);
        logger.error('Error fetching users', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// GET /api/users/profile
router.get('/profile', authenticate, async (req, res) => {
    try {
        console.log('[USERS] Profile request userId:', req.user.id);

        const result = await pool.query(
            `
            SELECT id, email, name, created_at
            FROM users
            WHERE id = $1
            `,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = formatUser(result.rows[0]);

        res.json({
            success: true,
            data: user,
            user
        });
    } catch (err) {
        console.error('[USERS] Profile error:', err.message);
        logger.error('Error fetching profile', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// PUT /api/users/profile
router.put('/profile', authenticate, async (req, res) => {
    try {
        const { name, firstName, lastName } = req.body;

        const displayName =
            name ||
            [firstName, lastName].filter(Boolean).join(' ') ||
            null;

        const result = await pool.query(
            `
            UPDATE users
            SET name = $1
            WHERE id = $2
            RETURNING id, email, name, created_at
            `,
            [displayName, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = formatUser(result.rows[0]);

        res.json({
            success: true,
            data: user,
            user
        });
    } catch (err) {
        console.error('[USERS] Update profile error:', err.message);
        logger.error('Error updating profile', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT id, email, name, created_at
            FROM users
            WHERE id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = formatUser(result.rows[0]);

        res.json({
            success: true,
            data: user,
            user
        });
    } catch (err) {
        console.error('[USERS] Get user error:', err.message);
        logger.error('Error fetching user', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// POST /api/users
router.post('/', async (req, res) => {
    const { email, password, name, firstName, lastName } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const displayName =
            name ||
            [firstName, lastName].filter(Boolean).join(' ') ||
            null;

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `
            INSERT INTO users (email, password_hash, name, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, email, name, created_at
            `,
            [email.toLowerCase(), hashedPassword, displayName]
        );

        const user = formatUser(result.rows[0]);

        res.status(201).json({
            success: true,
            data: user,
            user
        });
    } catch (err) {
        console.error('[USERS] Create user error:', err.message);
        logger.error('Error creating user', err);

        if (err.code === '23505') {
            return res.status(409).json({ error: 'Email already exists' });
        }

        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { email, name, firstName, lastName } = req.body;

    try {
        const displayName =
            name ||
            [firstName, lastName].filter(Boolean).join(' ') ||
            null;

        const result = await pool.query(
            `
            UPDATE users
            SET email = COALESCE($1, email),
                name = COALESCE($2, name)
            WHERE id = $3
            RETURNING id, email, name, created_at
            `,
            [email ? email.toLowerCase() : null, displayName, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = formatUser(result.rows[0]);

        res.json({
            success: true,
            data: user,
            user
        });
    } catch (err) {
        console.error('[USERS] Update user error:', err.message);
        logger.error('Error updating user', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (err) {
        console.error('[USERS] Delete user error:', err.message);
        logger.error('Error deleting user', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;