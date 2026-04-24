import { getApps, initializeApp, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isConfigComplete(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

let browserApp: FirebaseApp | null = null;

export function isFirebaseClientConfigured(): boolean {
  if (typeof window === "undefined") return false;
  return isConfigComplete();
}

export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase app solo en el cliente");
  }
  if (browserApp) return browserApp;
  if (getApps().length > 0) {
    browserApp = getApp();
    return browserApp;
  }
  if (!isConfigComplete()) {
    throw new Error("Faltan variables NEXT_PUBLIC_FIREBASE_* (revisa .env.local)");
  }
  browserApp = initializeApp(firebaseConfig);
  return browserApp;
}

export function getAuthClient(): Auth {
  return getAuth(getFirebaseApp());
}
