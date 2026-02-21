import express from 'express';
import pool from './dbcon.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

var router = express.Router();
export default router;
export { authGuard };

const JWT_SECRET = "MSC001";

router.post('/signup', (req, res) => {
    const { username, email, password, role } = req.body;
    console.log("signup body", req.body);

    // Validate input fields
    if (!username || !email || !password || !role) {
        res.status(400).json({ error: true, message: 'Missing required fields' });
        return;
    }

    // Check if email already exists
    const checkEmailSql = 'SELECT userid FROM users WHERE email = ?';
    pool.query(checkEmailSql, [email], async (err, checkResult) => {
        if (err) {
            console.error('Error checking email:', err);
            res.status(500).json({ error: true, message: 'Something went wrong...' });
            return;
        }

        if (checkResult.length > 0) {
            res.status(400).json({ error: true, message: 'Email already exists' });
            return;
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("Generated Hash:", hashedPassword);

        //register to db user with hashed password
        const sql = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
        const values = [username, email, hashedPassword, role];

        pool.query(sql, values, (err, dbresponse) => {
            if (err) {
                console.error('Error inserting user:', err);
                res.status(500).json({ error: true, message: 'Something went wrong...' });
                return;
            }
            res.status(201).json({ error: false, message: 'SignUp successful', user: dbresponse });
        });
    });
});


router.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log("login body", req.body);

    // Validate input fields
    if (!username || !password) {
        return res.status(400).json({
            error: true,
            message: 'Missing required fields'
        });
    }

    // Get user by username to retrieve the stored hash
    const sql = 'select userid, username, email, password, role from users where username = ?';
    const values = [username];

    pool.query(sql, values, async (err, dbresponse) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({
                error: true,
                message: 'Something went wrong...'
            });
        }

        if (dbresponse.length === 0) {
            return res.status(401).json({
                error: true,
                message: 'Invalid credentials'
            });
        }

        const user = dbresponse[0];
        console.log("Full User from DB (Testing):", user);

        // Compare the provided password with the stored hash
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({
                error: true,
                message: 'Invalid credentials'
            });
        }

        //jwt token generation
        const payload = {
            userid: user.userid,
            username: user.username,
            email: user.email,
            role: user.role,
        };
        jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) {
                console.error('Error generating token:', err);
                return res.status(500).json({
                    error: true,
                    message: 'Something went wrong...'
                });
            }
            res.status(201).json({
                error: false,
                message: 'Login successful',
                token: token,
                payload: payload
            });
        });
    })
});

function authGuard(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from Authorization header
    if (!token) {
        return res.status(401).json({
            error: true,
            message: "Access denied. No token provided."
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                error: true,
                message: "Invalid or expired token."
            });
        }
        console.log("Decoded Token Payload:", decoded);
        req.user = decoded;
        next();
    });
}
