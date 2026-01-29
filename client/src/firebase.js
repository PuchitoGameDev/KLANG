import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB8KESU2svI8NX7ZPrkLWiQovGEAMnTmwA",
  authDomain: "klangmusic-33.firebaseapp.com",
  projectId: "klangmusic-33",
  storageBucket: "klangmusic-33.firebasestorage.app",
  messagingSenderId: "550332856016",
  appId: "1:550332856016:web:8f505364429ab3870b10d5",
  measurementId: "G-NE65J7SSH0"
};

// Inicialización
const app = initializeApp(firebaseConfig);

// Exportaciones corregidas
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export { signInWithPopup, signOut }; // Exportamos las funciones de la librería directamente