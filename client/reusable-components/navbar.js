// Reduce, reuse, recycle — clean auth + header logic

function getUserFromToken() {
    const token = sessionStorage.getItem('token');

    if (!token) {
        window.location.href = '/auth/login.html';
        return null;
    }

    try {
        // Decode JWT token (client-side – note: not secure for sensitive data!)
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
            username: payload.username,
            email: payload.email,
            role: payload.role,
            userid: payload.userid
        };
    } catch (error) {
        console.error('Error decoding token:', error);
        sessionStorage.clear();
        window.location.href = '/auth/login.html';
        return null;
    }
}

function createHeader(username, role) {
    let menuHTML = '';
    let pageTitle = 'Home page';
    
    // Determine the base path using absolute paths to prevent folder-hopping bugs
    const customerPrefix = '/customer/';
    const vendorPrefix = '/vendor/';

    if (role === 'vendor') {
        pageTitle = "Vendor's Homepage";
        menuHTML = `
            <ul>
                <ul><a href="${vendorPrefix}home.html">Add Products</a></ul>
                <ul><a href="${vendorPrefix}vproduct.html">View Products</a></ul>
                <ul><a href="${vendorPrefix}vorders.html">View Orders</a></ul>
            </ul>
        `;
    } else if (role === 'customer') {
        pageTitle = "Customer's Home Page";
        menuHTML = `
            <ul>
                <ul><a href="${customerPrefix}home.html">View Products</a></ul>
                <ul><a href="${customerPrefix}torders.html">Track Order</a></ul>
                <ul><a href="${customerPrefix}cart.html">Cart <i class="fa-solid fa-cart-shopping"></i></a></ul>
            </ul>
        `;
    }

    return `
        <section class="header">
            <nav class="nav">
                <div class="main">
                    <h1>${pageTitle}</h1>
                    ${menuHTML}
                </div>
                <div class="ps">
                    <h2>Welcome, ${username}!</h2>

                    <img class="pfp" onclick="toggleProfile()" src="" alt="Profile picture">
                    <div class="sub-menuw" id="subMenu">
                        <div class="sub-menu">
                            <div class="user-info">
                                <img class="pfpu" src="" alt="Profile picture">
                                <h3>${username}</h3>
                            </div>
                            <hr>
                            <a href="#" class="sub-menu-link" onclick="editProfile(); return false;">
                                <i class="fa-solid fa-user-pen"></i>
                                <p>Edit Profile</p>
                                <span>></span>
                            </a>
                            <a href="#" class="sub-menu-link" onclick="logout(); return false;">
                                <i class="fa-solid fa-right-from-bracket"></i>
                                <p>Logout</p>
                                <span>></span>
                            </a>
                        </div>
                    </div>
                </div>
            </nav>
        </section>
    `;
}

// Toggle profile dropdown
function toggleProfile() {
    const subMenu = document.getElementById("subMenu");
    if (subMenu) {
        subMenu.classList.toggle("profile");
    }
}

// Placeholder for future feature
function editProfile() {
    window.location.href = '/reusable-components/edit-profile.html';
}

// Logout with confirmation
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.clear();
        window.location.href = '/auth/login.html';
    }
}

// Initialize header
async function initHeader() {
    const user = getUserFromToken();

    if (!user) {
        return; // already redirected
    }

    const headerHTML = createHeader(user.username, user.role);
    document.body.insertAdjacentHTML('afterbegin', headerHTML);

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/profile/view', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        let avatarUrl = '/assets/img/defaut_avatar.png';
        if (!result.error && result.data && result.data.profile_image) {
            avatarUrl = `http://localhost:3000/uploads/${result.data.profile_image}`;
        }
            
        const pfps = document.querySelectorAll('.pfp, .pfpu');
        pfps.forEach(img => {
            img.src = avatarUrl;
            img.onerror = function() {
                this.src = '/assets/img/defaut_avatar.png';
            };
        });
    } catch (err) {
        console.error("Error loading profile avatar in navbar", err);
    }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
} else {
    initHeader();
}
