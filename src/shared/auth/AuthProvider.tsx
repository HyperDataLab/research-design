import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthContext, type AuthValue } from './authContext';
import { authMode, firebaseConfig } from './config';
import { signInErrorMessage } from './signInError';
let loading:
  Promise<{ auth: import('firebase/auth').Auth; module: typeof import('firebase/auth') }> | undefined;
function loadAuth() {
  return (loading ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(
    ([app, module]) => ({
      auth: module.getAuth(app.getApps()[0] ?? app.initializeApp(firebaseConfig)),
      module,
    }),
  ));
}
const allowed = (email: string | null) => !!email && /^[^@\s]+@hyperdatalab\.org$/i.test(email);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthValue['user']>(() => {
    if (import.meta.env.DEV && authMode === 'dev') {
      try {
        if (sessionStorage.getItem('dev-signin'))
          return { uid: 'dev@hyperdatalab.org', email: 'dev@hyperdatalab.org', name: 'dev' };
      } catch {
        /* Storage is optional. */
      }
    }
    return null;
  });
  const [ready, setReady] = useState(authMode !== 'firebase');
  const [error, setError] = useState('');
  useEffect(() => {
    if (authMode !== 'firebase') return;
    let active = true;
    let unsubscribe = () => {};
    void loadAuth()
      .then(({ auth, module }) => {
        if (!active) return;
        unsubscribe = module.onAuthStateChanged(auth, (next) => {
          if (next && !allowed(next.email)) {
            void module.signOut(auth);
            setUser(null);
            setError('Chỉ tài khoản @hyperdatalab.org được đăng nhập.');
          } else setUser(next ? { uid: next.uid, email: next.email ?? '', name: next.displayName } : null);
          setReady(true);
        });
      })
      .catch(() => {
        if (active) {
          setError('Không tải được phần đăng nhập.');
          setReady(true);
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const signIn = useCallback(async () => {
    setError('');
    if (import.meta.env.DEV && authMode === 'dev') {
      try {
        sessionStorage.setItem('dev-signin', '1');
      } catch {
        /* Storage is optional. */
      }
      setUser({ uid: 'dev@hyperdatalab.org', email: 'dev@hyperdatalab.org', name: 'dev' });
      return;
    }
    if (authMode !== 'firebase') return;
    try {
      const { auth, module } = await loadAuth();
      const provider = new module.GoogleAuthProvider();
      provider.setCustomParameters({ hd: 'hyperdatalab.org', prompt: 'select_account' });
      const result = await module.signInWithPopup(auth, provider);
      if (!allowed(result.user.email)) {
        await module.signOut(auth);
        setError('Chỉ tài khoản @hyperdatalab.org được đăng nhập.');
      }
    } catch (cause: unknown) {
      const code =
        typeof cause === 'object' && cause !== null && 'code' in cause && typeof cause.code === 'string'
          ? cause.code
          : undefined;
      setError(signInErrorMessage(code) ?? '');
    }
  }, []);
  const signOut = useCallback(async () => {
    if (import.meta.env.DEV && authMode === 'dev') {
      try {
        sessionStorage.removeItem('dev-signin');
      } catch {
        /* Storage is optional. */
      }
      setUser(null);
      return;
    }
    if (authMode === 'firebase') {
      try {
        const { auth, module } = await loadAuth();
        await module.signOut(auth);
      } catch {
        setError('Không đăng xuất được.');
      }
    }
  }, []);
  const getIdToken = useCallback(async () => {
    if (import.meta.env.DEV && authMode === 'dev') return user ? 'dev:dev@hyperdatalab.org' : null;
    if (authMode !== 'firebase') return null;
    const { auth } = await loadAuth();
    return auth.currentUser?.getIdToken() ?? null;
  }, [user]);
  const value = useMemo(
    () => ({ mode: authMode, user, ready, error, signIn, signOut, getIdToken }),
    [user, ready, error, signIn, signOut, getIdToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
