// Check roles
function getUserRole() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        window.location.href = '/auth/login.html';
        return null;
    }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.role;
    } catch (error) {
        console.error('Error decoding token:', error);
        sessionStorage.clear();
        window.location.href = '/auth/login.html';
        return null;
    }
}

// ====================
// Load Products
// =======================
async function loadProducts() {
    const token = sessionStorage.getItem('token');
    const productsList = document.getElementById('productsList');

    // If there's no productsList on this page (e.g. cart page includes vproduct.js), just exit silently
    if (!productsList) return;

    const userRole = getUserRole();

    if (!token || !userRole) {
        window.location.href = '/auth/login.html';
        return;
    }

    // Set page title based on role
    const pageTitleEl = document.getElementById('pageTitle');
    if (pageTitleEl) {
        pageTitleEl.textContent = userRole === 'vendor' ? 'My Products' : 'Browse Products';
    }

    try {
        const response = await fetch('http://localhost:3000/api/products/view', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!result.error && result.data) {
            if (result.data.length === 0) {
                productsList.innerHTML = userRole === 'vendor'
                    ? `<p class="no-products">No products found...<br>Start adding products!</p>`
                    : '<p class="no-products">No products available at the moment.</p>';
                return;
            }

            // Dynamic rendering based on role
            productsList.innerHTML = result.data.map(product => {
                let card = `
                            <div class="product-card">
                                <img src="http://localhost:3000/uploads/${product.pimage}" 
                                     alt="${product.pname}"
                                     onerror="this.src='https://via.placeholder.com/250?text=No+Image'">
                                <div class="product-info">
                                    <h3>${product.pname}</h3>
                                    <p class="product-description">${product.pdes}</p>
                                    <div class="product-details">
                                        <span class="product-price">₹${parseFloat(product.price).toFixed(2)}</span>
                                        <span class="product-stock ${product.stock < 10 ? 'low-stock' : ''}">               
                                            ${userRole === 'vendor' ? `Stock: ${product.stock}` :
                        product.stock > 0 ? `In Stock: ${product.stock}` : 'Out of Stock'}
                                        </span>
                                    </div>
                        `;

                // vendor: Show Edit/Delete buttons
                if (userRole === 'vendor') {
                    card += `
                                    <div class="product-actions">
                                        <button class="btn-edit" onclick="openEditModal(${product.pid}, '${product.pname.replace(/'/g, "\\'")}', '${product.pdes.replace(/'/g, "\\'")}', ${product.price}, ${product.stock})">
                                            <i class="fa-solid fa-pen-to-square"></i> Edit
                                        </button>
                                        <button class="btn-delete" onclick="deleteProduct(${product.pid}, '${product.pname.replace(/'/g, "\\'")}')">
                                            <i class="fa-solid fa-trash"></i> Delete
                                        </button>
                                    </div>
                            `;
                }
                // Customer: Show vendor name and Add to Cart button
                else if (userRole === 'customer') {
                    card += `
                                    <p class="vendor-name">
                                        <i class="fa-solid fa-store"></i> Sold by : ${product.vendor_name || 'Unknown'}
                                    </p>
                                    <div class="product-actions">
                                        ${product.stock > 0 ? `
                                            <div class="qty-container" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                                <label for="qty-${product.pid}" style="font-size: 0.9em; color: #555; font-weight: bold;">Qty:</label>
                                                <input type="number" id="qty-${product.pid}" value="1" min="1" max="${product.stock}" style="width: 60px; padding: 5px; border-radius: 4px; text-align: center;">
                                            </div>
                                            <button class="btn-cart" onclick="addToCart(${product.pid}, '${product.pname.replace(/'/g, "\'")}', ${product.stock})">
                                                <i class="fa-solid fa-cart-plus"></i> Add to Cart
                                            </button>
                                        ` : `
                                            <button class="btn-cart" disabled style="opacity: 0.5; cursor: not-allowed;">
                                                <i class="fa-solid fa-ban"></i> Out of Stock
                                            </button>
                                        `}
                                    </div>
                            `;
                }

                card += `
                                </div>
                            </div>
                        `;

                return card;
            }).join('');
        } else {
            productsList.innerHTML = '<p class="no-products">Error loading products</p>';
        }
    } catch (error) {
        console.error('Error loading products:', error);
        productsList.innerHTML = '<p class="no-products">Error loading products</p>';
    }
}

