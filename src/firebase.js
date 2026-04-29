// Importa as funções que precisamos do Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// A SUA NOVA CHAVE DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBnZqijoHs2gBpjOJMqbtnchIQ5dRhTvpE",
  authDomain: "maonaagua.firebaseapp.com",
  projectId: "maonaagua",
  storageBucket: "maonaagua.firebasestorage.app",
  messagingSenderId: "485678325929",
  appId: "1:485678325929:web:4e6f6c8edfa6ed29a609b8"
};

// Inicializa o Firebase e exporta as ferramentas para a aplicação usar
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);