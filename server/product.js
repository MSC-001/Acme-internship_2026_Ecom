import express from 'express';
import { authGuard } from './auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pool from './dbcon.js';

var router = express.Router();
export default router;

//needed for modulejs
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//upload directory
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ====================
// Multer image filter
// ====================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const usfx = Date.now() + '-' + Math.round(Math.random() * 1E4);
        const vid = req.user ? req.user.vid : 'unknown';
        cb(null, 'product-' + usfx + file.originalname + path.extname(file.originalname));
    }
});

// ====================
// Multer image filter
// ====================
const ff = (req, file, cb) => {
    console.log("Multer processing file:", file);
    if (!file || !file.originalname) {
        return cb(new Error('Invalid file object'));
    }
    const itypes = /jpeg|jpg|png|gif|webp|bmp/;
    const extname = itypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = itypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('only images files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: ff
});

// ====================
// Add Product
// ====================
router.post('/add', authGuard, upload.single('pimage'), (req, res) => {
    console.log('product body:', req.body)
    console.log('file:', req.file)
    const { userid } = req.user; // Get the user ID from the authenticated user token

    if (!req.file) {
        return res.status(400).json({
            error: true,
            message: 'No image uploaded'
        })
    }

    const { pname, pdes, price, stock } = req.body;
    //validate fileds
    if (!pname || !pdes || !price || !stock) {
        fs.unlinkSync(req.file.path); // Delete uploaded file
        return res.status(400).json({
            error: true,
            message: 'All fields required'
        });
    }
    const pimage = req.file.filename; //only filename

    const dbquery = 'INSERT INTO products (vid, pname, pdes, price, stock, pimage) VALUES (?, ?, ?, ?, ?, ?)';
    const dbvalues = [userid, pname, pdes, price, stock, pimage];

    pool.query(dbquery, dbvalues, (err, dbresponse) => {
        if (err) {
            console.error('Error inserting product:', err);
            fs.unlinkSync(req.file.path);
            return res.status(201).json({
                error: true,
                message: 'Error inserting product'
            });
        }
        res.status(201).json({
            error: false,
            message: 'Product added successfully!',
            result: dbresponse
        });
    });

});

// Error handle for filesize
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: true,
                message: 'File too large! Max 5MB'
            });
        }
    }
    if (err) {
        return res.status(400).json({
            error: true,
            message: err.message
        });
    }
    next();
});

router.get('/view', authGuard, (req, res) => {
    const { userid, role } = req.user;

    let dbquery;
    let dbvalues;

    if (role === 'vendor') {
        // Vendor sees only their products
        dbquery = `
            SELECT p.*, u.username as vendor_name 
            FROM products p 
            LEFT JOIN users u ON p.vid = u.userid 
            WHERE p.vid = ? 
            ORDER BY p.created_at DESC
        `;
        dbvalues = [userid];
    } else if (role === 'customer') {
        // Customer sees all products with stock > 0
        dbquery = `
            SELECT p.*, u.username as vendor_name 
            FROM products p 
            LEFT JOIN users u ON p.vid = u.userid 
            WHERE p.stock > 0 
            ORDER BY p.created_at DESC
        `;
        dbvalues = [];
    } else {
        return res.status(403).json({
            error: true,
            message: 'Invalid role'
        });
    }

    pool.query(dbquery, dbvalues, (err, products) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).json({
                error: true,
                message: 'Error fetching products'
            });
        }

        res.json({
            error: false,
            count: products.length,
            data: products
        });
    });
});

// ====================
// Edit product
// ====================
router.put('/edit/:id', authGuard, upload.single('pimage'), (req, res) => {
    const { userid, role } = req.user;
    const productId = req.params.id;
    const { pname, pdes, price, stock } = req.body;

    // Only vendors can edit
    if (role !== 'vendor') {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({
            error: true,
            message: 'Only vendors can edit products'
        });
    }

    // Validate fields
    if (!pname || !pdes || !price || !stock) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
            error: true,
            message: 'All fields required'
        });
    }

    //product belongs to vendor
    const checkQuery = 'SELECT * FROM products WHERE pid = ? AND vid = ?';

    pool.query(checkQuery, [productId, userid], (err, result) => {
        if (err) {
            console.error('Error checking product:', err);
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(500).json({
                error: true,
                message: 'Error checking product'
            });
        }

        if (result.length === 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({
                error: true,
                message: 'Product not found or you do not have permission'
            });
        }

        const oldImage = result[0].pimage;
        let updateQuery;
        let queryParams;

        if (req.file) {
            updateQuery = 'UPDATE products SET pname = ?, pdes = ?, price = ?, stock = ?, pimage = ? WHERE pid = ?';
            queryParams = [pname, pdes, price, stock, req.file.filename, productId];
        } else {
            updateQuery = 'UPDATE products SET pname = ?, pdes = ?, price = ?, stock = ? WHERE pid = ?';
            queryParams = [pname, pdes, price, stock, productId];
        }

        pool.query(updateQuery, queryParams, (err, updateResult) => {
            if (err) {
                console.error('Error updating product:', err);
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(500).json({
                    error: true,
                    message: 'Error updating product'
                });
            }

            // If a new image was uploaded, delete the old image to save space
            if (req.file && oldImage) {
                const oldImagePath = path.join(uploadDir, oldImage);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            res.json({
                error: false,
                message: 'Product updated successfully!'
            });
        });
    });
});

// ====================
// Delete product
// ====================
router.delete('/delete/:id', authGuard, (req, res) => {
    const { userid, role } = req.user;
    const productId = req.params.id;

    // Only vendors can delete
    if (role !== 'vendor') {
        return res.status(403).json({
            error: true,
            message: 'Only vendors can delete products'
        });
    }

    // Check if product belongs to vendor and get image filename
    const checkQuery = 'SELECT * FROM products WHERE pid = ? AND vid = ?';

    pool.query(checkQuery, [productId, userid], (err, result) => {
        if (err) {
            console.error('Error checking product:', err);
            return res.status(500).json({
                error: true,
                message: 'Error checking product'
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                error: true,
                message: 'Product not found or you do not have permission'
            });
        }

        const product = result[0];
        const imagePath = path.join(uploadDir, product.pimage);

        // Delete from database
        const deleteQuery = 'DELETE FROM products WHERE pid = ?';

        pool.query(deleteQuery, [productId], (err, deleteResult) => {
            if (err) {
                console.error('Error deleting product:', err);
                return res.status(500).json({
                    error: true,
                    message: 'Error deleting product'
                });
            }

            // Delete image file
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

            res.json({
                error: false,
                message: 'Product deleted successfully!'
            });
        });
    });
});
