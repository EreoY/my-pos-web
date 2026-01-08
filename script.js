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

// --- POLLING STATE ---
let POLL_ATTEMPTS = 0;
let POLL_INTERVAL = null;
let COUNTDOWN_INTERVAL = null;

function showClosedState() {
    // Clear any existing intervals if we land back here
    stopPolling();

    document.getElementById('menu-container').innerHTML = `
        <div style="text-align:center; padding:50px; color:#aaa;" id="closed-state-ui">
            <h3>Restaurant/Table Closed</h3>
            <button onclick="requestOpen()" class="primary-btn" style="padding:15px; width:200px; margin-top:20px;">Request Service</button>
        </div>
    `;
}

async function requestOpen() {
    const ui = document.getElementById('closed-state-ui');
    ui.innerHTML = `<h3>Requesting...</h3>`;

    try {
        await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "REQUEST_OPEN", shopId: SHOP_ID, tableId: TABLE_NO })
        });

        // Start Smart Polling (3 attempts)
        POLL_ATTEMPTS = 3;
        startPollingCountdown();

    } catch (e) {
        alert("Error requesting open");
        showClosedState();
    }
}

function startPollingCountdown() {
    if (POLL_ATTEMPTS <= 0) {
        // Stop and ask to retry
        showRetryUI();
        return;
    }

    let timeLeft = 10;
    const ui = document.getElementById('closed-state-ui');

    // Initial Render
    ui.innerHTML = `
        <h3>Waiting for Staff...</h3>
        <p>Checking status in <b style="color:#37ec13; font-size:1.5em">${timeLeft}</b></p>
        <p style="font-size:12px; color:grey">Attempt ${4 - POLL_ATTEMPTS}/3</p>
    `;

    // Countdown Timer
    COUNTDOWN_INTERVAL = setInterval(() => {
        timeLeft--;
        if (ui.innerHTML.includes("Checking status")) {
            ui.querySelector('b').innerText = timeLeft;
        }

        if (timeLeft <= 0) {
            clearInterval(COUNTDOWN_INTERVAL);
            performOneCheck();
        }
    }, 1000);
}

async function performOneCheck() {
    const ui = document.getElementById('closed-state-ui');
    ui.innerHTML = `<h3>Checking...</h3>`;

    try {
        const t = Date.now();
        const res = await fetch(`${R2_BASE_URL}/shops/${SHOP_ID}/tables/${TABLE_NO}/session.json?t=${t}`);
        if (res.ok) {
            const data = await res.json();
            SESSION_ID = data.session_id;
            stopPolling();
            // Success! Reload full app
            location.reload();
        } else {
            // Failed, decrement and loop
            POLL_ATTEMPTS--;
            startPollingCountdown();
        }
    } catch (e) {
        POLL_ATTEMPTS--;
        startPollingCountdown();
    }
}

function showRetryUI() {
    const ui = document.getElementById('closed-state-ui');
    ui.innerHTML = `
        <h3>Still Closed</h3>
        <p>The staff hasn't opened the table yet.</p>
        <button onclick="POLL_ATTEMPTS=3; requestOpen();" class="primary-btn" style="padding:15px; width:200px; margin-top:10px;">Request Again</button>
        <br><br>
        <button onclick="location.reload()" style="background:none; border:none; text-decoration:underline; color:#666">Refresh Page</button>
    `;
}

function stopPolling() {
    if (COUNTDOWN_INTERVAL) clearInterval(COUNTDOWN_INTERVAL);
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
    // Logic: If items > 0, "Place Order". If 0, "View Bill".
    if (count > 0) {
        btn.innerText = "Place Order";
        btn.onclick = placeOrder; // Bind directly
        btn.style.background = "#37ec13";
        btn.disabled = false; // Ensure enabled
    } else {
        btn.innerText = "View Bill";
        btn.onclick = viewBill; // Bind New Function
        btn.disabled = false; // Always enabled to check status
        btn.style.background = "#2196F3"; // Blue for info
    }
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
            // Save to Local History
            saveOrderToHistory(payload.orderData);

            alert("✅ Order Sent Successfully!");
            CART = [];
            updateCartBar();
        } else {
            throw new Error("Server error");
        }
    } catch (e) {
        alert("Failed to send order. Please try again.");
    } finally {
        updateCartBar();
    }
}

// --- BILL / HISTORY LOGIC ---
function saveOrderToHistory(order) {
    const key = `history_${SHOP_ID}_${TABLE_NO}`;
    const history = JSON.parse(localStorage.getItem(key) || "[]");
    history.push(order);
    localStorage.setItem(key, JSON.stringify(history));
}

async function viewBill() {
    // 1. Refresh Status (On Demand Request)
    await checkSession();

    // 2. Load History
    const key = `history_${SHOP_ID}_${TABLE_NO}`;
    const history = JSON.parse(localStorage.getItem(key) || "[]");

    // 3. Render Modal
    const modalContent = `
        <div style="padding:20px;">
            <h3>Your Orders</h3>
            <p style="color:grey; font-size:12px;">Stored locally on this device</p>
            <div style="max-height:300px; overflow-y:auto; margin:10px 0;">
                ${history.length === 0 ? '<p>No orders yet.</p>' : history.map((h, i) => `
                    <div style="border-bottom:1px solid #eee; padding:10px 0;">
                        <div style="font-weight:bold; display:flex; justify-content:space-between;">
                            <span>Round ${i + 1}</span>
                            <span>${new Date(h.timestamp).toLocaleTimeString()}</span>
                        </div>
                        ${h.items.map(item => `
                            <div style="display:flex; justify-content:space-between; font-size:14px; margin-top:4px;">
                                <span>${item.qty}x ${item.name}</span>
                                <span>$${item.totalItemPrice}</span>
                            </div>
                            ${item.options.length > 0 ? `<div style="font-size:12px; color:grey; margin-left:20px;">+ ${item.options.map(o => o.name).join(', ')}</div>` : ''}
                        `).join('')}
                         <div style="text-align:right; font-weight:bold; margin-top:5px;">Total: $${h.total}</div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:20px; text-align:center;">
                <button onclick="closeModal()" style="padding:10px 20px; background:#ddd; border:none; border-radius:8px;">Close</button>
            </div>
        </div>
    `;

    // Reuse item modal container for simplicity, or create a new one. 
    // We'll hijack 'item-modal' content temporarily or rely on a generic modal structure if existed.
    // For now, let's inject a simple overlay if not exists, or replace item-modal content.
    // Simpler: Alert for now, OR replace innerHTML of 'item-modal' (but need to restore it later).

    // Let's create a dedicated BILL MODAL in HTML via JS if not exists
    let billModal = document.getElementById('bill-modal');
    if (!billModal) {
        billModal = document.createElement('div');
        billModal.id = 'bill-modal';
        billModal.className = 'modal'; // Reuse CSS class
        billModal.innerHTML = `<div class="modal-content" id="bill-modal-content"></div>`;
        document.body.appendChild(billModal);
    }

    document.getElementById('bill-modal-content').innerHTML = modalContent;
    billModal.classList.add('active');

    // Bind click outside to close
    billModal.onclick = (e) => {
        if (e.target === billModal) billModal.classList.remove('active');
    };
}

// Helper to hijack close
const originalClose = window.closeModal;
window.closeModal = () => {
    originalClose();
    const billModal = document.getElementById('bill-modal');
    if (billModal) billModal.classList.remove('active');
};