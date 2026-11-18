import React, { createContext, useCallback, useContext } from 'react';
import { useRouter } from 'expo-router';
import { useMonitor } from './useMonitor';
import { useNotifications } from './useNotifications';

type MonitorState = {
  monitor: ReturnType<typeof useMonitor>;
  notifications: ReturnType<typeof useNotifications>;
  openBin: (id: string) => void;
};
const MonitorContext = createContext<MonitorState | null>(null);

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const monitor = useMonitor();
  const router = useRouter();
  const openBin = useCallback((id: string) => {
    router.push({ pathname: '/bin/[id]', params: { id } });
  }, [router]);
  const notifications = useNotifications(monitor, openBin);
  return <MonitorContext.Provider value={{ monitor, notifications, openBin }}>{children}</MonitorContext.Provider>;
}

export function useMonitorContext() {
  const value = useContext(MonitorContext);
  if (!value) throw new Error('MonitorProvider is missing.');
  return value;
}
