const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

router.get('/register', (req, res) => {
    res.render('register', { errors: [] });
});

router.post(
    '/register',
    body('email').trim().isEmail().withMessage('Enter a valid email'),
    body('password').trim().isLength({ min: 5 }).withMessage('Password must be at least 5 characters'),
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('register', { errors: errors.array() });
        }

        const { email, username, password } = req.body;

        try {
            const hashPassword = await bcrypt.hash(password, 10);
            await userModel.create({
                email,
                username,
                password: hashPassword,
            });

            res.redirect('/user/login');
        } catch (err) {
            res.status(500).render('register', {
                errors: [{ msg: 'User already exists or database error' }],
            });
        }
    }
);

router.get('/login', (req, res) => {
    res.render('login', { errors: [] });
});

router.post(
    '/login',
    body('username').trim().isLength({ min: 3 }),
    body('password').trim().isLength({ min: 5 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('login', { errors: errors.array() });
        }

        const { username, password } = req.body;
        const user = await userModel.findOne({ username });

        if (!user) {
            return res.status(400).render('login', {
                errors: [{ msg: 'Username or password is incorrect' }],
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).render('login', {
                errors: [{ msg: 'Username or password is incorrect' }],
            });
        }

        const token = jwt.sign(
            {
                userId: user._id,
                email: user.email,
                username: user.username,
            },
            process.env.JWT_SECRET
        );

        res.cookie('token', token);
        res.redirect('/home');
    }
);

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

module.exports = router;
