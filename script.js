// ==========================================
// CONFIGURATION (Hardcoded)
// ==========================================
const CLOUD_FUNCTION_URL = "https://sendorder-xtqo4x663a-uc.a.run.app";
const VAPID_KEY = "BANMxuREDu4hfBFsBIMCc1nX1K_XuR0wJpz_WfBVRu8gocCO9Me9nf9atseFBH7JcPHfY72aumhfNnLwkml3jnw";

const firebaseConfig = {
    apiKey: "AIzaSyBRCIwMv010KQ79YjHrs5zZnH_XnDNgIDQ",
    authDomain: "pos-system-4d0b5.firebaseapp.com",
    projectId: "pos-system-4d0b5",
    storageBucket: "pos-system-4d0b5.firebasestorage.app",
    messagingSenderId: "948004280034",
    appId: "1:948004280034:web:0c25c409673bb25ee8f0bb",
    measurementId: "G-YXWBJLLK4Q"
};

// ==========================================
// STATE
// ==========================================
let MENU = [];
let cart = [];
let menuChunks = {};
let MY_REPLY_TOKEN = null;

// URL Params
const urlParams = new URLSearchParams(window.location.search);
const MERCHANT_TOKEN = urlParams.get('token');

// Elements
const statusDiv = document.getElementById('status');
const btnConnect = document.getElementById('btn-connect');
const menuContainer = document.getElementById('menu-container');
const btnOrder = document.getElementById('btn-order');

// ==========================================
// FIREBASE INIT (Lazy)
// ==========================================
let messaging = null;

// Initialize App Immediately (for Listener)
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    messaging = firebase.messaging();

    // Listener for Background/Foreground Messages
    messaging.onMessage((payload) => {
        console.log('FCM Message:', payload);
        const data = payload.data;
        if (data.type === 'MENU_RESPONSE') {
            handleMenuChunk(data);
        }
    });
} catch (e) {
    console.error("Firebase Init Error:", e);
    statusDiv.innerHTML = "System Error: Check Config";
}

// ==========================================
// EVENTS & FLOW
// ==========================================

// 1. Click-to-Connect (iOS Requirement)
btnConnect.addEventListener('click', () => {
    initSystem();
});

// 2. Init Logic (FIXED: Manual SW Registration with Full Path)
async function initSystem() {
    if (!MERCHANT_TOKEN) {
        statusDiv.innerHTML = '<span class="status-disconnected">❌ Error: Invalid Link (No Shop Token)</span>';
        return;
    }

    // UI Updates
    btnConnect.style.display = 'none';
    statusDiv.innerHTML = 'Requesting Permission...';

    try {
        // Request Notification Permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            statusDiv.innerHTML = '<span class="status-disconnected">❌ Permission Denied</span>';
            btnConnect.style.display = 'block';
            return;
        }

        statusDiv.innerHTML = 'Registering Service Worker...';

        // FIX: Manually register Service Worker with ABSOLUTE PATH for GitHub Pages
        if ('serviceWorker' in navigator) {
            try {
                // ✅ แก้ไขตรงนี้: ระบุชื่อโฟลเดอร์โปรเจกต์ /my-pos-web/ นำหน้า
                const registration = await navigator.serviceWorker.register('/my-pos-web/firebase-messaging-sw.js', {
                    scope: '/my-pos-web/'
                });
                console.log('Service Worker Registered at /my-pos-web/');

                // Pass registration to getToken
                MY_REPLY_TOKEN = await messaging.getToken({
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });
            } catch (err) {
                console.error("SW Registration Failed", err);
                // ถ้าลงทะเบียนแบบระบุ Path ไม่ผ่าน ลองแบบธรรมดา (เผื่อรัน Localhost)
                console.log("Retrying with relative path...");
                const fallbackReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
                MY_REPLY_TOKEN = await messaging.getToken({
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: fallbackReg
                });
            }
        } else {
            // Fallback for browsers without SW support
            MY_REPLY_TOKEN = await messaging.getToken({ vapidKey: VAPID_KEY });
        }

        console.log("My Token:", MY_REPLY_TOKEN);

        if (MY_REPLY_TOKEN) {
            requestMenuFromMerchant();
        } else {
            throw new Error("No Token Received");
        }

    } catch (e) {
        console.error("Init Error:", e);
        statusDiv.innerHTML = '<span class="status-disconnected">❌ Connection Failed (See Console)</span>';
        btnConnect.style.display = 'block';
    }
}

// 3. Request Menu
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

        if (!response.ok) throw new Error("Server Error");
        statusDiv.innerHTML = 'Waiting for Shop... (App must be running)';

    } catch (e) {
        console.error(e);
        statusDiv.innerHTML = '❌ Server Request Failed';
    }
}

// 4. Handle Chunks
function handleMenuChunk(data) {
    const index = parseInt(data.chunk_index);
    const total = parseInt(data.total_chunks);
    const chunk = data.payload;

    menuChunks[index] = chunk;
    const receivedCount = Object.keys(menuChunks).length;
    const percent = ((receivedCount / total) * 100).toFixed(0);

    statusDiv.innerHTML = `Loading Menu... ${percent}%`;

    if (receivedCount === total) {
        let fullJson = "";
        for (let i = 0; i < total; i++) {
            fullJson += menuChunks[i];
        }

        try {
            MENU = JSON.parse(fullJson);
            renderMenu();
            statusDiv.innerHTML = '<span class="status-connected">✅ Top-up & Pay available</span>';
            menuContainer.style.display = 'block'; // Show Menu
        } catch (e) {
            console.error("Parse Error", e);
            statusDiv.innerHTML = '❌ Menu Corrupted';
        }
    }
}

// ==========================================
// CART & UI
// ==========================================
function renderMenu() {
    const container = document.getElementById('menu');
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
        // Visual Click Effect
        const el = event.currentTarget;
        const originalBg = el.style.backgroundColor;
        el.style.backgroundColor = '#e8f5e9';
        setTimeout(() => el.style.backgroundColor = 'white', 150);
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
                type: "ORDER",
                token: MERCHANT_TOKEN,
                orderData: orderData
            }),
        });

        if (response.ok) {
            statusDiv.innerHTML = '<span class="status-connected">🎉 Order Sent!</span>';
            cart = [];
            updateCartUI();
            alert("Order Sent successfully!");
        } else {
            throw new Error(await response.text());
        }
    } catch (error) {
        console.error(error);
        statusDiv.innerHTML = '<span class="status-disconnected">❌ Send Failed</span>';
        btnOrder.disabled = false;
        alert("Failed to send: " + error.message);
    }
});