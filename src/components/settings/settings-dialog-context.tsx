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

export type SettingsSectionId = "account" | "workspace" | "keys";

/** Legacy `appearance` deep-links land on Account, where theme now lives. */
export function normalizeSettingsSection(id?: string | null): SettingsSectionId {
  if (id === "workspace" || id === "keys" || id === "account") return id;
  return "account";
}

type SettingsDialogContextValue = {
  open: boolean;
  section: SettingsSectionId;
  /** Opens the dialog; returns false when settings are not available. */
  openSettings: (section?: string) => boolean;
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
  const [section, setSectionState] = useState<SettingsSectionId>("account");

  const setSection = useCallback((next: SettingsSectionId) => {
    setSectionState(normalizeSettingsSection(next));
  }, []);

  const openSettings = useCallback(
    (next?: string) => {
      if (!enabled) return false;
      if (next) setSectionState(normalizeSettingsSection(next));
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
  }, [enabled, setSection]);

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
    [open, section, openSettings, closeSettings, setSection],
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
