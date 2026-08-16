"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SettingsSectionId = "appearance" | "account" | "workspace" | "keys";

type SettingsDialogContextValue = {
  open: boolean;
  section: SettingsSectionId;
  /** Opens the dialog; returns false when settings are not available. */
  openSettings: (section?: SettingsSectionId) => boolean;
  closeSettings: () => void;
  setSection: (section: SettingsSectionId) => void;
};

const SettingsDialogContext = createContext<SettingsDialogContextValue | null>(null);

export function SettingsDialogProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSectionId>("appearance");

  const openSettings = useCallback(
    (next?: SettingsSectionId) => {
      if (!enabled) return false;
      if (next) setSection(next);
      setOpen(true);
      return true;
    },
    [enabled],
  );

  const closeSettings = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "," || !(e.metaKey || e.ctrlKey) || e.shiftKey) return;
      e.preventDefault();
      setSection("workspace");
      setOpen((v) => !v);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  const value = useMemo(
    () => ({
      open,
      section,
      openSettings,
      closeSettings,
      setSection,
    }),
    [open, section, openSettings, closeSettings],
  );

  return (
    <SettingsDialogContext.Provider value={value}>
      {children}
    </SettingsDialogContext.Provider>
  );
}

export function useSettingsDialog() {
  const ctx = useContext(SettingsDialogContext);
  if (!ctx) {
    throw new Error("useSettingsDialog must be used within SettingsDialogProvider");
  }
  return ctx;
}

/** Safe when provider may be absent (e.g. public routes). */
export function useSettingsDialogOptional() {
  return useContext(SettingsDialogContext);
}
