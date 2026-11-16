import { createContext, useContext } from 'react';
import { authMode } from './config';
export interface AuthValue {
  mode: 'firebase' | 'dev' | 'unconfigured';
  user: { uid: string; email: string; name: string | null } | null;
  ready: boolean;
  error: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}
export const AuthContext = createContext<AuthValue>({
  mode: authMode,
  user: null,
  ready: true,
  error: '',
  signIn: async () => {},
  signOut: async () => {},
  getIdToken: async () => null,
});
export const useAuth = () => useContext(AuthContext);
