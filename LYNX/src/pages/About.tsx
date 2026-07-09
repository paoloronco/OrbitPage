import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  ExternalLink,
  Github,
  LockKeyhole,
  Palette,
  Server,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { utilityApi } from "@/lib/api-client";
import { withBasePath } from "@/lib/base-path";
import NotFound from "./NotFound";

const githubUrl = "https://github.com/paoloronco/Lynx";
const dockerUrl = "https://hub.docker.com/r/paueron/lynx";
const publicPageScreenshotUrl = "https://raw.githubusercontent.com/paoloronco/Lynx/main/docs/screenshots/01-public-page.png";

const coreFeatures = [
  {
    title: "Self-hosted by default",
    description: "Run Lynx with Docker, SQLite, and a single persistent data volume. No external database is required.",
    icon: Server,
  },
  {
    title: "A real admin panel",
    description: "Edit profile data, links, themes, privacy settings, users, analytics, and backups from one focused workspace.",
    icon: Palette,
  },
  {
    title: "Private, portable data",
    description: "Keep uploads and SQLite data under your control, then export or restore a complete backup when you move servers.",
    icon: Database,
  },
  {
    title: "Safer media handling",
    description: "Raster-only uploads, file validation, storage quotas, and cleanup paths help keep public media predictable.",
    icon: ShieldCheck,
  },
  {
    title: "Useful analytics",
    description: "Track link clicks without turning the admin area into a tracking surface, and keep consent controls available.",
    icon: BarChart3,
  },
  {
    title: "Production packaging",
    description: "Docker Hub, GHCR, CI checks, dependency audits, and Docker smoke tests are part of the release flow.",
    icon: UploadCloud,
  },
];

const comparisonRows = [
  ["Hosting", "Runs on your own server", "Usually hosted for you"],
  ["Database", "SQLite, local files, portable backup", "Vendor-managed or external services"],
  ["Customization", "Theme editor, custom CSS, cards, covers", "Often limited by plan or template"],
  ["Privacy", "Consent settings and no required third-party database", "Depends on provider and plan"],
  ["Operations", "Docker image, health check, backup/restore", "Provider handles infra, less control"],
];

const useDemoMode = () => {
  const [state, setState] = useState<"loading" | "enabled" | "disabled">("loading");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const health = await utilityApi.getHealth();
        if (!cancelled) setState(health.demoMode ? "enabled" : "disabled");
      } catch {
        if (!cancelled) setState("disabled");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};

const About = () => {
  const demoState = useDemoMode();

  if (demoState === "loading") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <p className="text-sm text-slate-300">Loading Lynx overview...</p>
        </div>
      </main>
    );
  }

  if (demoState !== "enabled") return <NotFound />;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7fbff] text-slate-950" style={{ colorScheme: "light" }}>
      <header className="border-b border-slate-200/80 bg-white/88 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href={withBasePath("/")} className="text-lg font-semibold tracking-tight text-slate-950">
            Lynx
          </a>
          <nav className="flex items-center gap-3 text-sm">
            <a className="hidden text-slate-600 hover:text-slate-950 sm:inline" href={withBasePath("/")}>
              Demo
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 font-medium text-white transition hover:bg-slate-800"
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.03fr_0.97fr] lg:py-20">
        <div className="flex flex-col justify-center">
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            A self-hosted Linktree alternative for people who want control.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Lynx gives you a polished link-in-bio page, a private admin panel, themes, analytics,
            privacy controls, and Docker deployment without handing your data to another platform.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
              href={withBasePath("/admin")}
            >
              Try the admin demo
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-50"
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              View the source
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/70">
          <img
            src={publicPageScreenshotUrl}
            alt="Lynx public profile page"
            className="aspect-[16/11] w-full rounded-md object-cover object-top"
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {["Docker ready", "SQLite data", "No SaaS lock-in"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:px-8 lg:grid-cols-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">What Lynx is for</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Lynx is for creators, developers, consultants, small teams, and self-hosters who need one public page
              for links without turning a simple workflow into another subscription.
            </p>
          </div>
          <div className="rounded-lg bg-slate-950 p-6 text-white">
            <Sparkles className="h-6 w-6 text-blue-300" />
            <h3 className="mt-4 text-lg font-semibold">For polished link pages</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Build a public profile with links, text cards, separators, social links, cover images, and SEO metadata.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
            <LockKeyhole className="h-6 w-6 text-blue-700" />
            <h3 className="mt-4 text-lg font-semibold">For owned infrastructure</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Run it behind your own domain, keep the data volume mounted, and move the whole instance with backup/restore.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Everything needed to run a serious link hub.</h2>
          <p className="mt-4 leading-7 text-slate-600">
            The goal is not to clone every social bio tool. It is to make the common self-hosted path dependable:
            install quickly, edit comfortably, publish safely, and keep ownership of your data.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
                <Icon className="h-6 w-6 text-blue-700" />
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-14 text-white sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">A clear tradeoff: less platform convenience, more ownership.</h2>
            <p className="mt-4 leading-7 text-slate-300">
              Hosted tools are easier when you want someone else to own the stack. Lynx is better when the page,
              deployment, styling, backups, and data should belong to you.
            </p>
          </div>
          <div className="space-y-3 md:hidden">
            {comparisonRows.map(([area, lynx, hosted]) => (
              <article key={area} className="rounded-lg border border-white/15 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-white">{area}</h3>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="font-medium text-blue-200">Lynx</dt>
                    <dd className="mt-1 text-slate-300">{lynx}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-300">Hosted link tools</dt>
                    <dd className="mt-1 text-slate-400">{hosted}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-white/15 md:block">
            <table className="min-w-[680px] w-full border-collapse text-left text-sm">
              <thead className="bg-white/10 text-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Area</th>
                  <th className="px-4 py-3 font-semibold">Lynx</th>
                  <th className="px-4 py-3 font-semibold">Hosted link tools</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {comparisonRows.map(([area, lynx, hosted]) => (
                  <tr key={area}>
                    <td className="px-4 py-4 font-medium text-white">{area}</td>
                    <td className="px-4 py-4 text-slate-300">{lynx}</td>
                    <td className="px-4 py-4 text-slate-400">{hosted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Try it in this demo.</h2>
          <p className="mt-4 leading-7 text-slate-600">
            This public demo lets you see the visitor page and explore the admin panel. Demo data resets regularly,
            so avoid entering anything private.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a className="inline-flex items-center justify-center rounded-md bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800" href={withBasePath("/")}>
              View public page
            </a>
            <a className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-50" href={withBasePath("/admin")}>
              Open admin demo
            </a>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">Install path</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            When you are ready to run it yourself, use Docker and mount `/app/data`.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-md bg-slate-950 p-4 text-sm leading-6 text-slate-100"><code>{`docker run -d --name lynx \\
  -p 8080:8080 \\
  -e JWT_SECRET="$(openssl rand -hex 32)" \\
  -v lynx_data:/app/data \\
  paueron/lynx:latest`}</code></pre>
          <a
            href={dockerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Docker Hub
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </section>
    </main>
  );
};

export default About;
