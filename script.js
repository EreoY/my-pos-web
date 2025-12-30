// ==========================================
// CONFIGURATION
// ==========================================
// ✅ ใช้ URL ใหม่ (Gen 2) ที่ถูกต้อง
const CLOUD_FUNCTION_URL = "https://sendorder-xtqo4x663a-uc.a.run.app";

// ✅ ใส่ค่า Config ของคุณให้ครบแล้ว
const firebaseConfig = {
    apiKey: "AIzaSyBRCIwMv010KQ79YjHrs5zZnH_XnDNgIDQ",
    authDomain: "pos-system-4d0b5.firebaseapp.com",
    projectId: "pos-system-4d0b5",
    storageBucket: "pos-system-4d0b5.firebasestorage.app",
    messagingSenderId: "948004280034",
    appId: "1:948004280034:web:0c25c409673bb25ee8f0bb",
    measurementId: "G-YXWBJLLK4Q"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Handle Incoming Menu Chunks
    messaging.onMessage((payload) => {
        console.log('Message received. ', payload);
        const data = payload.data;

        if (data.type === 'MENU_RESPONSE') {
            handleMenuChunk(data);
        }
    });
} catch (e) {
    console.error("Firebase Init Error (Check Config):", e);
}

// ==========================================
// STATE
// ==========================================
let MENU = []; // Will be loaded dynamically
let cart = [];
let menuChunks = {};
let MY_REPLY_TOKEN = null;

// Get Merchant Token from URL (for sending Order)
const urlParams = new URLSearchParams(window.location.search);
const MERCHANT_TOKEN = urlParams.get('token');

const statusDiv = document.getElementById('status');
const btnOrder = document.getElementById('btn-order');

// ==========================================
// LOGIC: MENU CHUNKING
// ==========================================
function handleMenuChunk(data) {
    const index = parseInt(data.chunk_index);
    const total = parseInt(data.total_chunks);
    const chunk = data.payload;

    menuChunks[index] = chunk;
    // Show progress percentage
    statusDiv.innerHTML = `Loading Menu... ${(Object.keys(menuChunks).length / total * 100).toFixed(0)}%`;

    if (Object.keys(menuChunks).length === total) {
        // Reassemble
        let fullJson = "";
        for (let i = 0; i < total; i++) {
            fullJson += menuChunks[i];
        }

        try {
            MENU = JSON.parse(fullJson);
            renderMenu();
            statusDiv.innerHTML = '<span class="status-connected">✅ Menu Loaded!</span>';
        } catch (e) {
            console.error("Menu Parse Error", e);
            statusDiv.innerHTML = 'Menu Error';
        }
    }
}

// ==========================================
// LOGIC: INIT & REQUEST MENU
// ==========================================
async function initSystem() {
    if (!MERCHANT_TOKEN) {
        statusDiv.innerHTML = '<span class="status-disconnected">❌ Error: No Merchant Token in URL.</span>';
        return;
    }

    try {
        const messaging = firebase.messaging();
        // Request Permission & Get Token
        await Notification.requestPermission();

        // ✅ ใส่ VAPID Key ของคุณให้แล้ว
        MY_REPLY_TOKEN = await messaging.getToken({
            vapidKey: "BANMxuREDu4hfBFsBIMCc1nX1K_XuR0wJpz_WfBVRu8gocCO9Me9nf9atseFBH7JcPHfY72aumhfNnLwkml3jnw"
        });

        console.log("My Reply Token:", MY_REPLY_TOKEN);

        if (MY_REPLY_TOKEN) {
            requestMenuFromMerchant();
        } else {
            statusDiv.innerHTML = 'Failed to get Reply Token';
        }

    } catch (e) {
        console.error("Init Error:", e);
        statusDiv.innerHTML = 'Init Failed (Check Console)';
    }
}

async function requestMenuFromMerchant() {
    statusDiv.innerHTML = 'Requesting Menu from Shop...';

    try {
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "MENU_REQUEST",
                merchant_token: MERCHANT_TOKEN,
                reply_token: MY_REPLY_TOKEN
            }),
        });

        if (!response.ok) throw new Error("Cloud Function Error");
        console.log("Menu Request Sent");

    } catch (e) {
        console.error(e);
        statusDiv.innerHTML = 'Request Failed (Is Shop App Running?)';
    }
}


// ==========================================
// UI & ORDER LOGIC
// ==========================================
function renderMenu() {
    const container = document.getElementById('menu');
    if (MENU.length === 0) {
        container.innerHTML = "<div>No Menu Items</div>";
        return;
    }
    container.innerHTML = MENU.map(item => `
        <div class="product-card" onclick="addToCart(${item.id})">
            <div class="product-name">${item.name}</div>
            <div class="product-price">$${item.price.toFixed(2)}</div>
        </div>
    `).join('');
}

function updateCartUI() {
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('total-price').innerText = `$${total.toFixed(2)}`;
    document.getElementById('item-count').innerText = `${cart.length} items`;
    btnOrder.disabled = cart.length === 0;
}

window.addToCart = (id) => {
    const item = MENU.find(m => m.id === id);
    if (item) {
        cart.push(item);
        updateCartUI();
        // Visual Effect
        const el = event.currentTarget;
        el.style.backgroundColor = '#f0f0f0';
        setTimeout(() => el.style.backgroundColor = 'white', 100);
    }
}

btnOrder.addEventListener('click', async () => {
    const orderData = {
        table: "1",
        items: cart,
        total: cart.reduce((sum, item) => sum + item.price, 0),
        timestamp: Date.now()
    };

    statusDiv.innerHTML = '🚀 Sending Order...';
    btnOrder.disabled = true;

    try {
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "ORDER", // ต้องระบุ type ว่าเป็น ORDER
                token: MERCHANT_TOKEN,
                orderData: orderData
            }),
        });

        if (response.ok) {
            statusDiv.innerHTML = '<span class="status-connected">🎉 Order Sent!</span>';
            cart = [];
            updateCartUI();
            alert("สั่งอาหารเรียบร้อยครับ!");
        } else {
            throw new Error(await response.text());
        }
    } catch (error) {
        console.error(error);
        statusDiv.innerHTML = '<span class="status-disconnected">❌ Failed</span>';
        btnOrder.disabled = false;
    }
});

// START
initSystem();