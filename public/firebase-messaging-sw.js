importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBoR1Q8vPIqvSvCvHUMUE17GiSRh9KnPXc",
  authDomain: "saitou-ai.firebaseapp.com",
  projectId: "saitou-ai",
  storageBucket: "saitou-ai.firebasestorage.app",
  messagingSenderId: "370411994775",
  appId: "1:370411994775:web:d667575c4d501a11eb33d2"
});

const messaging = firebase.messaging();

// Pesan FCM yang punya blok "notification" ditampilkan otomatis oleh SDK.
// Jangan tambahkan onBackgroundMessage + showNotification di sini: SDK tetap
// memanggil handler itu SETELAH menampilkan sendiri, jadi notifikasinya dobel.
// Baris firebase.messaging() di atas tetap wajib ada, itu yang memasang
// penangan push bawaan SDK.
