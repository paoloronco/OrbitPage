const Cookies = () => {
  return (
    <main className="min-h-screen bg-white px-4 py-10 text-slate-950" style={{ colorScheme: "light" }}>
      <div className="mx-auto w-full max-w-3xl">
        <a className="text-sm text-slate-600 underline hover:text-blue-700" href="/">
          Back to home
        </a>

        <header className="mt-8 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Cookie Policy</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This page is reserved for the cookie policy for this Lynx instance.
          </p>
        </header>

        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
          Cookie policy content is not configured for this deployment yet.
        </div>
      </div>
    </main>
  );
};

export default Cookies;
