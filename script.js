// [FILE: script.js]
const R2_BASE_URL = "https://pub-95a66e290b0b4a03ad1abcef6de8b7da.r2.dev";
const CLOUD_FUNCTION_URL = "https://sendorder-xtqo4x663a-uc.a.run.app";

// --- STATE ---
let SHOP_ID = null;
let TABLE_NO = null;
let SESSION_ID = null;

let MENU = []; // Raw Category Data
let CART = [];
let ACTIVE_CATEGORY = null;

// Modal State
let CURRENT_ITEM = null;
let SELECTED_OPTIONS = []; // List of selected option objects
let CURRENT_QTY = 1;

// --- INITIALIZATION ---
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    SHOP_ID = urlParams.get('shop_id');
    TABLE_NO = urlParams.get('table');

    if (!SHOP_ID || !TABLE_NO) {
        document.body.innerHTML = `<h2 style="color:white;text-align:center;padding-top:50px">Invalid QR Code</h2>`;
        return;
    }

    // Initialize UI
    document.getElementById('status').innerText = `Table ${TABLE_NO}`;
    await checkSession();

    // Bind Order Button
    document.getElementById('btn-order').addEventListener('click', placeOrder);
};

// --- SESSION LOGIC ---
async function checkSession() {
    try {
        const t = Date.now();
        const res = await fetch(`${R2_BASE_URL}/shops/${SHOP_ID}/tables/${TABLE_NO}/session.json?t=${t}`);
        if (res.ok) {
            const data = await res.json();
            SESSION_ID = data.session_id;
            document.getElementById('status').innerHTML = `<span style="color:#37ec13">● Connected</span>`;
            document.getElementById('status').style.display = 'none'; // Hide if good
            await loadMenu();
        } else {
            showClosedState();
        }
    } catch (e) {
        showClosedState();
    }
}

function showClosedState() {
    document.getElementById('menu-container').innerHTML = `
        <div style="text-align:center; padding:50px; color:#aaa;">
            <h3>Restaraunt/Table Closed</h3>
            <button onclick="requestOpen()" style="padding:15px;background:#37ec13;border:none;border-radius:10px;font-weight:bold;">Request Service</button>
        </div>
    `;
}

async function requestOpen() {
    document.getElementById('status').innerText = "Requesting Staff...";
    try {
        await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "REQUEST_OPEN", shopId: SHOP_ID, tableId: TABLE_NO })
        });
        // Start polling
        setInterval(checkSession, 3000);
    } catch (e) { alert("Error requesting open"); }
}

