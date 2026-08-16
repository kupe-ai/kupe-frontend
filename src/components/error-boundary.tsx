import { Component, type ErrorInfo, type ReactNode } from "react";
import { posthog, isPosthogConfigured } from "../lib/posthog";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time crashes React would otherwise swallow silently and
 * reports them to PostHog error tracking. window.onerror / unhandledrejection
 * (enabled via `capture_exceptions: true` in lib/posthog.ts) do NOT see
 * errors thrown during React's render/commit phase — only this boundary does.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isPosthogConfigured()) {
      posthog.captureException(error, {
        service: "kupe-frontend",
        react_component_stack: info.componentStack,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <p>Something went wrong. Please refresh the page.</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
