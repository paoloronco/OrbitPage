import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { lazy, Suspense, useLayoutEffect, useRef, type ReactNode } from "react";
import { getActiveBasePath } from "@/lib/base-path";
import { AppI18nProvider } from "@/lib/i18n";
import { parseLocalizedPublicPath, publicLocaleFromSlug } from "@/lib/public-routing";
import { adminSubsectionFromLocation, isAdminLocation } from "@/lib/admin-navigation";
import { ApplicationErrorBoundary } from "@/components/ApplicationErrorBoundary";

const Index = lazy(() => import("./pages/Index"));
const Admin = lazy(() => import("./pages/Admin"));
const Menu = lazy(() => import("./pages/Menu"));
const About = lazy(() => import("./pages/About"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const Newsletter = lazy(() => import("./pages/Newsletter"));
const ShopPurchase = lazy(() => import("./pages/ShopPurchase"));
const NotFound = lazy(() => import("./pages/NotFound"));
const routerBaseName = getActiveBasePath();

const queryClient = new QueryClient();

function AdminDashboardRoute() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  const index = segments.findIndex((segment) => segment === "dashboard" || segment === "admin");
  const nested = segments[index + 1] !== "content" && segments.length === index + (segments[index + 1] === "editor" ? 4 : 3);
  return !nested || adminSubsectionFromLocation(pathname) ? <Admin /> : <NotFound />;
}

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

function RoutedApplication() {
  const location = useLocation();
  const isEditorRoute = isAdminLocation(location.pathname);
  return (
    <AppI18nProvider mode={isEditorRoute ? "editor" : "public"}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/admin" element={<AdminDashboardRoute />} />
          <Route path="/admin/:section" element={<AdminDashboardRoute />} />
          <Route path="/admin/content/:contentSection" element={<AdminDashboardRoute />} />
          <Route path="/dashboard" element={<AdminDashboardRoute />} />
          <Route path="/dashboard/:section" element={<AdminDashboardRoute />} />
          <Route path="/dashboard/content/:contentSection" element={<AdminDashboardRoute />} />
          <Route path="/dashboard/editor/:editorSection" element={<AdminDashboardRoute />} />
          <Route path="/dashboard/:section/:subsection" element={<AdminDashboardRoute />} />
          <Route path="/dashboard/editor/:editorSection/:subsection" element={<AdminDashboardRoute />} />
          <Route path="/:locale/dashboard" element={<LocalizedPublicRoute><AdminDashboardRoute /></LocalizedPublicRoute>} />
          <Route path="/:locale/dashboard/:section" element={<LocalizedPublicRoute><AdminDashboardRoute /></LocalizedPublicRoute>} />
          <Route path="/:locale/dashboard/content/:contentSection" element={<LocalizedPublicRoute><AdminDashboardRoute /></LocalizedPublicRoute>} />
          <Route path="/:locale/dashboard/editor/:editorSection" element={<LocalizedPublicRoute><AdminDashboardRoute /></LocalizedPublicRoute>} />
          <Route path="/:locale/dashboard/:section/:subsection" element={<LocalizedPublicRoute><AdminDashboardRoute /></LocalizedPublicRoute>} />
          <Route path="/:locale/dashboard/editor/:editorSection/:subsection" element={<LocalizedPublicRoute><AdminDashboardRoute /></LocalizedPublicRoute>} />
          <Route path="/links" element={<Index />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/about" element={<About />} />
          <Route path="/newsletter" element={<Newsletter />} />
          <Route path="/newsletter/status" element={<Newsletter />} />
          <Route path="/shop/success" element={<ShopPurchase />} />
          <Route path="/shop/download" element={<ShopPurchase />} />
          <Route path="/shop/customer" element={<ShopPurchase />} />
          <Route path="/:locale/links" element={<LocalizedPublicRoute><Index /></LocalizedPublicRoute>} />
          <Route path="/:locale/menu" element={<LocalizedPublicRoute><Menu /></LocalizedPublicRoute>} />
          <Route path="/:locale/privacy" element={<LocalizedPublicRoute><Privacy /></LocalizedPublicRoute>} />
          <Route path="/:locale/cookies" element={<LocalizedPublicRoute><Cookies /></LocalizedPublicRoute>} />
          <Route path="/:locale/newsletter" element={<LocalizedPublicRoute><Newsletter /></LocalizedPublicRoute>} />
          <Route path="/:locale/newsletter/status" element={<LocalizedPublicRoute><Newsletter /></LocalizedPublicRoute>} />
          <Route path="/:locale/:subpage" element={<LocalizedPublicRoute><Index /></LocalizedPublicRoute>} />
          <Route path="/:subpage" element={<LocalizedPublicRoute><Index /></LocalizedPublicRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppI18nProvider>
  );
}

function LocalizedPublicRoute({ children }: { children: ReactNode }) {
  const { locale, subpage } = useParams();
  const location = useLocation();
  if (!locale && !publicLocaleFromSlug(subpage)) return children;
  if (!publicLocaleFromSlug(locale || subpage)) {
    return <NotFound />;
  }
  if (!isAdminLocation(location.pathname)) {
    const route = parseLocalizedPublicPath(location.pathname);
    return <Navigate replace to={`${route?.routePath || "/"}${location.search}${location.hash}`} />;
  }
  return children;
}

const App = () => (
  <ApplicationErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter basename={routerBaseName || undefined}>
          <RoutedApplication />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ApplicationErrorBoundary>
);

export default App;
