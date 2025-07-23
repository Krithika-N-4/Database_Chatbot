import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDa0zbBLiy8fxLDglnvmOR2jBFXaQRysjY",
  authDomain: "database-chatbot-4341e.firebaseapp.com",
  projectId: "database-chatbot-4341e",
  storageBucket: "database-chatbot-4341e.firebasestorage.app",
  messagingSenderId: "886900640582",
  appId: "1:886900640582:web:c5c101a12cb1f19f227347"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

export { auth, storage };