import { useEffect } from "react";
import { Navigate } from "react-router-dom";

/** Settings lives in a shell dialog — deep link opens it via ?settings=. */
export default function VoiceAgentsSettingsPage() {
  useEffect(() => {
    document.title = "Settings · Voice Agents · Kupe";
  }, []);

  return <Navigate to="/voice-agents?openSettings=workspace" replace />;
}
