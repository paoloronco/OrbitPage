import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { Component, lazy, Suspense, useLayoutEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import { getActiveBasePath } from "@/lib/base-path";
import { AppI18nProvider, resolveApplicationErrorLocale, type AppLocale } from "@/lib/i18n";

const Index = lazy(() => import("./pages/Index"));
const Admin = lazy(() => import("./pages/Admin"));
const Menu = lazy(() => import("./pages/Menu"));
const About = lazy(() => import("./pages/About"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const NotFound = lazy(() => import("./pages/NotFound"));
const routerBaseName = getActiveBasePath();

const queryClient = new QueryClient();

function storedApplicationLocale() {
  try {
    return window.localStorage.getItem("orbitpage.locale");
  } catch {
    return null;
  }
}

const APPLICATION_ERROR_COPY = {
  en: { title: "Something drifted off course.", description: "OrbitPage could not load this page. Check your connection and try again.", retry: "Try again" },
  it: { title: "Qualcosa è uscito dall'orbita.", description: "OrbitPage non è riuscito a caricare questa pagina. Controlla la connessione e riprova.", retry: "Riprova" },
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

    const mode = /^\/(?:admin|dashboard)(?:\/|$)/.test(window.location.pathname) ? "editor" : "public";
    const locale = resolveApplicationErrorLocale(
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
          backgroundColor: "#07111f",
          backgroundImage: "linear-gradient(90deg, rgb(255 255 255 / 3%) 1px, transparent 1px), linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          color: "#f7f9fd",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: "640px", textAlign: "center" }}>
          <p style={{ color: "#a8c5f5", fontSize: "12px", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>OrbitPage / 500</p>
          <h1 style={{ margin: "18px 0 0", fontSize: "clamp(2.5rem, 8vw, 5.5rem)", letterSpacing: "-.055em", lineHeight: ".98" }}>{copy.title}</h1>
          <p style={{ margin: "24px auto 28px", maxWidth: "520px", color: "#aebbd0", fontSize: "1.05rem", lineHeight: 1.65 }}>{copy.description}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: "50px",
              border: 0,
              borderRadius: "6px",
              padding: "10px 22px",
              background: "#f8fafd",
              color: "#0a1728",
              font: "inherit",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {copy.retry}
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
        <BrowserRouter basename={routerBaseName || undefined}>
          <RoutedApplication />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ApplicationErrorBoundary>
);

export default App;
