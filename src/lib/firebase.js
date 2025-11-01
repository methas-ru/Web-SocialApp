import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBjCSnwn2L6gapz7GYtSSQn1Y-9dRyYTaU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "see-you-next-time-4fa1b.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "see-you-next-time-4fa1b",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "see-you-next-time-4fa1b.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1040558147531",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1040558147531:web:a92d78ff7db4caf617584e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-GK242RJBV5",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Analytics (optional, only in production)
let analytics = null;
if (typeof window !== "undefined" && import.meta.env.PROD) {
  analytics = getAnalytics(app);
}

export { analytics };

