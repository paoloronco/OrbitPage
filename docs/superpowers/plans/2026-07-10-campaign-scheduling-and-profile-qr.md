# Campaign Scheduling And Profile QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stronger link campaign scheduling/status controls and a locked public-page QR tool in the profile editor.

**Architecture:** Extend the existing `links` row/DTO instead of adding a campaign table. Public visibility is computed from link status plus date/time windows at read/render time, while the QR tool only uses the installation public URL exposed by the backend.

**Tech Stack:** Express, SQLite, Zod, Vitest, React, Vite, TypeScript, shadcn/ui, lucide-react.

---

## File Structure

- Modify `app/server/database.js`: additive link columns for `status`, `start_time`, `end_time`, `timezone`, and `campaign_name`.
- Modify `app/server/schemas/link.schema.js`: accept and validate new link scheduling fields.
- Modify `app/server/server.js`: format, persist, import/export, and public-filter links; expose locked public URL.
- Modify `app/server/server.test.js`: add behavior tests for public filtering and public URL locking.
- Modify `app/src/components/LinkCard.tsx`: add status, campaign name, time inputs, timezone field, and clearer schedule summary.
- Modify `app/src/components/TextCard.tsx`: mirror scheduling controls for text cards.
- Modify `app/src/components/PublicView.tsx`: keep client-side visibility consistent with server payload.
- Modify `app/src/lib/link-normalization.ts` and tests: normalize new fields.
- Modify `app/src/lib/api-client.ts`: expose new link fields and public URL API.
- Create `app/src/lib/link-visibility.ts`: shared frontend visibility helper.
- Create `app/src/components/ProfileQrCode.tsx`: QR preview/download UI locked to the installation URL.
- Modify `app/src/components/ProfileSection.tsx`: render the QR section beside existing profile settings.

## Tasks

### Task 1: Backend Scheduling Contract

**Files:**
- Modify: `app/server/schemas/link.schema.js`
- Modify: `app/server/database.js`
- Modify: `app/server/server.js`
- Test: `app/server/server.test.js`

- [ ] **Step 1: Write failing backend tests**

Add tests that prove `/api/public-page` excludes `draft`, excludes out-of-window live links, keeps current live links, and returns `status`, `startTime`, `endTime`, `timezone`, and `campaignName` in admin/export payloads.

- [ ] **Step 2: Run backend tests to verify failure**

Run: `cd app/server && npm test -- --run`

Expected: tests fail because the new fields are absent or public links are not filtered.

- [ ] **Step 3: Implement backend schema and persistence**

Add columns, Zod fields, formatter fields, INSERT values, and import/export mappings for the new scheduling data.

- [ ] **Step 4: Implement public visibility filtering**

Add a small helper in `server.js` that treats `draft` and `expired` as hidden, treats missing status as `live`, and compares current local minutes against optional `startDate/endDate/startTime/endTime`.

- [ ] **Step 5: Run backend tests to verify pass**

Run: `cd app/server && npm test -- --run`

Expected: backend tests pass.

- [ ] **Step 6: Commit and push**

Run: `git add app/server && git commit -m "feat(links): add campaign scheduling fields" && git push origin main`

### Task 2: Frontend Link Scheduling UI

**Files:**
- Modify: `app/src/components/LinkCard.tsx`
- Modify: `app/src/components/TextCard.tsx`
- Modify: `app/src/components/LinkManager.tsx`
- Modify: `app/src/pages/Admin.tsx`
- Modify: `app/src/lib/link-normalization.ts`
- Test: `app/src/lib/link-normalization.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Add assertions that new DTO fields survive normalization and default status remains `live`.

- [ ] **Step 2: Run frontend unit tests to verify failure**

Run: `cd app && npx vitest run src/lib/link-normalization.test.ts`

Expected: test fails because new fields are not normalized.

- [ ] **Step 3: Implement types and normalization**

Extend `LinkData`, `LinkItem`, admin save mapping, and normalization fields.

- [ ] **Step 4: Add admin controls**

Add status selector, campaign name input, date/time inputs, and timezone input in link/text card editors.

- [ ] **Step 5: Run frontend tests to verify pass**

Run: `cd app && npx vitest run src/lib/link-normalization.test.ts`

Expected: tests pass.

- [ ] **Step 6: Commit and push**

Run: `git add app/src && git commit -m "feat(admin): improve link scheduling controls" && git push origin main`

### Task 3: Public QR In Profile

**Files:**
- Modify: `app/package.json`
- Modify: `app/package-lock.json`
- Modify: `app/server/server.js`
- Modify: `app/src/lib/api-client.ts`
- Create: `app/src/components/ProfileQrCode.tsx`
- Modify: `app/src/components/ProfileSection.tsx`
- Test: `app/server/server.test.js`

- [ ] **Step 1: Write failing public URL tests**

Add tests for `/api/public-url`: it returns `PUBLIC_SITE_URL` when configured and falls back to the request origin without accepting arbitrary user input.

- [ ] **Step 2: Run backend tests to verify failure**

Run: `cd app/server && npm test -- --run`

Expected: test fails because `/api/public-url` does not exist.

- [ ] **Step 3: Implement locked public URL endpoint**

Add `GET /api/public-url` returning only the configured public site URL or inferred request origin plus base path.

- [ ] **Step 4: Add QR UI**

Install a QR rendering package, render only the locked URL, expose color/background/size options, and add PNG/SVG downloads.

- [ ] **Step 5: Run frontend and backend checks**

Run: `cd app && npm run lint && npm run build && npm run test:unit`

Expected: checks pass with only existing lint warnings.

- [ ] **Step 6: Commit and push**

Run: `git add app && git commit -m "feat(profile): add locked public qr code" && git push origin main`

### Task 4: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run full local quality gate**

Run: `cd app && npm run lint && npm run test:unit && npm run build`

Expected: all commands pass.

- [ ] **Step 2: Confirm clean git state**

Run: `git status --short --branch`

Expected: `## main...origin/main`.