// =============
// Edit product
// =============
function openEditModal(pid, pname, pdes, price, stock) {
    if (getUserRole() !== 'vendor') {
        alert('Access denied');
        return;
    }

    document.getElementById('editProductId').value = pid;
    document.getElementById('editPname').value = pname;
    document.getElementById('editPdes').value = pdes;
    document.getElementById('editPrice').value = price;
    document.getElementById('editStock').value = stock;
    document.getElementById('editPimage').value = '';

    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
}

async function saveEdit() {
    if (getUserRole() !== 'vendor') {
        alert('Access denied');
        return;
    }

    const pid = document.getElementById('editProductId').value;
    const pname = document.getElementById('editPname').value;
    const pdes = document.getElementById('editPdes').value;
    const price = document.getElementById('editPrice').value;
    const stock = document.getElementById('editStock').value;
    const imageFile = document.getElementById('editPimage').files[0];

    if (!pname || !pdes || !price || !stock) {
        alert('All fields are required!');
        return;
    }

    const token = sessionStorage.getItem('token');

    try {
        const formData = new FormData();
        formData.append('pname', pname);
        formData.append('pdes', pdes);
        formData.append('price', price);
        formData.append('stock', stock);
        if (imageFile) {
            formData.append('pimage', imageFile);
        }

        const response = await fetch(`http://localhost:3000/api/products/edit/${pid}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const result = await response.json();

        if (!result.error) {
            alert('Product updated successfully!');
            closeEditModal();
            loadProducts();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error updating product:', error);
        alert('Error updating product');
    }
}

// ============================
// Delete product (Vendor Only)
// =============================
async function deleteProduct(pid, pname) {
    if (getUserRole() !== 'vendor') {
        alert('Access denied');
        return;
    }

    if (!confirm(`Are you sure you want to delete "${pname}"?`)) {
        return;
    }

    const token = sessionStorage.getItem('token');

    try {
        const response = await fetch(`http://localhost:3000/api/products/delete/${pid}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!result.error) {
            alert('Product deleted successfully!');
            loadProducts();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product');
    }
}

// ============================
// ADD TO CART (Customer Only)
// ============================
async function addToCart(pid, pname, maxStock) {
    if (getUserRole() !== 'customer') {
        alert('Access denied');
        return;
    }

    const qtyInput = document.getElementById('qty-' + pid);
    const qty = parseInt(qtyInput.value);

    if (isNaN(qty) || qty < 1) {
        alert('Please enter a valid quantity.');
        return;
    }

    if (qty > maxStock) {
        alert(`Sorry, you cannot add more than ${maxStock} items to your cart.`);
        return;
    }

    const token = sessionStorage.getItem('token');
    if (!token) {
        window.location.href = '/auth/login.html';
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/cart/add', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pid: pid, qty: qty })
        });

        const result = await response.json();

        if (!result.error) {
            flyToCart(pid);
            qtyInput.value = 1;
            qtyInput.blur();
            alert(`Successfully added ${qty} x "${pname}" to cart!`);
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Error adding to cart. Please check console.');
    }
}

window.addEventListener('DOMContentLoaded', loadProducts);

function flyToCart(pid) {
    const cartIcon = document.getElementById('nav-cart-icon');
    const productImg = document.querySelector(`#cart-item-${pid} img, .product-card img`);

    // find the correct product card image by pid
    const allCards = document.querySelectorAll('.product-card');
    let sourceImg = null;
    allCards.forEach(card => {
        const btn = card.querySelector(`[onclick*="addToCart(${pid},"]`);
        if (btn) sourceImg = card.querySelector('img');
    });

    if (!sourceImg || !cartIcon) return;

    const srcRect = sourceImg.getBoundingClientRect();
    const destRect = cartIcon.getBoundingClientRect();

    // create flying clone
    const fly = document.createElement('img');
    fly.src = sourceImg.src;
    fly.className = 'fly-img';
    fly.style.left = srcRect.left + srcRect.width / 2 - 30 + 'px';
    fly.style.top = srcRect.top + srcRect.height / 2 - 30 + 'px';
    document.body.appendChild(fly);

    // next frame: animate to cart icon position
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            fly.classList.add('fly-end');
            fly.style.left = destRect.left + destRect.width / 2 - 8 + 'px';
            fly.style.top = destRect.top + destRect.height / 2 - 8 + 'px';
        });
    });

    // bounce cart icon when fly arrives, then remove clone
    fly.addEventListener('transitionend', () => {
        fly.remove();
        cartIcon.classList.add('cart-bounce');
        cartIcon.addEventListener('animationend', () => {
            cartIcon.classList.remove('cart-bounce');
        }, { once: true });
    }, { once: true });
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) {
        closeEditModal();
    }
}
