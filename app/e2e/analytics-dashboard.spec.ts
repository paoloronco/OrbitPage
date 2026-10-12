import { expect, test } from '@playwright/test';
import { openAdminSection, openAuthenticatedAdmin } from './helpers';

test('aggregates session duration without duplicate views and attributes AI referrals correctly', async ({ page }) => {
  const login = page.waitForResponse(response => /\/api\/auth\/(setup|login)$/.test(response.url()) && response.request().method() === 'POST');
  await openAuthenticatedAdmin(page);
  const { token } = await (await login).json();
  const headers = { Authorization: 'Bearer ' + token };
  const before = await (await page.request.get('/api/analytics?days=7', { headers })).json();
  const sessionId = 'fictional-session-' + Date.now(), visitorId = 'fictional-analytics-' + Date.now();
  for (let i = 0; i < 2; i++) expect((await page.request.post('/api/analytics/events', { data: { event: 'view', visitorId, sessionId, path: '/analytics-fixture', referrer: 'https://chatgpt.com/', utmSource: 'unrelated-campaign' } })).status()).toBe(204);
  for (const durationSeconds of [30, 90, 30]) expect((await page.request.post('/api/analytics/events', { data: { event: 'engagement', visitorId, sessionId, durationSeconds, activeSeconds: 30 } })).status()).toBe(204);
  const report = await (await page.request.get('/api/analytics?days=7', { headers })).json();
  expect(report.summary.visits).toBe(before.summary.visits + 1);
  expect(report.summary.durationSeconds).toBe(90);
  expect(report.summary.aiVisits).toBe(before.summary.aiVisits + 1);
  expect(report.aiSources).toContainEqual(expect.objectContaining({ label: 'chatgpt.com' }));
  expect(report.aiSources.some(item => item.label === 'unrelated-campaign')).toBe(false);
});

test('renders separate interactive analytics charts, responsive layouts and honest failures', async ({ page }, testInfo) => {
  let fail = false;
  await openAuthenticatedAdmin(page);
  await page.route('**/api/analytics?*', route => {
    if (fail) return route.fulfill({ status: 503, json: { error: 'Fictional reporting outage' } });
    const days = Number(new URL(route.request().url()).searchParams.get('days'));
    const visits = days === 7 ? 200 : 1200;
    const trend = Array.from({ length: 7 }, (_, index) => ({ date: new Date(Date.now() - (6-index)*86400000).toISOString().slice(0,10), visits: 80+index*20, visitors: 60+index*10, clicks: 10+index*3, durationSeconds: 60+index*10, aiVisits: index*2, aiSearchVisits: index }));
    return route.fulfill({ json: { configured: true, detailed: true, periodDays: days, maxPeriodDays: 30, summary: { visits, visitors: 850, clicks: 180, qrVisits: 80, ctr: 15, visitsPerVisitor: 1.4, clicksPerVisitor: .2, durationSeconds: 90, engagedVisits: 400, aiVisits: 60, aiSearchVisits: 20 }, comparison: { previous: { visits: 1000, visitors: 800, clicks: 100, ctr: 10 }, changes: { visits: 20, visitors: 6.3, clicks: 80, ctr: 50 } }, trend, countries: [{ label: 'IT', value: 800 }, { label: 'US', value: 400 }], devices: [{ label: 'Mobile', value: 900 }, { label: 'Desktop', value: 300 }], aiSources: [{ label: 'chatgpt.com', value: 40 }, { label: 'perplexity.ai', value: 20 }], sources: [{ label: 'Direct', value: 900 }], links: [{ label: 'Fictional booking', value: 180 }], paths: [], campaigns: [], utmSources: [], utmMediums: [], qrPaths: [] } });
  });
  await openAdminSection(page, 'Analytics');
  const dashboard = page.getByTestId('managed-analytics');
  await expect(dashboard.locator('.managed-analytics-primary-kpis')).toContainText('1m 30s');
  for (const name of ['Countries', 'Devices', 'AI discovery', 'Average active duration']) await expect(dashboard.getByRole('heading', { name, exact: true })).toBeVisible();
  await dashboard.getByRole('group', { name: 'Traffic metric' }).getByRole('button', { name: 'Visits', exact: true }).click();
  await expect(dashboard.getByRole('group', { name: 'Traffic metric' }).getByRole('button', { name: 'Visits', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dashboard.getByRole('button', { name: '7 days', exact: true }).click();
  await expect(dashboard.locator('.analytics-chart-value').first()).toContainText('200');
  for (const width of [1440,390,320]) {
    await page.setViewportSize({ width, height: 980 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('analytics-' + width + '.png'), fullPage: true, animations: 'disabled' });
  }
  await dashboard.getByText('View chart data', { exact: true }).click();
  await expect(dashboard.locator('table')).toContainText('AI search');
  fail = true; await dashboard.getByRole('button', { name: 'Refresh analytics', exact: true }).click();
  await expect(dashboard.getByRole('alert')).toContainText('Fictional reporting outage');
  await expect(dashboard.locator('.managed-analytics-primary-kpis strong')).toHaveText(['—','—','—','—','—','—']);
  await expect(dashboard.locator('.recharts-wrapper')).toHaveCount(0);
});
