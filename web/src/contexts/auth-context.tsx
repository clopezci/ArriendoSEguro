"use client";

import { getAuthClient, isFirebaseClientConfigured } from "@/lib/firebase/client";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth,
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
  /** `remember` (por defecto true): mantiene la sesión en este dispositivo
   * (browserLocalPersistence). Si es false, la sesión dura solo hasta cerrar el
   * navegador (browserSessionPersistence). */
  signIn: (email: string, password: string, remember?: boolean) => Promise<string>;
  signUp: (email: string, password: string, remember?: boolean) => Promise<string>;
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

  /** Fija la persistencia (recordar en este dispositivo o solo esta sesión). */
  const applyPersistence = useCallback(async (auth: Auth, remember: boolean) => {
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    } catch {
      /* si el navegador no soporta cambiarla, se queda con la predeterminada */
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember = true): Promise<string> => {
    if (!isFirebaseClientConfigured()) throw new Error("Firebase no configurado");
    const auth = getAuthClient();
    await applyPersistence(auth, remember);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user.uid;
  }, [applyPersistence]);

  const signUp = useCallback(async (email: string, password: string, remember = true): Promise<string> => {
    if (!isFirebaseClientConfigured()) throw new Error("Firebase no configurado");
    const auth = getAuthClient();
    await applyPersistence(auth, remember);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    return cred.user.uid;
  }, [applyPersistence]);

  const signInWithGoogle = useCallback(async (): Promise<string> => {
    if (!isFirebaseClientConfigured()) throw new Error("Firebase no configurado");
    // IMPORTANTE: NO poner ningún `await` antes de signInWithPopup. El navegador
    // exige que el popup (window.open) se abra de forma SÍNCRONA dentro del gesto
    // del clic; cualquier await previo (p. ej. setPersistence) consume el gesto y
    // el popup se bloquea → auth/internal-error. La persistencia por defecto ya es
    // local (browserLocalPersistence), que es justo lo que queremos.
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
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
