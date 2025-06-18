import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get fresh token and store it
          const token = await firebaseUser.getIdToken(true);
          localStorage.setItem('firebaseToken', token);
          setUser(firebaseUser);
        } catch (error) {
          console.error('Token refresh failed:', error);
          localStorage.removeItem('firebaseToken');
          setUser(null);
        }
      } else {
        localStorage.removeItem('firebaseToken');
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshToken = async () => {
    if (user) {
      try {
        const token = await user.getIdToken(true);
        localStorage.setItem('firebaseToken', token);
        return token;
      } catch (error) {
        console.error('Token refresh failed:', error);
        localStorage.removeItem('firebaseToken');
        return null;
      }
    }
    return null;
  };

  return {
    user,
    loading,
    refreshToken,
    isAuthenticated: !!user
  };
}