// --- MENU DATA ---
async function loadMenu() {
    try {
        const res = await fetch(`${R2_BASE_URL}/shops/${SHOP_ID}/menu.json?t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            // Support both old (items array) and new (categories wrapper)
            if (data.categories) {
                MENU = data.categories; // New Structure
            } else if (data.items && data.items.length > 0 && data.items[0].items) {
                // Or intermediate structure where items IS the list of categories (from my _saveMenu implementation)
                MENU = data.items;
            } else {
                // Fallback for old Flat List (Wrap in "General")
                MENU = [{ id: 'default', name: 'General', items: data.items || [] }];
            }

            renderCategories();
            renderMenuGrid();
        }
    } catch (e) { console.error(e); }
}

// --- RENDERING ---
function renderCategories() {
    const nav = document.getElementById('category-nav');
    if (!MENU.length) return;

    // Set first as active if none
    if (!ACTIVE_CATEGORY) ACTIVE_CATEGORY = MENU[0].id;

    nav.innerHTML = MENU.map(cat => `
        <div class="cat-pill ${cat.id === ACTIVE_CATEGORY ? 'active' : ''}" 
             onclick="scrollToCategory('${cat.id}')">
             ${cat.name}
        </div>
    `).join('');
}

function scrollToCategory(id) {
    ACTIVE_CATEGORY = id;
    renderCategories(); // Update pills

    const el = document.getElementById(`sec-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Offset for sticky header
        window.scrollBy(0, -120);
    }
}

function renderMenuGrid() {
    const container = document.getElementById('menu-container');
    container.innerHTML = MENU.map(cat => `
        <div id="sec-${cat.id}" class="menu-section">
            <div class="section-title">${cat.name}</div>
            <div class="menu-grid">
                ${cat.items.map(item => `
                    <div class="product-card" onclick='openModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
                        <div class="card-img-wrap">
                            ${item.imageUrl
            ? `<img src="${item.imageUrl}" loading="lazy">`
            : `<span style="font-size:2rem;opacity:0.5">🍔</span>`}
                        </div>
                        <div class="card-info">
                            <div class="product-name">${item.name}</div>
                            <div class="product-price">$${item.price}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// --- MODAL LOGIC ---
window.openModal = (item) => {
    CURRENT_ITEM = item;
    CURRENT_QTY = 1;
    SELECTED_OPTIONS = [];

    document.getElementById('modal-item-name').innerText = item.name;
    document.getElementById('modal-base-price').innerText = `$${item.price}`;
    document.getElementById('modal-qty').innerText = "1";

    // Render Options
    const optContainer = document.getElementById('modal-options');
    if (item.options && item.options.length > 0) {
        optContainer.innerHTML = `
            <div class="option-group">
                <div class="option-title">Customize</div>
                ${item.options.map((opt, idx) => `
                    <label class="option-row">
                        <div style="display:flex;align-items:center;">
                            <input type="checkbox" onchange="toggleOption(${idx})">
                            <span class="option-label">${opt.name}</span>
                        </div>
                        ${opt.price > 0 ? `<div class="option-price">+$${opt.price}</div>` : ''}
                    </label>
                `).join('')}
            </div>
        `;
    } else {
        optContainer.innerHTML = `<div style="padding:20px;text-align:center;color:#666">No options available</div>`;
    }

    updateModalTotal();
    document.getElementById('item-modal').classList.add('active');
};

window.closeModal = () => {
    document.getElementById('item-modal').classList.remove('active');
};

window.changeQty = (delta) => {
    CURRENT_QTY += delta;
    if (CURRENT_QTY < 1) CURRENT_QTY = 1;
    document.getElementById('modal-qty').innerText = CURRENT_QTY;
    updateModalTotal();
};

window.toggleOption = (optIndex) => {
    const opt = CURRENT_ITEM.options[optIndex];
    const existingIdx = SELECTED_OPTIONS.findIndex(o => o.name === opt.name);

    if (existingIdx > -1) {
        SELECTED_OPTIONS.splice(existingIdx, 1);
    } else {
        SELECTED_OPTIONS.push(opt);
    }
    updateModalTotal();
};

function updateModalTotal() {
    const base = CURRENT_ITEM.price;
    const optTotal = SELECTED_OPTIONS.reduce((sum, o) => sum + o.price, 0);
    const total = (base + optTotal) * CURRENT_QTY;

    document.getElementById('btn-add-modal').innerText = `Add to Cart - $${total.toFixed(2)}`;
}

window.confirmAddToCart = () => {
    // Unique ID based on options to separate "Basil Pork (Egg)" from "Basil Pork"
    const optionString = SELECTED_OPTIONS.map(o => o.name).sort().join(',');
    const cartId = `${CURRENT_ITEM.id}-${optionString}`;

    const existing = CART.find(c => c.cartId === cartId);

    if (existing) {
        existing.qty += CURRENT_QTY;
    } else {
        CART.push({
            cartId: cartId,
            id: CURRENT_ITEM.id,
            name: CURRENT_ITEM.name,
            price: CURRENT_ITEM.price,
            options: [...SELECTED_OPTIONS],
            qty: CURRENT_QTY
        });
    }

    updateCartBar();
    closeModal();

    // Animation effect
    const btn = document.getElementById('btn-order');
    btn.style.transform = 'scale(1.1)';
    setTimeout(() => btn.style.transform = 'scale(1)', 200);
};

// --- CART & ORDER ---
function updateCartBar() {
    const count = CART.reduce((sum, item) => sum + item.qty, 0);
    const total = CART.reduce((sum, item) => {
        const itemTotal = item.price + item.options.reduce((oSum, opt) => oSum + opt.price, 0);
        return sum + (itemTotal * item.qty);
    }, 0);

    document.getElementById('cart-total').innerText = `$${total.toFixed(2)}`;
    document.getElementById('cart-count').innerText = `${count} items`;

    const btn = document.getElementById('btn-order');
    btn.disabled = count === 0;
    btn.innerText = count === 0 ? "View Order" : "Place Order";
}

async function placeOrder() {
    if (CART.length === 0) return;
    if (!SESSION_ID) { alert("Session invalid. Call staff."); return; }

    const btn = document.getElementById('btn-order');
    btn.innerText = "Sending...";
    btn.disabled = true;

    // Calculate total
    const totalVal = CART.reduce((sum, item) => {
        const itemTotal = item.price + item.options.reduce((oSum, opt) => oSum + opt.price, 0);
        return sum + (itemTotal * item.qty);
    }, 0);

    const payload = {
        type: "ORDER",
        shopId: SHOP_ID,
        sessionId: SESSION_ID,
        orderData: {
            shopId: SHOP_ID,
            table: TABLE_NO,
            total: totalVal,
            timestamp: Date.now(),
            items: CART.map(c => ({
                id: c.id,
                name: c.name,
                qty: c.qty,
                price: c.price,
                options: c.options.map(o => ({ name: o.name, price: o.price })),
                totalItemPrice: (c.price + c.options.reduce((s, o) => s + o.price, 0)) * c.qty
            }))
        }
    };

    try {
        const res = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ Order Sent Successfully!");
            CART = [];
            updateCartBar();
        } else {
            throw new Error("Server error");
        }
    } catch (e) {
        alert("Failed to send order. Please try again.");
    } finally {
        btn.disabled = CART.length === 0;
        btn.innerText = CART.length === 0 ? "View Order" : "Place Order";
    }
}