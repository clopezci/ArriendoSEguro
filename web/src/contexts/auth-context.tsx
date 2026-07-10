"use client";

import { getAuthClient, isFirebaseClientConfigured } from "@/lib/firebase/client";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthState = {
  user: User | null;
  loading: boolean;
  configError: boolean;
  signIn: (email: string, password: string) => Promise<string>;
  signUp: (email: string, password: string) => Promise<string>;
  signInWithGoogle: () => Promise<string>;
  /** Acceso con Google por REDIRECT (fiable en móvil). Navega fuera y vuelve. */
  signInWithGoogleRedirect: () => Promise<void>;
  /** Al volver del redirect, devuelve el uid autenticado (o null si no aplica). */
  consumeGoogleRedirect: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      setConfigError(true);
      setLoading(false);
      return;
    }
    const auth = getAuthClient();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string> => {
    if (!isFirebaseClientConfigured()) throw new Error("Firebase no configurado");
    const cred = await signInWithEmailAndPassword(getAuthClient(), email.trim(), password);
    return cred.user.uid;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<string> => {
    if (!isFirebaseClientConfigured()) throw new Error("Firebase no configurado");
    const cred = await createUserWithEmailAndPassword(getAuthClient(), email.trim(), password);
    return cred.user.uid;
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<string> => {
    if (!isFirebaseClientConfigured()) throw new Error("Firebase no configurado");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    // Popup (no redirect) para no perder el estado del recorrido en el que está.
    const cred = await signInWithPopup(getAuthClient(), provider);
    return cred.user.uid;
  }, []);

  const signInWithGoogleRedirect = useCallback(async () => {
    if (!isFirebaseClientConfigured()) throw new Error("Firebase no configurado");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithRedirect(getAuthClient(), provider);
  }, []);

  const consumeGoogleRedirect = useCallback(async (): Promise<string | null> => {
    if (!isFirebaseClientConfigured()) return null;
    try {
      const res = await getRedirectResult(getAuthClient());
      return res?.user?.uid ?? null;
    } catch {
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!isFirebaseClientConfigured()) return;
    await firebaseSignOut(getAuthClient());
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!isFirebaseClientConfigured()) throw new Error("Firebase no configurado");
    await sendPasswordResetEmail(getAuthClient(), email.trim());
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configError,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithGoogleRedirect,
      consumeGoogleRedirect,
      resetPassword,
      signOut,
    }),
    [user, loading, configError, signIn, signUp, signInWithGoogle, signInWithGoogleRedirect, consumeGoogleRedirect, resetPassword, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth dentro de AuthProvider");
  return ctx;
}
