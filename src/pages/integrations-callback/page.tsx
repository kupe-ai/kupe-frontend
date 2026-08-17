import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

/**
 * Composio's OAuth flow lands here after the user finishes connecting an
 * app (Gmail, Slack, ...). This page is opened in a popup by
 * pages/voice-agents/integrations/page.tsx, never navigated to directly.
 *
 * Previously the callback_url pointed straight at /integrations, which
 * made the popup reload the *entire app* into a second, disconnected tab
 * that the user had to notice and close by hand -- the original tab never
 * found out the connection had finished. Instead: tell the opener we're
 * done via postMessage, then close this window immediately so the user
 * lands back on the tab they started from.
 */
export default function IntegrationsCallbackPage() {
  const [canClose, setCanClose] = useState(true);

  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ source: "kupe-composio-callback", status: "done" }, window.location.origin);
      } catch {
        // opener from a different origin than expected -- fall through to redirect below
      }
      window.close();
      // window.close() only works on windows the app itself opened; if the
      // browser refuses (e.g. user navigated here directly), fall back to
      // taking them to the integrations page instead of a dead end.
      setTimeout(() => setCanClose(false), 300);
    } else {
      setCanClose(false);
    }
  }, []);

  if (!canClose) {
    return <Navigate to="/integrations" replace />;
  }

  return (
    <div className="flex h-svh w-full items-center justify-center bg-background">
      <div className="animate-pulse text-sm text-muted-foreground">Finishing connection…</div>
    </div>
  );
}
