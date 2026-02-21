import express from 'express';
import { authGuard } from './auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from './dbcon.js';

var router = express.Router();
export default router;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads');

// Reusing Multer setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const usfx = Date.now() + '-' + Math.round(Math.random() * 1E4);
        cb(null, 'profile-' + usfx + file.originalname + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const itypes = /jpeg|jpg|png|gif|webp|bmp/;
        const extname = itypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = itypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('only images files are allowed'));
        }
    }
});

// ====================
// Get Profile
// ====================
router.get('/view', authGuard, (req, res) => {
    const { userid } = req.user;

    const query = 'SELECT username, email, address, profile_image FROM users WHERE userid = ?';
    pool.query(query, [userid], (err, results) => {
        if (err) return res.status(500).json({ error: true, message: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: true, message: 'User not found' });
        
        res.json({ error: false, data: results[0] });
    });
});

// ====================
// Update Profile
// ====================
router.put('/update', authGuard, upload.single('profile_image'), (req, res) => {
    const { userid } = req.user;
    const { username, address } = req.body;

    if (!username) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: true, message: 'Username is required' });
    }

    // First get old profile image to delete it if a new one is uploaded
    pool.query('SELECT profile_image FROM users WHERE userid = ?', [userid], (err, results) => {
        if (err) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(500).json({ error: true, message: 'Database error' });
        }

        const oldImage = results[0].profile_image;
        let updateQuery;
        let queryParams;

        if (req.file) {
            updateQuery = 'UPDATE users SET username = ?, address = ?, profile_image = ? WHERE userid = ?';
            queryParams = [username, address || null, req.file.filename, userid];
        } else {
            updateQuery = 'UPDATE users SET username = ?, address = ? WHERE userid = ?';
            queryParams = [username, address || null, userid];
        }

        pool.query(updateQuery, queryParams, (err) => {
            if (err) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(500).json({ error: true, message: 'Error updating profile' });
            }

            // Delete old image if it wasn't the default one
            if (req.file && oldImage && oldImage !== 'default-avatar.png') {
                const oldImagePath = path.join(uploadDir, oldImage);
                if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
            }

            // Optional: return new token since username might be in the payload
            res.json({ error: false, message: 'Profile updated successfully!' });
        });
    });
});
