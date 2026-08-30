import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { Component, lazy, Suspense, useLayoutEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import { getActiveBasePath } from "@/lib/base-path";
import { AppI18nProvider } from "@/lib/i18n";

const Index = lazy(() => import("./pages/Index"));
const Admin = lazy(() => import("./pages/Admin"));
const Menu = lazy(() => import("./pages/Menu"));
const About = lazy(() => import("./pages/About"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const NotFound = lazy(() => import("./pages/NotFound"));
const routerBaseName = getActiveBasePath();

const queryClient = new QueryClient();

function RouteLoadingFallback() {
  const containerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const shell = (window as Window & { __ORBITPAGE_BOOT_SHELL_NODE__?: Element })
      .__ORBITPAGE_BOOT_SHELL_NODE__;
    if (containerRef.current && shell) {
      containerRef.current.replaceChildren(shell.cloneNode(true));
    }
  }, []);
  return <div ref={containerRef} data-orbitpage-react-shell />;
}

class ApplicationErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("OrbitPage rendering failed.", error, info);
    window.__ORBITPAGE_BOOT_REPORT__?.("react-error");
    window.__ORBITPAGE_BOOT_FAIL__?.("react-error", false);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main
        role="alert"
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Impossibile caricare la pagina</h1>
          <p style={{ margin: "10px 0 20px", color: "#64748b" }}>
            Controlla la connessione e riprova.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: "42px",
              border: 0,
              borderRadius: "10px",
              padding: "10px 18px",
              background: "#2563eb",
              color: "#fff",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Riprova
          </button>
        </div>
      </main>
    );
  }
}

function RoutedApplication() {
  const location = useLocation();
  const isEditorRoute = /^\/(?:admin|dashboard)(?:\/|$)/.test(location.pathname);
  return (
    <AppI18nProvider mode={isEditorRoute ? "editor" : "public"}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/:section" element={<Admin />} />
          <Route path="/admin/content/:contentSection" element={<Admin />} />
          <Route path="/dashboard" element={<Navigate to="/dashboard/profile" replace />} />
          <Route path="/dashboard/:section" element={<Admin />} />
          <Route path="/dashboard/content/:contentSection" element={<Admin />} />
          <Route path="/links" element={<Index />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/about" element={<About />} />
          <Route path="/:subpage" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppI18nProvider>
  );
}

const App = () => (
  <ApplicationErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={routerBaseName || undefined}>
          <RoutedApplication />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ApplicationErrorBoundary>
);

export default App;
