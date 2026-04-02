import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown frontend error",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Frontend crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "Segoe UI, sans-serif" }}>
          <h2>Frontend error</h2>
          <p>The app crashed while rendering.</p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f6f8fb", padding: 12, borderRadius: 8 }}>
            {this.state.errorMessage}
          </pre>
          <p>Open browser console for full stack trace.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
