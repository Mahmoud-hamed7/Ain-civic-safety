import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import SignalRProvider from '../../providers/SignalRProvider';

/**
 * ProtectedRoute — Guards unauthenticated access and mounts the SignalR
 * provider for the entire authenticated session.
 */
export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useAuthStore.persist.hasHydrated());
    return unsub;
  }, []);

  if (!hydrated) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <SignalRProvider>
      <Outlet />
    </SignalRProvider>
  );
}