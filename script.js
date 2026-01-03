// [FILE: script.js]
const R2_BASE_URL = "https://pub-95a66e290b0b4a03ad1abcef6de8b7da.r2.dev";
const CLOUD_FUNCTION_URL = "https://sendorder-xtqo4x663a-uc.a.run.app";

const firebaseConfig = {
    apiKey: "AIzaSyBRCIwMv010KQ79YjHrs5zZnH_XnDNgIDQ",
    authDomain: "pos-system-4d0b5.firebaseapp.com",
    projectId: "pos-system-4d0b5",
    storageBucket: "pos-system-4d0b5.firebasestorage.app",
    messagingSenderId: "948004280034",
    appId: "1:948004280034:web:0c25c409673bb25ee8f0bb",
    measurementId: "G-YXWBJLLK4Q"
};

let MENU = [];
window.FCM_TOKEN = null;
let cart = [];
const urlParams = new URLSearchParams(window.location.search);
const SHOP_ID = urlParams.get('shop_id');
const TABLE_NO = urlParams.get('table') || "1";

const statusDiv = document.getElementById('status');
const menuContainer = document.getElementById('menu-container');
const btnOrder = document.getElementById('btn-order');

window.onload = async () => {
    if (!SHOP_ID) {
        statusDiv.innerHTML = '<span style="color:red; font-weight:bold;">❌ Error: Invalid Link (No Shop ID)</span><br>Please scan the QR code again.';
        return;
    }
    try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    } catch (e) { console.error("Firebase Init Error:", e); }

    await loadMenuFromCloudflare();
};

async function loadMenuFromCloudflare() {
    statusDiv.innerHTML = '📥 Loading Menu...';
    try {
        const menuUrl = `${R2_BASE_URL}/menu_${SHOP_ID}.json?t=${Date.now()}`;
        console.log("Fetching:", menuUrl);
        const response = await fetch(menuUrl);
        if (!response.ok) throw new Error("Menu not found. Shop might not have published yet.");

        const data = await response.json();
        if (data.items) {
            MENU = data.items;
            window.FCM_TOKEN = data.fcmToken;
        } else {
            MENU = data;
        }
        renderMenu();

        statusDiv.innerHTML = '<span style="color:green; font-weight:bold;">✅ Ready to Order</span>';
        if (menuContainer) menuContainer.style.display = 'block';
    } catch (e) {
        console.error("Load Error:", e);
        statusDiv.innerHTML = `<span style="color:red">❌ Failed to load menu: ${e.message}</span>`;
    }
}

function renderMenu() {
    const container = document.getElementById('menu');
    if (!container) return;
    if (MENU.length === 0) {
        container.innerHTML = '<div style="text-align:center;">No items.</div>';
        return;
    }
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
        statusDiv.innerHTML = '🚀 Sending Order...';
        btnOrder.disabled = true;
        try {
            const response = await fetch(CLOUD_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: "ORDER",
                    shopId: SHOP_ID,
                    fcmToken: window.FCM_TOKEN,
                    orderData: {
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