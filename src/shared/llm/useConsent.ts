import { useCallback, useEffect, useState } from 'react';
import type { ConsentState } from '@/core/llm/contract';
import { useApi } from '@/shared/api/apiContext';
import { useAuth } from '@/shared/auth/authContext';
export function useConsent() {
  const api = useApi();
  const { user } = useAuth();
  const [record, setRecord] = useState<{ uid: string; state: ConsentState } | null>(null);
  const state = record && user && record.uid === user.uid ? record.state : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      setRecord({ uid: user.uid, state: await api.getConsent() });
    } catch {
      setRecord(null);
      setError('Không tải được trạng thái đồng ý.');
    } finally {
      setLoading(false);
    }
  }, [api, user]);
  useEffect(() => {
    if (user) void Promise.resolve().then(reload);
    else void Promise.resolve().then(() => setRecord(null));
  }, [user, reload]);
  const accept = async () => {
    if (!state || !user) return;
    setLoading(true);
    setError('');
    try {
      setRecord({
        uid: user.uid,
        state: await api.acceptConsent(state.required.version, state.required.provider),
      });
    } catch {
      setError('Không lưu được sự đồng ý.');
    } finally {
      setLoading(false);
    }
  };
  return {
    state,
    loading,
    error,
    accept,
    reload,
    ready: !!user && !!state?.configured && state.accepted !== null,
  };
}
