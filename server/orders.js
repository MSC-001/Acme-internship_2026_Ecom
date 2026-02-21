import express from 'express';
import { authGuard } from './auth.js';
import pool from './dbcon.js';

var router = express.Router();
export default router;

// ====================
// Place an Order (Customer)
// ====================
router.post('/checkout', authGuard, async (req, res) => {
    const { userid, role } = req.user;
    const { delivery_address, payment_method = 'Cash on Delivery' } = req.body;

    if (role !== 'customer') {
        return res.status(403).json({ error: true, message: 'Only customers can checkout' });
    }

    if (!delivery_address) {
        return res.status(400).json({ error: true, message: 'Delivery address is required' });
    }

    const connection = await pool.promise().getConnection();

    try {
        await connection.beginTransaction();

        // 1. Get cart items and calculate total
        const getCartQuery = `
            SELECT c.*, p.price, p.stock, p.vid as vendor_id
            FROM cart c
            JOIN products p ON c.product_id = p.pid
            WHERE c.customer_id = ?
        `;
        
        const [cartItems] = await connection.query(getCartQuery, [userid]);

        if (cartItems.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: true, message: 'Cart is empty' });
        }

        let totalAmount = 0;
        
        // 2. Validate stock for all items
        for (const item of cartItems) {
            if (item.quantity > item.stock) {
                await connection.rollback();
                return res.status(400).json({ error: true, message: "Not enough stock for product ID " + item.product_id });
            }
            totalAmount += (item.quantity * item.price);
        }

        // 3. Create Order
        const insertOrderQuery = 'INSERT INTO orders (customer_id, total_amount, delivery_address, payment_method) VALUES (?, ?, ?, ?)';
        const [orderResult] = await connection.query(insertOrderQuery, [userid, totalAmount, delivery_address, payment_method]);
        const orderId = orderResult.insertId;

        // 4. Create Order Items & Deduct Stock
        for (const item of cartItems) {
            // Insert item
            const insertItemQuery = 'INSERT INTO order_items (order_id, product_id, vendor_id, quantity, price) VALUES (?, ?, ?, ?, ?)';
            await connection.query(insertItemQuery, [orderId, item.product_id, item.vendor_id, item.quantity, item.price]);

            // Deduct stock
            const deductStockQuery = 'UPDATE products SET stock = stock - ? WHERE pid = ?';
            await connection.query(deductStockQuery, [item.quantity, item.product_id]);
        }

        // 5. Clear Cart
        const clearCartQuery = 'DELETE FROM cart WHERE customer_id = ?';
        await connection.query(clearCartQuery, [userid]);

        // 6. Update Customer's default address (optional, but good UX)
        const updateAddressQuery = 'UPDATE users SET address = ? WHERE userid = ? AND address IS NULL';
        await connection.query(updateAddressQuery, [delivery_address, userid]);

        await connection.commit();
        res.status(201).json({ error: false, message: 'Order placed successfully!', orderId });

    } catch (err) {
        await connection.rollback();
        console.error('Checkout error:', err);
        res.status(500).json({ error: true, message: 'Failed to process checkout' });
    } finally {
        connection.release();
    }
});

// ====================
// Get Vendor Orders (Vendor)
// ====================
router.get('/vendor', authGuard, async (req, res) => {
    const { userid, role } = req.user;

    if (role !== 'vendor') {
        return res.status(403).json({ error: true, message: 'Only vendors can view these orders' });
    }

    try {
        const query = `
            SELECT 
                oi.item_id, oi.quantity, oi.price, oi.status, oi.expected_delivery_date,
                o.order_id, o.delivery_address, o.created_at,
                p.pname as product_name, p.pimage as product_image,
                u.username as customer_name
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            JOIN products p ON oi.product_id = p.pid
            JOIN users u ON o.customer_id = u.userid
            WHERE oi.vendor_id = ?
            ORDER BY o.created_at DESC
        `;
        
        const [orders] = await pool.promise().query(query, [userid]);
        res.json({ error: false, orders });

    } catch (err) {
        console.error('Fetch vendor orders error:', err);
        res.status(500).json({ error: true, message: 'Failed to fetch vendor orders' });
    }
});

// ====================
// Update Order Status (Vendor)
// ====================
router.put('/vendor/:itemId/status', authGuard, async (req, res) => {
    const { userid, role } = req.user;
    const { itemId } = req.params;
    const { status, expected_delivery_date } = req.body;

    if (role !== 'vendor') {
        return res.status(403).json({ error: true, message: 'Only vendors can update orders' });
    }

    try {
        // Validate valid status
        const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: true, message: 'Invalid status' });
        }

        // Verify the item belongs to the vendor
        const [item] = await pool.promise().query('SELECT * FROM order_items WHERE item_id = ? AND vendor_id = ?', [itemId, userid]);
        
        if (item.length === 0) {
            return res.status(404).json({ error: true, message: 'Order item not found or unauthorized' });
        }

        let updateQuery = 'UPDATE order_items SET status = ?';
        let queryParams = [status];

        if (expected_delivery_date !== undefined) {
            updateQuery += ', expected_delivery_date = ?';
            // Ensure date is properly formatted or null if empty string
            const formattedDate = expected_delivery_date ? expected_delivery_date : null;
            queryParams.push(formattedDate);
        }
        
        updateQuery += ' WHERE item_id = ?';
        queryParams.push(itemId);

        await pool.promise().query(updateQuery, queryParams);
        
        res.json({ error: false, message: 'Order status updated successfully' });

    } catch (err) {
        console.error('Update order status error:', err);
        res.status(500).json({ error: true, message: 'Failed to update order status' });
    }
});

// ====================
// Get Customer Orders (Customer)
// ====================
router.get('/customer', authGuard, async (req, res) => {
    const { userid, role } = req.user;

    if (role !== 'customer') {
        return res.status(403).json({ error: true, message: 'Only customers can view these orders' });
    }

    try {
        const query = `
            SELECT 
                oi.item_id, oi.quantity, oi.price, oi.status, oi.expected_delivery_date,
                o.order_id, o.delivery_address, o.created_at,
                p.pname as product_name, p.pimage as product_image,
                u.username as vendor_name
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            JOIN products p ON oi.product_id = p.pid
            JOIN users u ON oi.vendor_id = u.userid
            WHERE o.customer_id = ?
            ORDER BY o.created_at DESC
        `;
        
        const [orders] = await pool.promise().query(query, [userid]);
        res.json({ error: false, orders });

    } catch (err) {
        console.error('Fetch customer orders error:', err);
        res.status(500).json({ error: true, message: 'Failed to fetch customer orders' });
    }
});
