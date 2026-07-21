import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
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

function RoutedApplication() {
  const location = useLocation();
  const isEditorRoute = /^\/(?:admin|dashboard)(?:\/|$)/.test(location.pathname);
  return (
    <AppI18nProvider mode={isEditorRoute ? "editor" : "public"}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/:section" element={<Admin />} />
          <Route path="/dashboard" element={<Navigate to="/dashboard/profile" replace />} />
          <Route path="/dashboard/:section" element={<Admin />} />
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={routerBaseName || undefined}>
        <RoutedApplication />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
