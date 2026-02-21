# E-Commerce Application — Acmegrade Internship 2026

A full-stack e-commerce web application built as an internship project assigned by **Acmegrade, India**. Built with vanilla HTML, CSS, and JavaScript on the frontend, and Node.js with Express on the backend. The platform supports two user roles — customers and vendors — each with their own dedicated interface and functionality.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Client Architecture](#client-architecture)
- [Known Limitations](#known-limitations)

---

## Overview

Acme is a prototype e-commerce platform developed as an internship project. It supports two distinct user flows:

- **Vendors** can register, list products with images, manage their inventory, and update the status of incoming orders.
- **Customers** can browse available products, add items to a cart, check out with a saved delivery address, and track their order history.

Authentication is handled via JSON Web Tokens (JWT). Role-based access is enforced on both the server (via middleware) and the client (via token decoding).

---

## Tech Stack

**Frontend**
- Vanilla HTML5, CSS3, JavaScript (ES6+)
- Font Awesome (icon library, CDN)
- No frontend framework or build tool

**Backend**
- Node.js with Express v5
- MySQL 8 via `mysql2` (connection pool)
- JWT (`jsonwebtoken`) for authentication
- `bcrypt` for password hashing
- `multer` for multipart file uploads
- `nodemon` for development auto-restart

---

## Project Structure

```
Acme-internship_2026_Ecom/
│
├── client/                          # Frontend — served statically by Express
│   ├── assets/
│   │   └── img/
│   │       └── defaut_avatar.png    # Default profile avatar fallback
│   │
│   ├── auth/                        # Public (unauthenticated) pages
│   │   ├── css/
│   │   │   ├── login.css
│   │   │   └── signup.css
│   │   ├── login.html
│   │   └── signup.html
│   │
│   ├── customer/                    # Customer-only pages
│   │   ├── home.html                # Browse products
│   │   ├── cart.html                # Shopping cart
│   │   ├── torders.html             # Track orders
│   │   └── style.css
│   │
│   ├── vendor/                      # Vendor-only pages
│   │   ├── home.html                # Add new product
│   │   ├── vproduct.html            # View, edit, delete products
│   │   └── vorders.html             # Manage incoming orders
│   │
│   └── reusable-components/         # Shared across all authenticated pages
│       ├── navbar.js                # Auth guard, header injection, profile dropdown
│       ├── vproduct.js              # Product grid, edit modal, add-to-cart, fly animation
│       ├── edit-profile.html        # Edit profile (shared between roles)
│       ├── edit-profile.css
│       └── home.css                 # Global stylesheet
│
├── server/                          # Backend
│   ├── index.js                     # App entry point, middleware, route mounting
│   ├── auth.js                      # Signup, login, authGuard middleware
│   ├── product.js                   # Product CRUD with image upload
│   ├── cart.js                      # Cart management
│   ├── orders.js                    # Checkout, order tracking, vendor order updates
│   ├── profile.js                   # View and update user profile
│   ├── dbcon.js                     # MySQL connection pool
│   ├── nodemon.json
│   └── package.json
│
└── uploads/                         # Runtime storage for uploaded images (git-ignored)
```

---

## Getting Started

### Prerequisites

- Node.js v18 or later
- MySQL 8 running locally
- A MySQL client (MySQL Workbench, DBeaver, or the CLI)

### 1. Clone the repository

```bash
git clone <repository-url>
cd Acme-internship_2026_Ecom
```

### 2. Set up the database

Open your MySQL client and run the following:

```sql
CREATE DATABASE `acme-internship`;
USE `acme-internship`;

CREATE TABLE users (
    userid       INT AUTO_INCREMENT PRIMARY KEY,
    username     VARCHAR(100) NOT NULL,
    email        VARCHAR(150) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    role         ENUM('customer', 'vendor') NOT NULL,
    address      TEXT,
    profile_image VARCHAR(255)
);

CREATE TABLE products (
    pid          INT AUTO_INCREMENT PRIMARY KEY,
    vid          INT NOT NULL,
    pname        VARCHAR(200) NOT NULL,
    pdes         TEXT,
    price        DECIMAL(10, 2) NOT NULL,
    stock        INT NOT NULL DEFAULT 0,
    pimage       VARCHAR(255),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vid) REFERENCES users(userid)
);

CREATE TABLE cart (
    cart_id      INT AUTO_INCREMENT PRIMARY KEY,
    customer_id  INT NOT NULL,
    product_id   INT NOT NULL,
    quantity     INT NOT NULL DEFAULT 1,
    FOREIGN KEY (customer_id) REFERENCES users(userid),
    FOREIGN KEY (product_id)  REFERENCES products(pid)
);

CREATE TABLE orders (
    order_id         INT AUTO_INCREMENT PRIMARY KEY,
    customer_id      INT NOT NULL,
    total_amount     DECIMAL(10, 2) NOT NULL,
    delivery_address TEXT NOT NULL,
    payment_method   VARCHAR(100),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(userid)
);

CREATE TABLE order_items (
    item_id                INT AUTO_INCREMENT PRIMARY KEY,
    order_id               INT NOT NULL,
    product_id             INT NOT NULL,
    vendor_id              INT NOT NULL,
    quantity               INT NOT NULL,
    price                  DECIMAL(10, 2) NOT NULL,
    status                 ENUM('Pending', 'Shipped', 'Delivered', 'Cancelled') DEFAULT 'Pending',
    expected_delivery_date DATE,
    FOREIGN KEY (order_id)   REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(pid),
    FOREIGN KEY (vendor_id)  REFERENCES users(userid)
);
```

### 3. Configure the server

The following values are hardcoded in server source files. Update them to match your local environment before running:

| File | Variable | Default |
|---|---|---|
| `server/dbcon.js` | `host` | `localhost` |
| `server/dbcon.js` | `port` | `3306` |
| `server/dbcon.js` | `user` | `root` |
| `server/dbcon.js` | `password` | `""` (empty) |
| `server/dbcon.js` | `database` | `acme-internship` |
| `server/auth.js` | JWT secret | `MSC001` |

### 4. Install dependencies and start the server

```bash
cd server
npm install
npm start
```

The server starts on `http://localhost:3000`.

### 5. Open the app

Navigate to `http://localhost:3000/auth/login.html` in your browser.

---

## Database Schema

```
users
  userid, username, email, password, role, address, profile_image

products
  pid, vid (FK users), pname, pdes, price, stock, pimage, created_at

cart
  cart_id, customer_id (FK users), product_id (FK products), quantity

orders
  order_id, customer_id (FK users), total_amount, delivery_address,
  payment_method, created_at

order_items
  item_id, order_id (FK orders), product_id (FK products),
  vendor_id (FK users), quantity, price, status, expected_delivery_date
```

---

## API Reference

All protected routes require the header:
```
Authorization: Bearer <token>
```

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Register a new user. Body: `{ username, email, password, cPassword, role }` |
| POST | `/api/auth/login` | No | Login. Body: `{ username, password }`. Returns a signed JWT valid for 1 hour. |

### Products — `/api/products`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/products/add` | Yes | Vendor | Add a product. Multipart form-data: `pname, pdes, price, stock, pimage` |
| GET | `/api/products/view` | Yes | Both | Vendors see their own products. Customers see all in-stock products. |
| PUT | `/api/products/edit/:id` | Yes | Vendor | Update a product. Optional new image replaces and deletes the old one. |
| DELETE | `/api/products/delete/:id` | Yes | Vendor | Delete a product and its image from disk. |

### Cart — `/api/cart`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/cart/add` | Yes | Customer | Add item to cart. Body: `{ pid, qty }`. Increments if already in cart. |
| GET | `/api/cart/view` | Yes | Customer | Fetch all cart items with product and vendor details. |
| PUT | `/api/cart/update/:cart_id` | Yes | Customer | Update item quantity. Validated against available stock. |
| DELETE | `/api/cart/remove/:cart_id` | Yes | Customer | Remove an item from the cart. |

### Orders — `/api/orders`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/orders/checkout` | Yes | Customer | Place an order. Runs a full MySQL transaction: validates stock, creates order and order_items, deducts stock, clears cart. |
| GET | `/api/orders/customer` | Yes | Customer | Fetch order history for the logged-in customer. |
| GET | `/api/orders/vendor` | Yes | Vendor | Fetch all orders containing the vendor's products. |
| PUT | `/api/orders/vendor/:itemId/status` | Yes | Vendor | Update order item status and expected delivery date. |

### Profile — `/api/profile`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/profile/view` | Yes | Both | Fetch the logged-in user's profile. |
| PUT | `/api/profile/update` | Yes | Both | Update username, address, and/or profile image. Old image is deleted on replacement. |

---

## Client Architecture

**Authentication flow**

Every authenticated page loads `navbar.js` which runs `getUserFromToken()` on page load. It reads the JWT from `sessionStorage`, decodes the payload client-side, and redirects to `/auth/login.html` if the token is missing or malformed. The server independently verifies the token signature on every API request via the `authGuard` middleware.

**Role-based rendering**

The navigation menu and product card actions are rendered dynamically based on the `role` field in the decoded token. Vendors see Edit and Delete buttons on product cards; customers see an Add to Cart button with a quantity input.

**Shared components**

- `navbar.js` — injected into every authenticated page. Renders the header, handles logout, profile dropdown, and fetches the user's avatar from `/api/profile/view` on load.
- `vproduct.js` — powers the product grid on both `customer/home.html` and `vendor/vproduct.html`. Handles product rendering, the edit modal (vendor), delete (vendor), add-to-cart (customer), and the fly-to-cart animation.

**Fly-to-cart animation**

When a customer adds a product to the cart, a cloned image of the product animates from the product card to the cart icon in the navbar using CSS transitions and `requestAnimationFrame`. The cart icon plays a bounce animation when the clone arrives.

**File uploads**

Product and profile images are uploaded as multipart form-data, stored on disk in the `uploads/` directory, and served at `/uploads/<filename>`. The server validates file type and enforces a 5 MB size limit.

---

## Known Limitations

- **No environment variables.** The JWT secret and all database credentials are hardcoded in source files. These must be moved to a `.env` file before any team or production use.
- **Client-side JWT decoding is not a security mechanism.** The `role` and user data decoded by `navbar.js` are used only for UI rendering. All sensitive operations are validated server-side via `authGuard`.
- **No HTTPS.** The app runs over plain HTTP. A reverse proxy (e.g. Nginx) with TLS is required before any public deployment.
- **Hardcoded API base URL.** All `fetch()` calls in the client point to `http://localhost:3000`. This must be updated or made configurable before deploying to a remote server.
- **No pagination.** All products and orders are fetched in a single query with no limit. This will degrade at scale.
- **Payment is a stub.** The checkout flow hardcodes `"Cash on Delivery"` as the payment method. No payment gateway is integrated.
