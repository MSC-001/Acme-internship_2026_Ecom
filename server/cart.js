import express from 'express';
import { authGuard } from './auth.js';
import pool from './dbcon.js';

var router = express.Router();
export default router;

// ====================
// Add to Cart
// ====================
router.post('/add', authGuard, (req, res) => {
    const { userid, role } = req.user;
    const { pid, qty } = req.body;

    if (role !== 'customer') {
        return res.status(403).json({ error: true, message: 'Only customers can add to cart' });
    }

    if (!pid || !qty || qty < 1) {
        return res.status(400).json({ error: true, message: 'Invalid product or quantity' });
    }

    // 1. Check if product exists and has enough stock
    const checkStockQuery = 'SELECT stock, pname FROM products WHERE pid = ?';
    pool.query(checkStockQuery, [pid], (err, productResult) => {
        if (err) return res.status(500).json({ error: true, message: 'Database error' });
        if (productResult.length === 0) return res.status(404).json({ error: true, message: 'Product not found' });
        
        const availableStock = productResult[0].stock;
        if (qty > availableStock) {
            return res.status(400).json({ error: true, message: `Only ${availableStock} items available in stock` });
        }

        // 2. Check if item already exists in cart for this user
        const checkCartQuery = 'SELECT * FROM cart WHERE customer_id = ? AND product_id = ?';
        pool.query(checkCartQuery, [userid, pid], (err, cartResult) => {
            if (err) return res.status(500).json({ error: true, message: 'Database error' });

            if (cartResult.length > 0) {
                // Item exists, update quantity
                const existingQty = cartResult[0].quantity;
                const newQty = existingQty + qty;

                // Make sure combined quantity doesn't exceed stock
                if (newQty > availableStock) {
                    return res.status(400).json({ error: true, message: `Cannot add ${qty} more. You already have ${existingQty} in cart, and only ${availableStock} are in stock.` });
                }

                const updateQuery = 'UPDATE cart SET quantity = ? WHERE customer_id = ? AND product_id = ?';
                pool.query(updateQuery, [newQty, userid, pid], (err) => {
                    if (err) return res.status(500).json({ error: true, message: 'Error updating cart' });
                    res.json({ error: false, message: 'Cart updated successfully' });
                });
            } else {
                // Item doesn't exist, insert new row
                const insertQuery = 'INSERT INTO cart (customer_id, product_id, quantity) VALUES (?, ?, ?)';
                pool.query(insertQuery, [userid, pid, qty], (err) => {
                    if (err) return res.status(500).json({ error: true, message: 'Error adding to cart' });
                    res.status(201).json({ error: false, message: 'Added to cart successfully' });
                });
            }
        });
    });
});

// ====================
// Get Cart Items
// ====================
router.get('/view', authGuard, (req, res) => {
    const { userid, role } = req.user;

    if (role !== 'customer') {
        return res.status(403).json({ error: true, message: 'Only customers can view cart' });
    }

    const getCartQuery = `
        SELECT c.cart_id, c.quantity, p.pid, p.pname, p.price, p.pimage, p.stock, u.username as vendor_name
        FROM cart c
        JOIN products p ON c.product_id = p.pid
        LEFT JOIN users u ON p.vid = u.userid
        WHERE c.customer_id = ?
    `;

    pool.query(getCartQuery, [userid], (err, results) => {
        if (err) {
            console.error('Error fetching cart:', err);
            return res.status(500).json({ error: true, message: 'Error fetching cart' });
        }
        
        res.json({
            error: false,
            count: results.length,
            data: results
        });
    });
});

// ====================
// Update Cart Item Quantity
// ====================
router.put('/update/:cart_id', authGuard, (req, res) => {
    const { userid, role } = req.user;
    const { cart_id } = req.params;
    const { qty } = req.body;

    if (role !== 'customer') {
        return res.status(403).json({ error: true, message: 'Only customers can update cart' });
    }

    if (!qty || qty < 1) {
        return res.status(400).json({ error: true, message: 'Invalid quantity' });
    }

    // First check if cart item belongs to user and check product stock
    const checkQuery = `
        SELECT c.*, p.stock 
        FROM cart c
        JOIN products p ON c.product_id = p.pid
        WHERE c.cart_id = ? AND c.customer_id = ?
    `;

    pool.query(checkQuery, [cart_id, userid], (err, results) => {
        if (err) return res.status(500).json({ error: true, message: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: true, message: 'Cart item not found' });

        const availableStock = results[0].stock;
        
        if (qty > availableStock) {
            return res.status(400).json({ error: true, message: `Only ${availableStock} items available in stock` });
        }

        const updateQuery = 'UPDATE cart SET quantity = ? WHERE cart_id = ?';
        pool.query(updateQuery, [qty, cart_id], (err) => {
            if (err) return res.status(500).json({ error: true, message: 'Error updating cart' });
            res.json({ error: false, message: 'Cart updated successfully' });
        });
    });
});

// ====================
// Remove from Cart
// ====================
router.delete('/remove/:cart_id', authGuard, (req, res) => {
    const { userid, role } = req.user;
    const { cart_id } = req.params;

    if (role !== 'customer') {
        return res.status(403).json({ error: true, message: 'Only customers can modify cart' });
    }

    const deleteQuery = 'DELETE FROM cart WHERE cart_id = ? AND customer_id = ?';
    pool.query(deleteQuery, [cart_id, userid], (err, results) => {
        if (err) return res.status(500).json({ error: true, message: 'Error removing item from cart' });
        
        if (results.affectedRows === 0) {
            return res.status(404).json({ error: true, message: 'Cart item not found' });
        }
        
        res.json({ error: false, message: 'Item removed from cart' });
    });
});
