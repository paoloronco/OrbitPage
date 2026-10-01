import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { Component, lazy, Suspense, useLayoutEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import { getActiveBasePath, withBasePath } from "@/lib/base-path";
import { AppI18nProvider, resolveApplicationErrorLocale, type AppLocale } from "@/lib/i18n";
import { parseLocalizedPublicPath, publicLocaleFromSlug } from "@/lib/public-routing";
import { adminDashboardPath, adminSubsectionFromLocation, isAdminLocation } from "@/lib/admin-navigation";

const Index = lazy(() => import("./pages/Index"));
const Admin = lazy(() => import("./pages/Admin"));
const Menu = lazy(() => import("./pages/Menu"));
const About = lazy(() => import("./pages/About"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const Newsletter = lazy(() => import("./pages/Newsletter"));
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

function storedApplicationLocale() {
  try {
    return window.localStorage.getItem("orbitpage.locale");
  } catch {
    return null;
  }
}

const APPLICATION_ERROR_COPY = {
  en: { title: "We couldn't open this page.", description: "Reload it now. If the problem continues, return to the dashboard and try again.", retry: "Reload page" },
  it: { title: "Non siamo riusciti ad aprire la pagina.", description: "Ricaricala ora. Se il problema continua, torna alla dashboard e riprova.", retry: "Ricarica pagina" },
  es: { title: "Algo se salió de órbita.", description: "OrbitPage no pudo cargar esta página. Comprueba tu conexión e inténtalo de nuevo.", retry: "Inténtalo de nuevo" },
  fr: { title: "Quelque chose est sorti de son orbite.", description: "OrbitPage n'a pas pu charger cette page. Vérifiez votre connexion et réessayez.", retry: "Réessayer" },
  de: { title: "Etwas ist aus der Umlaufbahn geraten.", description: "OrbitPage konnte diese Seite nicht laden. Prüfe deine Verbindung und versuche es erneut.", retry: "Erneut versuchen" },
  pt: { title: "Algo saiu de órbita.", description: "O OrbitPage não conseguiu carregar esta página. Verifique a ligação e tente novamente.", retry: "Tentar novamente" },
  nl: { title: "Er is iets uit zijn baan geraakt.", description: "OrbitPage kon deze pagina niet laden. Controleer je verbinding en probeer het opnieuw.", retry: "Opnieuw proberen" },
  pl: { title: "Coś wypadło z orbity.", description: "OrbitPage nie mógł wczytać tej strony. Sprawdź połączenie i spróbuj ponownie.", retry: "Spróbuj ponownie" },
  tr: { title: "Bir şey yörüngeden çıktı.", description: "OrbitPage bu sayfayı yükleyemedi. Bağlantınızı kontrol edip tekrar deneyin.", retry: "Tekrar dene" },
  ru: { title: "Что-то сошло с орбиты.", description: "OrbitPage не удалось загрузить эту страницу. Проверьте подключение и повторите попытку.", retry: "Повторить" },
  ar: { title: "حدث خلل وخرج شيء عن المسار.", description: "تعذر على OrbitPage تحميل هذه الصفحة. تحقق من اتصالك وحاول مرة أخرى.", retry: "حاول مرة أخرى" },
  zh: { title: "出现了问题。", description: "OrbitPage 无法加载此页面。请检查网络连接后重试。", retry: "重试" },
  ja: { title: "問題が発生しました。", description: "OrbitPage はこのページを読み込めませんでした。接続を確認して、もう一度お試しください。", retry: "もう一度試す" },
  ko: { title: "문제가 발생했습니다.", description: "OrbitPage에서 이 페이지를 불러오지 못했습니다. 연결을 확인한 후 다시 시도하세요.", retry: "다시 시도" },
} satisfies Record<AppLocale, { title: string; description: string; retry: string }>;

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

    const basePath = getActiveBasePath();
    const localizedPath = parseLocalizedPublicPath(window.location.pathname, basePath);
    const relativePath = localizedPath?.routePath || window.location.pathname.slice(basePath.length) || "/";
    const mode = isAdminLocation(relativePath) ? "editor" : "public";
    const locale = localizedPath?.locale || resolveApplicationErrorLocale(
      mode,
      window.location.search,
      storedApplicationLocale(),
      document.documentElement.lang,
    );
    const copy = APPLICATION_ERROR_COPY[locale];

    return (
      <main
        dir={locale === "ar" ? "rtl" : "ltr"}
        lang={locale}
        role="alert"
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          backgroundColor: "#f5f7fb",
          backgroundImage: "linear-gradient(90deg, rgb(37 82 214 / 4%) 1px, transparent 1px), linear-gradient(rgb(37 82 214 / 4%) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          color: "#101a30",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ width: "min(100%, 560px)", border: "1px solid #d9e1ef", borderRadius: "18px", padding: "clamp(28px, 6vw, 48px)", background: "#fff", boxShadow: "0 20px 55px rgb(24 48 92 / 10%)", textAlign: "center" }}>
          <p style={{ margin: 0, color: "#315bd8", fontSize: "12px", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>OrbitPage</p>
          <h1 style={{ margin: "14px 0 0", fontSize: "clamp(1.75rem, 5vw, 2.5rem)", letterSpacing: "-.035em", lineHeight: 1.08 }}>{copy.title}</h1>
          <p style={{ margin: "18px auto 26px", maxWidth: "440px", color: "#62708b", fontSize: "1rem", lineHeight: 1.6 }}>{copy.description}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: "50px",
              border: 0,
              borderRadius: "10px",
              padding: "10px 22px",
              background: "#315bd8",
              color: "#fff",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {copy.retry}
          </button>
          {mode === "editor" && <a href={withBasePath(adminDashboardPath("profile", "link", locale))} style={{ display: "block", marginTop: "16px", color: "#315bd8", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>Dashboard</a>}
        </div>
      </main>
    );
  }
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
          <Route path="/:locale" element={<LocalizedPublicRoute><Index /></LocalizedPublicRoute>} />
          <Route path="/:locale/links" element={<LocalizedPublicRoute><Index /></LocalizedPublicRoute>} />
          <Route path="/:locale/menu" element={<LocalizedPublicRoute><Menu /></LocalizedPublicRoute>} />
          <Route path="/:locale/privacy" element={<LocalizedPublicRoute><Privacy /></LocalizedPublicRoute>} />
          <Route path="/:locale/cookies" element={<LocalizedPublicRoute><Cookies /></LocalizedPublicRoute>} />
          <Route path="/:locale/newsletter" element={<LocalizedPublicRoute><Newsletter /></LocalizedPublicRoute>} />
          <Route path="/:locale/newsletter/status" element={<LocalizedPublicRoute><Newsletter /></LocalizedPublicRoute>} />
          <Route path="/:locale/:subpage" element={<LocalizedPublicRoute><Index /></LocalizedPublicRoute>} />
          <Route path="/:subpage" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppI18nProvider>
  );
}

function LocalizedPublicRoute({ children }: { children: ReactNode }) {
  const { locale } = useParams();
  const location = useLocation();
  if (!publicLocaleFromSlug(locale)) {
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
