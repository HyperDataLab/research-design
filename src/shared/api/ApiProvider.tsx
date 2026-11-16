import { useMemo, type ReactNode } from 'react';
import { useAuth } from '../auth/authContext';
import { workerUrl } from '../auth/config';
import { createApiClient, type ApiClient } from './client';
import { ApiContext } from './apiContext';
export function ApiProvider({ children, client }: { children: ReactNode; client?: ApiClient }) {
  const { getIdToken } = useAuth();
  const api = useMemo(
    () => client ?? createApiClient({ baseUrl: workerUrl, getToken: getIdToken }),
    [client, getIdToken],
  );
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
