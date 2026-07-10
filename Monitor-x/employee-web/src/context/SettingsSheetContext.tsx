import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface SettingsSheetContextValue {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  feedbackOpen: boolean;
  openFeedback: () => void;
  closeFeedback: () => void;
}

const SettingsSheetContext = createContext<SettingsSheetContextValue | null>(null);

export function SettingsSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);
  // Opening feedback always closes the sheet first — the two overlays never show together.
  const openFeedback = useCallback(() => {
    setOpen(false);
    setFeedbackOpen(true);
  }, []);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);

  return (
    <SettingsSheetContext.Provider value={{ open, openSheet, closeSheet, feedbackOpen, openFeedback, closeFeedback }}>
      {children}
    </SettingsSheetContext.Provider>
  );
}

export function useSettingsSheet(): SettingsSheetContextValue {
  const ctx = useContext(SettingsSheetContext);
  if (!ctx) throw new Error('useSettingsSheet must be used inside SettingsSheetProvider');
  return ctx;
}
