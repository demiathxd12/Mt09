import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signIn: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[Auth] Initializing Auth Listener...");
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("[Auth] State Changed. User:", currentUser?.email || "None");
      
      try {
        if (currentUser) {
          // Attempt to sync user profile with Firestore
          const userRef = doc(db, 'users', currentUser.uid);
          const email = currentUser.email || `${currentUser.uid}@anonymous.local`;
          
          const userData = {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Anonymous',
            email,
            username: email.split('@')[0].toLowerCase(),
            photoURL: currentUser.photoURL || '',
            lastSeen: serverTimestamp(),
            status: 'online',
          };

          // We use setDoc with merge: true to avoid overwriting existing data if not needed
          // and to ensure the user document exists for security rules.
          await setDoc(userRef, userData, { merge: true }).catch(err => {
            console.error("[Auth] Firestore Sync Error:", err.message);
            // We don't block the login if Firestore sync fails (could be rules or network)
          });
        }
        
        setUser(currentUser);
      } catch (err: any) {
        console.error("[Auth] Unexpected Error in Auth Listener:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setLoading(true);
    setError(null);
    console.log("[Auth] Starting Google Sign-In...");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("[Auth] Sign-In Successful for:", result.user.email);
    } catch (err: any) {
      console.error("[Auth] Sign-In Error:", err.code, err.message);
      
      // Handle specific Firebase Auth errors for better UX
      if (err.code === 'auth/popup-blocked') {
        setError("El navegador bloqueó la ventana emergente. Por favor, actívala.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("Este dominio no está autorizado en la consola de Firebase.");
      } else {
        setError("Error al iniciar sesión: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      // Try to set status to offline before logging out
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, { status: 'offline', lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
      }
      await signOut(auth);
    } catch (err: any) {
      console.error("[Auth] Logout Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
