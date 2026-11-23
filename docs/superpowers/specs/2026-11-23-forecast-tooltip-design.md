# Forecast point tooltips — short design

## Intent

The Prophet forecast panel shows a line and band, but a user cannot read the
predicted revenue for a specific month. Add point markers whose hover/focus
tooltip shows the month and revenue, plus a visible monthly table so values are
available without interaction.

## Goals

- Mark each forecast month with a visible point on the SVG line.
- Hover or keyboard-focus a point to show `Month Year`, predicted revenue, and
  the 80% interval.
- Show the same 12 values in a compact table below the chart.
- Keep the existing annual totals and generated-time footer.

## Non-goals

- No backend, API, schema, or Python changes.
- No new npm dependency or chart library.
- No zoom/brush/toggle controls.

## Constraints

- Next.js 16 App Router, React 19, Ant Design v6, existing CSS modules.
- No new dependency; use the existing SVG approach.
- Keyboard focus must reveal the same values as hover.
- Money uses `formatVndPrice`; timezone stays `Asia/Ho_Chi_Minh`.

## Approach

Extend `RevenueForecastPanel` with local `activeIndex` state. Each month gets a
`<circle data-testid="forecast-point" tabIndex={0} role="img" aria-label="...">`
with mouse enter/leave and focus/blur handlers. A positioned `<div>` inside the
plot renders the tooltip. Add a `<table aria-label="Monthly revenue forecast">`
with one row per month under the chart. CSS classes reuse existing tokens.

## Tests

- Hover first point → tooltip contains `Nov 2026` and the predicted VND.
- Focus first point → same tooltip; Escape clears it.
- Monthly table has 12 data rows.
- Existing panel schema/render tests stay green.

## Decisions

- Tooltip text: `Nov 2026 · 10.356.310 ₫ · 80%: 10.198.870 ₫ – 10.525.052 ₫`.
- Tooltip clamped inside the plot and `pointer-events: none`.
- Active point is larger with a focus ring; no color-only signal.
