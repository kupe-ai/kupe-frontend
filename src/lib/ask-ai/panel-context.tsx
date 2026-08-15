import { createContext, useContext, useState, type ReactNode } from "react";

const AskAiPanelContext = createContext<{
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
} | null>(null);

export function AskAiPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AskAiPanelContext.Provider
      value={{ open, setOpen, toggle: () => setOpen((v) => !v) }}
    >
      {children}
    </AskAiPanelContext.Provider>
  );
}

export function useAskAiPanel() {
  const ctx = useContext(AskAiPanelContext);
  if (!ctx) {
    return { open: false, toggle: () => undefined, setOpen: () => undefined };
  }
  return ctx;
}
