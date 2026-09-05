import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBoR1Q8vPIqvSvCvHUMUE17GiSRh9KnPXc",
  authDomain: "saitou-ai.firebaseapp.com",
  projectId: "saitou-ai",
  storageBucket: "saitou-ai.firebasestorage.app",
  messagingSenderId: "370411994775",
  appId: "1:370411994775:web:d667575c4d501a11eb33d2"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

const VAPID_KEY = "BBoONTIJZQOgXUjTBE-gPCHu9_-a2ZMQW6QEncfskcxik0qhvCuU3LQ-IBoPENsFMEJUJ-8Mze3Rphi0FyKlxfM";

export async function mintaIzinDanAmbilToken() {
  try {
    const izin = await Notification.requestPermission();
    if (izin !== "granted") {
      console.log("Izin notifikasi ditolak");
      return null;
    }
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token;
  } catch (err) {
    console.error("Gagal ambil token FCM:", err);
    return null;
  }
}

export function dengarkanNotifikasiForeground(callback) {
  onMessage(messaging, callback);
}
