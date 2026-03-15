import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cleanupPresence: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Update user profile in Firestore in the background
        const updateUserProfile = async () => {
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userDoc = await getDoc(userRef);
            
            const email = currentUser.email || `${currentUser.uid}@anonymous.local`;
            const username = email.split('@')[0].toLowerCase();
            
            const userData = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || 'Anonymous',
              email,
              username,
              photoURL: currentUser.photoURL || '',
              lastSeen: serverTimestamp(),
              status: 'online',
            };

            if (!userDoc.exists()) {
              await setDoc(userRef, userData);
            } else {
              await setDoc(userRef, userData, { merge: true });
            }

            // Handle offline status on tab close/logout
            const updateStatus = (status: 'online' | 'offline') => {
              setDoc(userRef, { status, lastSeen: serverTimestamp() }, { merge: true });
            };

            const handleVisibilityChange = () => {
              updateStatus(document.visibilityState === 'hidden' ? 'offline' : 'online');
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            
            // Heartbeat to keep status 'online' while tab is open
            const heartbeatInterval = setInterval(() => {
              if (document.visibilityState === 'visible') {
                updateStatus('online');
              }
            }, 30000); // Every 30 seconds for better real-time accuracy

            const handleBeforeUnload = () => {
              updateStatus('offline');
            };
            window.addEventListener('beforeunload', handleBeforeUnload);

            cleanupPresence = () => {
              document.removeEventListener('visibilitychange', handleVisibilityChange);
              window.removeEventListener('beforeunload', handleBeforeUnload);
              clearInterval(heartbeatInterval);
              updateStatus('offline');
            };
          } catch (error) {
            try {
              handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
            } catch (e) {
              // Error is already logged by handleFirestoreError
            }
          }
        };
        
        updateUserProfile();
      } else {
        if (cleanupPresence) {
          cleanupPresence();
          cleanupPresence = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (cleanupPresence) {
        cleanupPresence();
      }
    };
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
