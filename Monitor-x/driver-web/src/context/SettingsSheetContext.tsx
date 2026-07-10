import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface SettingsSheetContextValue {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}

const SettingsSheetContext = createContext<SettingsSheetContextValue | null>(null);

export function SettingsSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);

  return (
    <SettingsSheetContext.Provider value={{ open, openSheet, closeSheet }}>
      {children}
    </SettingsSheetContext.Provider>
  );
}

export function useSettingsSheet(): SettingsSheetContextValue {
  const ctx = useContext(SettingsSheetContext);
  if (!ctx) throw new Error('useSettingsSheet must be used inside SettingsSheetProvider');
  return ctx;
}
