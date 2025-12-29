// ==========================================
// CONFIGURATION (ตั้งค่าระบบ)
// ==========================================

// ✅ ลิ้งค์ Cloud Function ของคุณ (ใส่ให้แล้วครับ)
const CLOUD_FUNCTION_URL = "https://us-central1-pos-system-4d0b5.cloudfunctions.net/sendOrder";

// เมนูอาหาร (ตัวอย่าง)
const MENU = [
    { id: 1, name: "Espresso", price: 2.50 },
    { id: 2, name: "Cappuccino", price: 3.50 },
    { id: 3, name: "Latte", price: 3.75 },
    { id: 4, name: "Mocha", price: 4.00 },
    { id: 5, name: "Americano", price: 2.75 },
    { id: 6, name: "Croissant", price: 3.00 },
];

// ==========================================
// SYSTEM LOGIC
// ==========================================

let cart = [];

// 1. ดึง Token จาก URL (ที่มาจากการสแกน QR)
const urlParams = new URLSearchParams(window.location.search);
const DEVICE_TOKEN = urlParams.get('token');

const statusDiv = document.getElementById('status');
const btnOrder = document.getElementById('btn-order');

// ฟังก์ชันแสดงเมนู
function renderMenu() {
    const container = document.getElementById('menu');
    container.innerHTML = MENU.map(item => `
        <div class="product-card" onclick="addToCart(${item.id})">
            <div class="product-name">${item.name}</div>
            <div class="product-price">$${item.price.toFixed(2)}</div>
        </div>
    `).join('');
}

// อัปเดตตระกร้าสินค้า
function updateCartUI() {
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('total-price').innerText = `$${total.toFixed(2)}`;
    document.getElementById('item-count').innerText = `${cart.length} items`;

    btnOrder.disabled = cart.length === 0;
}

// เพิ่มสินค้า
window.addToCart = (id) => {
    const item = MENU.find(m => m.id === id);
    if (item) {
        cart.push(item);
        updateCartUI();

        // Effect
        const el = event.currentTarget;
        el.style.backgroundColor = '#f0f0f0';
        setTimeout(() => el.style.backgroundColor = 'white', 100);
    }
}

// ตรวจสอบความพร้อม
if (!DEVICE_TOKEN) {
    statusDiv.innerHTML = '<span class="status-disconnected">❌ Error: No Token. Scan QR again.</span>';
    btnOrder.disabled = true;
} else {
    statusDiv.innerHTML = '<span class="status-connected">✅ Ready to Order</span>';
}

// ==========================================
// SENDING LOGIC (ส่งข้อมูลไป Cloud Functions)
// ==========================================
btnOrder.addEventListener('click', async () => {
    // เตรียมข้อมูลออเดอร์
    const orderData = {
        table: "1",
        items: cart,
        total: cart.reduce((sum, item) => sum + item.price, 0),
        timestamp: Date.now()
    };

    statusDiv.innerHTML = '🚀 Sending Order to Cloud...';
    btnOrder.disabled = true;

    try {
        // ยิงไปที่ Cloud Function (Plan A)
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // ส่ง Token ไปบอก Server ว่าต้องแจ้งเตือนเครื่องไหน
                token: DEVICE_TOKEN,
                // ข้อมูลออเดอร์
                orderData: orderData
            }),
        });

        if (response.ok) {
            statusDiv.innerHTML = '<span class="status-connected">🎉 Order Sent!</span>';
            cart = [];
            updateCartUI();
            alert("สั่งอาหารเรียบร้อยครับ!");
        } else {
            const err = await response.text();
            throw new Error(err);
        }
    } catch (error) {
        console.error(error);
        statusDiv.innerHTML = '<span class="status-disconnected">❌ Failed</span>';
        alert("เกิดข้อผิดพลาด: " + error.message);
        btnOrder.disabled = false;
    }
});

// เริ่มทำงาน
renderMenu();