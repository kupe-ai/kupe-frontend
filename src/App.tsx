import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import AppRoutes from "@/app/routes";
import { AuthProvider } from "@/lib/useAuth";
import { WorkspaceProvider } from "@/context/workspace-context";
import { FeatureFlagsProvider } from "@/context/feature-flags-context";
import { SessionBridgeProvider } from "@/context/session-context";
import { AskAiPanelProvider } from "@/lib/ask-ai/panel-context";
import { AskAiPanel } from "@/components/ask-ai/ask-ai-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 15_000 },
  },
});

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
          <WorkspaceProvider>
            <FeatureFlagsProvider>
            <SessionBridgeProvider>
              <AskAiPanelProvider>
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
                <AskAiPanel />
                <Toaster />
              </AskAiPanelProvider>
            </SessionBridgeProvider>
            </FeatureFlagsProvider>
          </WorkspaceProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
