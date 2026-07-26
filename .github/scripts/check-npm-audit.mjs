import { readFile } from "node:fs/promises";

const [, , reportPath, ...allowedAdvisories] = process.argv;

if (!reportPath) {
  console.error("Usage: node check-npm-audit.mjs <report.json> [allowed-advisory...]");
  process.exit(2);
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
const vulnerabilities = report.vulnerabilities ?? {};
const allowed = new Set(allowedAdvisories);
const blockingSeverities = new Set(["high", "critical"]);

const advisoryIdsFor = (packageName, visited = new Set()) => {
  if (visited.has(packageName)) return new Set();
  visited.add(packageName);

  const advisoryIds = new Set();
  for (const source of vulnerabilities[packageName]?.via ?? []) {
    if (typeof source === "string") {
      for (const advisoryId of advisoryIdsFor(source, visited)) {
        advisoryIds.add(advisoryId);
      }
      continue;
    }

    const match = source.url?.match(/\/(GHSA-[a-z0-9-]+)$/i);
    advisoryIds.add(match?.[1] ?? `source:${source.source ?? "unknown"}`);
  }
  return advisoryIds;
};

const blockers = [];
for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
  if (!blockingSeverities.has(vulnerability.severity)) continue;

  const advisoryIds = advisoryIdsFor(packageName);
  const unapproved = [...advisoryIds].filter((advisoryId) => !allowed.has(advisoryId));
  if (advisoryIds.size === 0 || unapproved.length > 0) {
    blockers.push({
      packageName,
      severity: vulnerability.severity,
      advisories: unapproved.length > 0 ? unapproved : ["unknown advisory"],
    });
    continue;
  }

  console.warn(
    `Temporarily accepted ${packageName} advisory: ${[...advisoryIds].join(", ")}.`,
  );
}

if (blockers.length > 0) {
  console.error("Blocking npm audit findings:");
  for (const blocker of blockers) {
    console.error(
      `- ${blocker.packageName} (${blocker.severity}): ${blocker.advisories.join(", ")}`,
    );
  }
  process.exit(1);
}

console.log("No unapproved high or critical npm audit findings.");
