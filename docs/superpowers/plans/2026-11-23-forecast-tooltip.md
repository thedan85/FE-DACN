# Forecast Point Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each forecast month readable through point markers, hover/focus tooltips, and a monthly table.

**Architecture:** Extend the existing SVG forecast panel with an `activeIndex` state, focusable point markers, a positioned tooltip, and a visible table. No new dependency or API change.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS modules, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-23-forecast-tooltip-design.md`

## Global Constraints

- No new npm dependency.
- No backend/API/schema/Python changes.
- Mouse hover and keyboard focus must reveal the same data.
- Money uses `formatVndPrice`; month labels use `Asia/Ho_Chi_Minh`.
- Keep existing annual totals and generated-time footer.

## Review Focus

- Tooltip shows the wrong month when index and position drift: test asserts first point shows `Nov 2026` plus its own predicted value.
- Keyboard users cannot access hover data: focus test and Escape-clear test.
- Values unreadable without hover: table test asserts 12 rows.
- Tooltip overflows the card: CSS clamps horizontally and uses `pointer-events: none`.
- Existing panel behavior regresses: full panel test suite remains green.

---

### Task 1: Interactive forecast points

**Files:**
- Modify: `src/features/dashboard/admin/components/revenue-forecast-panel.tsx`
- Modify: `src/features/dashboard/admin/components/revenue-forecast-panel.test.tsx`
- Modify: `src/features/dashboard/admin/components/dashboard-view.module.css`
- Modify: `/home/dan/Projects/FE-DACN/DACN/ml/revenue-forecast/USAGE.md`

**Interfaces:**
- Consumes: existing `RevenueForecast` type and `RevenueForecastPanel` props.
- Produces: `data-testid="forecast-point"` markers, `role="table"` monthly table, tooltip text.

- [ ] **Step 1: Write the failing tests**

Add to `revenue-forecast-panel.test.tsx`:

```text
shows tooltip on point hover
shows tooltip on keyboard focus and clears on Escape
renders a 12-row monthly table
```

Assertions:

- `fireEvent.mouseEnter(screen.getAllByTestId("forecast-point")[0])` → text matching `Nov 2026` and `10.356.310` appears.
- `fireEvent.focus(points[0])` → same tooltip; `fireEvent.keyDown(points[0], { key: "Escape" })` → tooltip text disappears.
- `within(screen.getByRole("table", { name: /monthly revenue forecast/i })).getAllByRole("row")` has length 13 (header + 12 months).

- [ ] **Step 2: Run tests to verify failure**

```bash
cd fe-dacn && npm run test -- --run src/features/dashboard/admin/components/revenue-forecast-panel.test.tsx
```

Expected: failures for missing points, tooltip, and table.

- [ ] **Step 3: Implement points and tooltip**

In `RevenueForecastPanel`:

- add `useState<number | null>(null)` for `activeIndex`;
- render one `<circle>` per month with `data-testid="forecast-point"`, `tabIndex={0}`, `role="img"`, `aria-label` containing month and revenue, `onMouseEnter`, `onMouseLeave`, `onFocus`, `onBlur`, and `onKeyDown` for Escape;
- render a tooltip `<div>` only when `activeIndex !== null`, containing `month Year`, `formatVndPrice(predicted)`, and the lower/upper range;
- position it with inline `left`/`top` percentages derived from the same x/y used for the line, clamped between 10% and 90%.

- [ ] **Step 4: Add the monthly table**

Below the chart SVG, render:

```html
<table aria-label="Monthly revenue forecast">
  <thead><tr><th>Month</th><th>Predicted revenue</th></tr></thead>
  <tbody>12 rows: monthLabel(date) and formatVndPrice(predicted)</tbody>
</table>
```

- [ ] **Step 5: Add CSS**

Add `forecastPoint`, `forecastPointActive`, `forecastTooltip`, and `forecastTable` classes to `dashboard-view.module.css`, using existing design tokens. Tooltip is absolutely positioned, `pointer-events: none`, with a token-based background/border and higher z-index. Point focus uses a visible stroke width, not color alone.

- [ ] **Step 6: Run tests and full checks**

```bash
cd fe-dacn && npm run test -- --run src/features/dashboard/admin/components/revenue-forecast-panel.test.tsx
cd fe-dacn && npm run check && npm run build
```

Expected: panel tests pass; `npm run check` and `npm run build` pass.

- [ ] **Step 7: Update usage doc**

In `DACN/ml/revenue-forecast/USAGE.md`, add one sentence under the dashboard section: points show hover/focus tooltips with month, revenue, and 80% range; a monthly table is available below the chart.

- [ ] **Step 8: Commit**

```bash
git -C fe-dacn add src/features/dashboard/admin/components docs/superpowers/specs
git -C fe-dacn commit -m "feat: add forecast point tooltips and monthly table"
git -C DACN add ml/revenue-forecast/USAGE.md
git -C DACN commit -m "docs: describe forecast point tooltips"
```
