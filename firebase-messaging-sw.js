importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
    apiKey: "AIzaSyBRCIwMv010KQ79YjHrs5zZnH_XnDNgIDQ",
    authDomain: "pos-system-4d0b5.firebaseapp.com",
    projectId: "pos-system-4d0b5",
    storageBucket: "pos-system-4d0b5.firebasestorage.app",
    messagingSenderId: "948004280034",
    appId: "1:948004280034:web:0c25c409673bb25ee8f0bb",
    measurementId: "G-YXWBJLLK4Q"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
});
