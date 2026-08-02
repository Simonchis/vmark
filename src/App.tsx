import { Component, type ReactNode } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { CheckCircle, XCircle, Info, AlertTriangle, Loader2 } from "lucide-react";
import { AppRoutes } from "@/app/AppRoutes";
import { WindowProvider } from "@/contexts/WindowContext";
import { cssVars } from "@/theme";
import { appError } from "@/utils/debug";

// Error Boundary to catch and display React errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<
  { children: ReactNode } & WithTranslation<"dialog">,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    appError("Caught error:", error);
    appError("Error info:", errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <div style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ color: cssVars.color.semantic.error, marginBottom: 16 }}>{t("errorBoundary.title")}</h1>
          <pre style={{
            padding: 16,
            background: cssVars.color.semantic.errorBg,
            borderRadius: 8,
            overflow: "auto",
            fontSize: 14,
          }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const ErrorBoundary = withTranslation("dialog")(ErrorBoundaryInner);

function App() {
  return (
    <ErrorBoundary>
      <WindowProvider>
        <AppRoutes />
        <Toaster
          position="top-center"
          closeButton
          icons={{
            success: <CheckCircle size={16} />,
            error: <XCircle size={16} />,
            info: <Info size={16} />,
            warning: <AlertTriangle size={16} />,
            loading: <Loader2 size={16} className="animate-spin" />,
          }}
        />
      </WindowProvider>
    </ErrorBoundary>
  );
}

export default App;
