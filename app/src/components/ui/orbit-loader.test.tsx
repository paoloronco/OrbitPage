import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrbitLoadingState, OrbitProgressRing } from "./orbit-loader";

describe("Orbit loading feedback", () => {
  it("renders the long-wait state with a circular progress ring instead of the dark canvas orb", () => {
    const html = renderToStaticMarkup(
      <OrbitLoadingState description="Loading your workspace" state="connecting" title="Loading OrbitPage Admin" />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("orbit-progress-ring__visual");
    expect(html).toContain("Loading OrbitPage Admin");
    expect(html).not.toContain("orbit-loading-state__orb");
    expect(html).not.toContain("orbit-loader__canvas");
  });

  it("keeps the ring decorative while exposing its loading state for styling", () => {
    const html = renderToStaticMarkup(<OrbitProgressRing size={44} state="weaving" />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-orbit-state="weaving"');
    expect(html).toContain("--orbit-progress-size:44px");
  });
});
