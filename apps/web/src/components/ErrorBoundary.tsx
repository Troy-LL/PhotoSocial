import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PhotoSocial render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            maxWidth: 480,
            margin: "40px auto",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.25rem" }}>Something went wrong</h1>
          <p style={{ color: "#666", lineHeight: 1.5 }}>
            The app hit an error while loading. Try a hard refresh (Ctrl+Shift+R)
            or clear site data for localhost.
          </p>
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              background: "#f5f5f5",
              borderRadius: 8,
              fontSize: 12,
              overflow: "auto",
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            style={{
              marginTop: 16,
              padding: "12px 20px",
              borderRadius: 8,
              border: "none",
              background: "#2d6a4f",
              color: "#fff",
              cursor: "pointer",
            }}
            onClick={() => window.location.assign("/")}
          >
            Reload home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

