// [FILE: script.js]
const R2_BASE_URL = "https://pub-95a66e290b0b4a03ad1abcef6de8b7da.r2.dev";
const CLOUD_FUNCTION_URL = "https://sendorder-xtqo4x663a-uc.a.run.app";

let MENU = [];
let SESSION_ID = null;
let cart = [];
let pollInterval = null;

const urlParams = new URLSearchParams(window.location.search);
const SHOP_ID = urlParams.get('shop_id');
const TABLE_NO = urlParams.get('table'); // Strict: No default

const statusDiv = document.getElementById('status');
const menuContainer = document.getElementById('menu-container');
const btnOrder = document.getElementById('btn-order');

window.onload = async () => {
    if (!SHOP_ID || !TABLE_NO) {
        document.getElementById('status').style.display = 'none';
        document.body.innerHTML = `
            <div style="text-align:center; padding: 50px; font-family: sans-serif;">
                <h1>⚠️ Invalid QR Code</h1>
                <p>Please scan the specific QR Code at your table.</p>
                <p style="font-size:0.8em; color:grey;">Missing Shop ID or Table ID</p>
            </div>
        `;
        return;
    }

    // Initial Check
    await checkSession();
};

async function checkSession() {
    try {
        // Cache busting ?t=Timestamp
        const sessionUrl = `${R2_BASE_URL}/shops/${SHOP_ID}/tables/${TABLE_NO}/active_session.json?t=${Date.now()}`;
        console.log("Checking Session:", sessionUrl);

        const response = await fetch(sessionUrl);

        if (response.ok) {
            const data = await response.json();
            SESSION_ID = data.session_id;
            console.log("Session Active:", SESSION_ID);

            // Stop polling if active
            if (pollInterval) clearInterval(pollInterval);

            // Load Menu if not loaded
            if (MENU.length === 0) await loadMenu();

            statusDiv.innerHTML = `<span style="color:green; font-weight:bold;">✅ Table ${TABLE_NO} Open</span>`;
            if (menuContainer) menuContainer.style.display = 'block';
        } else {
            // 404 or other error -> Session Closed
            console.log("Session Closed (404)");
            showClosedState();
        }
    } catch (e) {
        console.error("Check Error:", e);
        showClosedState();
    }
}

function showClosedState() {
    if (SESSION_ID) return; // If already logged in, don't revert (unless strictly required)

    if (menuContainer) menuContainer.style.display = 'none';

    statusDiv.innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <h2>Table ${TABLE_NO} is Closed</h2>
            <p>Please request service to open this table.</p>
            <button onclick="requestOpen()" style="padding:15px 30px; font-size:18px; background:orange; border:none; border-radius:8px; cursor:pointer;">
                🔔 Call Staff / Request Open
            </button>
        </div>
    `;
}

async function requestOpen() {
    statusDiv.innerHTML = '<h3>🔔 Calling Staff...</h3><p>Please wait for approval.</p>';

    try {
        await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "REQUEST_OPEN",
                shopId: SHOP_ID,
                tableId: TABLE_NO
            })
        });

        // Start Polling
        if (!pollInterval) {
            pollInterval = setInterval(checkSession, 3000);
        }
    } catch (e) {
        statusDiv.innerHTML = `<span style="color:red">Error: ${e.message}</span>`;
        setTimeout(showClosedState, 3000);
    }
}

async function loadMenu() {
    statusDiv.innerHTML = '📥 Loading Menu...';
    try {
        const menuUrl = `${R2_BASE_URL}/menu_${SHOP_ID}.json?t=${Date.now()}`;
        const response = await fetch(menuUrl);
        if (!response.ok) throw new Error("Menu file not found");

        const data = await response.json();
        MENU = data.items || data;
        renderMenu();
    } catch (e) {
        statusDiv.innerHTML = `<span style="color:red">Failed to load menu: ${e.message}</span>`;
    }
}

function renderMenu() {
    const container = document.getElementById('menu');
    if (!container) return;
    container.innerHTML = MENU.map(item => `
         <div class="product-card" onclick="addToCart('${item.id}')" style="border:1px solid #ddd; margin:10px; padding:10px; border-radius:8px; background:white;">
             ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">` : ''}
             <div class="product-name" style="font-weight:bold; margin-top:10px;">${item.name}</div>
             <div class="product-price" style="color:green;">$${item.price}</div>
         </div>
     `).join('');
}

window.addToCart = (id) => {
    const item = MENU.find(m => String(m.id) === String(id));
    if (item) {
        cart.push(item);
        updateCartUI();
    }
}

function updateCartUI() {
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    const totalEl = document.getElementById('total-price');
    const countEl = document.getElementById('item-count');
    if (totalEl) totalEl.innerText = `$${total.toFixed(2)}`;
    if (countEl) countEl.innerText = `${cart.length} items`;
    if (btnOrder) btnOrder.disabled = cart.length === 0;
}

if (btnOrder) {
    btnOrder.addEventListener('click', async () => {
        if (!SESSION_ID) {
            alert("Session expired or invalid. Please refresh.");
            return;
        }

        statusDiv.innerHTML = '🚀 Sending Order...';
        btnOrder.disabled = true;

        try {
            const response = await fetch(CLOUD_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: "ORDER",
                    shopId: SHOP_ID,
                    sessionId: SESSION_ID,
                    fcmToken: null, // No longer targeted by specific token
                    orderData: {
                        shopId: SHOP_ID,
                        table: TABLE_NO,
                        items: cart,
                        total: cart.reduce((sum, item) => sum + item.price, 0),
                        timestamp: Date.now()
                    }
                }),
            });

            if (response.ok) {
                statusDiv.innerHTML = '<span style="color:green;">🎉 Order Sent!</span>';
                cart = [];
                updateCartUI();
                alert("Order Sent!");
            } else { throw new Error(await response.text()); }
        } catch (error) {
            statusDiv.innerHTML = '<span style="color:red">❌ Send Failed</span>';
            btnOrder.disabled = false;
        }
    });
}