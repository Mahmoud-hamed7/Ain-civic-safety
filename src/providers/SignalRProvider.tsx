/**
 * SignalRProvider — Global real-time hub connection for all authenticated pages.
 *
 * Lifecycle:
 * 1. Builds connection with JWT Bearer token via accessTokenFactory
 * 2. Registers all event handlers BEFORE starting
 * 3. Starts connection with automatic retry on failure
 * 4. Stops cleanly on unmount or token change
 *
 * Events handled:
 * - ReceiveSOSTriggered     → SOS toast + notification bell + query invalidation
 * - ReceiveSOSResolved      → success toast + notification + query invalidation
 * - ReceiveSOSCancelled     → info toast + query invalidation
 * - ReceiveSOSMarkedAsFalseAlarm → info toast + query invalidation
 * - ReceiveSeverityChanged  → warning toast + query invalidation
 * - ReceiveLocationUpdate   → live query data patch (no toast)
 */
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useQueryClient } from '@tanstack/react-query';
import type { SOSLocationDto } from '../types';

export type ConnectionState = 'Connected' | 'Reconnecting' | 'Disconnected';

export interface SOSBanner {
  alertId: string;
  communityName: string;
  severity: string;
}

export interface SignalRContextType {
  connection: signalR.HubConnection | null;
  connectionState: ConnectionState;
  isConnected: boolean;
  joinCommunityGroup: (communityId: string) => Promise<void>;
  leaveCommunityGroup: (communityId: string) => Promise<void>;
  /** Persistent banner shown to community members when an SOS is triggered by someone else. */
  sosBanner: SOSBanner | null;
  dismissSosBanner: () => void;
}

const SignalRContext = createContext<SignalRContextType>({
  connection: null,
  connectionState: 'Disconnected',
  isConnected: false,
  joinCommunityGroup: async () => { },
  leaveCommunityGroup: async () => { },
  sosBanner: null,
  dismissSosBanner: () => { },
});

/* ── Audio synthesis ── */
const playAlertSound = (severity: string) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (severity === 'Critical') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      // Double beep
      setTimeout(() => {
        try {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.type = 'square';
          o2.frequency.setValueAtTime(880, ctx.currentTime);
          o2.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
          g2.gain.setValueAtTime(0.3, ctx.currentTime);
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          o2.start(); o2.stop(ctx.currentTime + 0.5);
        } catch { /* ignore */ }
      }, 200);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Browser blocks audio until user gesture — silently ignore
  }
};

