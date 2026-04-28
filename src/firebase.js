import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// COPIE E COLE AS SUAS CHAVES REAIS AQUI DO FIREBASE:
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "maonaagua-....firebaseapp.com",
  projectId: "maonaagua-...",
  storageBucket: "maonaagua-....appspot.com",
  messagingSenderId: "12345678",
  appId: "1:1234567:web:abcd..."
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);