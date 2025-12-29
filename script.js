// Hardcoded Menu
const MENU = [
    { id: 1, name: "Espresso", price: 2.50 },
    { id: 2, name: "Cappuccino", price: 3.50 },
    { id: 3, name: "Latte", price: 3.75 },
    { id: 4, name: "Mocha", price: 4.00 },
    { id: 5, name: "Americano", price: 2.75 },
    { id: 6, name: "Croissant", price: 3.00 },
];

let cart = [];
let conn = null;
let peer = null;

// Get Host ID from URL
const urlParams = new URLSearchParams(window.location.search);
// Support both 'id' (new standard) and 'hostId' (legacy/fallback)
const HOST_ID = urlParams.get('id') || urlParams.get('hostId');

const statusDiv = document.getElementById('status');
const btnOrder = document.getElementById('btn-order');

// UI Render
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

    btnOrder.disabled = cart.length === 0 || !conn || !conn.open;
}

window.addToCart = (id) => {
    const item = MENU.find(m => m.id === id);
    if (item) {
        cart.push(item);
        updateCartUI();

        // Simple feedback
        const el = event.currentTarget;
        el.style.backgroundColor = '#f0f0f0';
        setTimeout(() => el.style.backgroundColor = 'white', 100);
    }
}

// PeerJS Logic
function initPeer() {
    if (!HOST_ID) {
        statusDiv.innerHTML = '<span class="status-disconnected">Error: No Merchant ID found in URL.</span>';
        return;
    }

    peer = new Peer(); // Auto-generate ID for customer

    peer.on('open', (id) => {
        console.log('My PeerJS ID: ' + id);
        if (HOST_ID) {
            connectToMerchant();
        } else {
            statusDiv.innerHTML = '<span class="status-disconnected">Error: No Merchant ID provided. Scan QR again.</span>';
        }
    });

    peer.on('error', (err) => {
        console.error(err);
        statusDiv.innerHTML = `<span class="status-disconnected">Error: ${err.type}</span>`;
    });
}

function connectToMerchant() {
    statusDiv.innerHTML = 'Connecting to Shop...';

    conn = peer.connect(HOST_ID);

    conn.on('open', () => {
        statusDiv.innerHTML = '<span class="status-connected">Connected to Shop!</span>';
        updateCartUI();
    });

    conn.on('close', () => {
        statusDiv.innerHTML = '<span class="status-disconnected">Disconnected from Shop.</span>';
        btnOrder.disabled = true;
    });

    conn.on('error', (err) => {
        console.error('Connection Error:', err);
        statusDiv.innerHTML = '<span class="status-disconnected">Connection Error.</span>';
    });

    conn.on('data', (data) => {
        // Handle ack
        if (data && data.status) {
            alert(`Shop says: ${data.status}`);
            if (data.status === 'RECEIVED' || data.status === 'ACCEPTED') {
                cart = [];
                updateCartUI();
            }
        }
    });
}

btnOrder.addEventListener('click', () => {
    if (!conn || !conn.open) {
        alert("Not connected to shop!");
        return;
    }

    const payload = {
        table: "1", // Hardcoded for now, could be dynamic
        items: cart,
        total: cart.reduce((sum, item) => sum + item.price, 0),
        timestamp: Date.now()
    };

    conn.send(payload);
    statusDiv.innerHTML = 'Sending Order...';
});

// Init
renderMenu();
initPeer();