export default function SignalRProvider({ children }: { children: ReactNode }) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('Disconnected');
  const [sosBanner, setSosBanner] = useState<SOSBanner | null>(null);

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const addToast = useNotificationStore((s) => s.addToast);
  const addNotif = useNotificationStore((s) => s.addNotification);
  const queryClient = useQueryClient();

  const dismissSosBanner = useCallback(() => setSosBanner(null), []);
  
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    let startPromise: Promise<void> | null = null;

    const hubUrl = import.meta.env.VITE_SIGNALR_HUB_URL || `${import.meta.env.VITE_API_BASE_URL}/hub/sos`;
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
        headers: { "ngrok-skip-browser-warning": "true" }
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = conn;

    conn.on('ReceiveSOSTriggered', (_communityId: string, alert: any) => {
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['sos'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'sos-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard-summary'] });

      // Determine correct action link based on user role
      const isAuthorityOrAdmin = user?.role === 'Authority' || user?.role === 'Admin' || (Array.isArray(user?.role) && (user.role.includes('Authority') || user.role.includes('Admin')));
      const actionLink = isAuthorityOrAdmin ? '/authority/sos' : undefined;

      addToast({
        type: 'sos',
        title: 'New SOS Alert',
        description: alert.message || 'An emergency has been reported.',
        communityName: alert.communityName ?? alert.communityId,
        severity: alert.severity,
        actionLink: actionLink,
      });

      addNotif({
        type: 'sos',
        title: `SOS Alert — ${alert.severity ?? 'Unknown'}`,
        description: alert.message || `New SOS alert in ${alert.communityName ?? 'a community'}.`,
      });

      playAlertSound(alert.severity);

      // Show persistent banner for community members who did NOT trigger this alert
      const myId = user?.id ?? '';
      if (alert.initiatorUserId !== myId) {
        setSosBanner({
          alertId:       alert.id,
          communityName: alert.communityName ?? 'your community',
          severity:      alert.severity ?? 'Standard',
        });
      }
    });

    conn.on('ReceiveSOSResolved', (sosAlertId?: string) => {
      queryClient.invalidateQueries({ queryKey: ['sos', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['sos'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'sos-overview'] });
      addToast({ type: 'success', title: 'SOS Resolved', description: 'An active SOS alert has been resolved.' });
      addNotif({ type: 'sos', title: 'SOS Resolved', description: 'An active SOS alert has been resolved.' });
      setSosBanner((prev) => (!prev || !sosAlertId || prev.alertId === sosAlertId) ? null : prev);
    });

    conn.on('ReceiveSOSCancelled', (sosAlertId?: string) => {
      queryClient.invalidateQueries({ queryKey: ['sos'] });
      addToast({ type: 'info', title: 'SOS Cancelled', description: 'An SOS alert was cancelled by the initiator.' });
      setSosBanner((prev) => (!prev || !sosAlertId || prev.alertId === sosAlertId) ? null : prev);
    });

    conn.on('ReceiveSOSMarkedAsFalseAlarm', () => {
      queryClient.invalidateQueries({ queryKey: ['sos'] });
      addToast({ type: 'info', title: 'False Alarm', description: 'An SOS alert was marked as a false alarm.' });
    });

    conn.on('ReceiveSeverityChanged', (_alertId: string, severity: string) => {
      queryClient.invalidateQueries({ queryKey: ['sos'] });
      addToast({
        type: 'warning',
        title: 'Severity Escalated',
        description: `SOS alert severity changed to ${severity}.`,
        severity,
      });
      addNotif({
        type: 'sos',
        title: `Severity → ${severity}`,
        description: `An SOS alert has been escalated to ${severity}.`,
      });
      if (severity === 'Critical') playAlertSound(severity);
    });

    conn.on('ReceiveLocationUpdate', (sosAlertId: string, location: SOSLocationDto) => {
      queryClient.setQueryData(['sos', sosAlertId, 'locations'], (old: SOSLocationDto[] | undefined) =>
        old ? [...old, location] : [location]
      );
      queryClient.invalidateQueries({ queryKey: ['sos', sosAlertId, 'live-state'] });
    });

    conn.on('ReceiveReportStatusChanged', (reportId: string, newStatus: string) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      
      // Determine correct report link based on user role
      const isAuthorityOrAdmin = user?.role === 'Authority' || user?.role === 'Admin' || (Array.isArray(user?.role) && (user.role.includes('Authority') || user.role.includes('Admin')));
      const reportLink = isAuthorityOrAdmin 
        ? `/authority/report/${reportId}` 
        : `/citizen/report/${reportId}`;

      addToast({ type: 'info', title: 'Report Updated', description: `A report status changed to ${newStatus}.` });
      addNotif({ type: 'report', title: 'Report Status Changed', description: `Report status updated to "${newStatus}".`, link: reportLink });
    });

    conn.on('ReceiveLocationStale', (sosAlertId: string, secondsSinceLastPing: number) => {
      queryClient.invalidateQueries({ queryKey: ['sos', sosAlertId, 'live-state'] });
      queryClient.setQueriesData<{ data: any[];[k: string]: any }>(
        { queryKey: ['sos', 'list'] },
        (old) => old
          ? { ...old, data: old.data.map((a: any) => a.id === sosAlertId ? { ...a, isLocationStale: true } : a) }
          : old,
      );
      addToast({
        type: 'warning',
        title: 'Location Signal Lost',
        description: `SOS initiator location hasn't updated in ${Math.round(secondsSinceLastPing)}s.`,
      });
      addNotif({
        type: 'sos',
        title: 'Location Signal Lost',
        description: `No location ping for ${Math.round(secondsSinceLastPing)} seconds.`,
      });
    });

    conn.on('ReceiveLocationRestored', (sosAlertId: string) => {
      queryClient.invalidateQueries({ queryKey: ['sos', sosAlertId, 'live-state'] });
      queryClient.setQueriesData<{ data: any[];[k: string]: any }>(
        { queryKey: ['sos', 'list'] },
        (old) => old
          ? { ...old, data: old.data.map((a: any) => a.id === sosAlertId ? { ...a, isLocationStale: false } : a) }
          : old,
      );
      addToast({ type: 'success', title: 'Location Restored', description: 'SOS initiator location signal resumed.' });
    });

    conn.on('ReceiveSOSMemberActivated', (_sosAlertId: string, _userId: string, memberName: string) => {
      queryClient.invalidateQueries({ queryKey: ['sos'] });
      addNotif({
        type: 'sos',
        title: 'Member Activated',
        description: `${memberName} is now actively tracking this SOS alert.`,
      });
    });

    conn.onreconnecting(() => {
      if (isMounted) setConnectionState('Reconnecting');
    });

    conn.onreconnected(() => {
      if (isMounted) setConnectionState('Connected');
    });

    conn.onclose(() => {
      if (isMounted) setConnectionState('Disconnected');
    });

    const start = async () => {
      try {
        startPromise = conn.start();
        await startPromise;
        if (isMounted) {
          setConnectionState('Connected');
        } else {
          await conn.stop();
        }
      } catch (err: any) {
        if (!isMounted) return;
        setConnectionState('Disconnected');
        setTimeout(start, 5000);
      }
    };

    start();

    return () => {
      isMounted = false;
      if (startPromise) {
        startPromise.then(() => {
          conn.stop().catch(() => { });
        }).catch(() => { });
      } else {
        conn.stop().catch(() => { });
      }
      setConnectionState('Disconnected');
    };
  }, [token, user, addNotif, addToast, queryClient]);

  const joinCommunityGroup = async (communityId: string) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      await connectionRef.current.invoke('JoinCommunityGroup', communityId).catch(console.error);
    }
  };

  const leaveCommunityGroup = async (communityId: string) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      await connectionRef.current.invoke('LeaveCommunityGroup', communityId).catch(console.error);
    }
  };

  return (
    <SignalRContext.Provider
      value={{
        connection: connectionRef.current,
        connectionState,
        isConnected: connectionState === 'Connected',
        joinCommunityGroup,
        leaveCommunityGroup,
        sosBanner,
        dismissSosBanner,
      }}
    >
      {children}
    </SignalRContext.Provider>
  );
}

export function useSignalR(): SignalRContextType {
  return useContext(SignalRContext);
}