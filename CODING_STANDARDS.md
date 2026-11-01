# Coding standards

Read during review, not during implementation. Everything here is a judgement call a reviewer applies against a diff; the mechanical checks own themselves and run in `npm run check`.

## Designing from a screenshot

A design arrives as a screenshot, not as a Figma node, and the job is a mapping exercise before it is a styling exercise:

1. **Inventory the primitives first.** Name the antd v6 component that already implements each region — the shell, the form, the table, the dialog, the empty state — before writing any markup. The screenshot answers "which primitive", not "which div".
2. **Build from those components.** Layout comes from `Layout`/`Flex`/`Space`/`Row`+`Col`, spacing from their gap props, and behavior (validation, disabled states, focus, keyboard) from the component.
3. **Spend custom CSS only on what tokens cannot carry.** Colors, spacing, radii, and type come from `docs/design.md` / `src/lib/design-tokens.ts`; specific values a component exposes no prop or token for get a scoped CSS-module rule.

Custom markup stays for layout shells and static design regions, where the design's own SVG assets and spacing are the thing being matched (sidebar nav rows, header bars, hero and CTA bands).

## Antd in client components

A `"use client"` component reaches for the Ant Design v6 primitive for anything interactive or stateful: `Button`, `Input`, `Select`, `Form`, `Checkbox`, `Radio`, `Switch`, `Modal`, `Drawer`, `Table`, `Tabs`, `Dropdown`, `Menu`, `Breadcrumb`, `Alert`, `Badge`, `Skeleton`, `Avatar`, `Empty`, `Result`, `Spin`, `Tooltip`, `Popconfirm`, `Pagination`, `Space`, `Flex`, `Typography`.

The exception test: a raw element earns its tag when it wraps design-supplied content the primitive cannot host, or when antd's DOM cannot express the design without more override CSS than the element saves.

An exemption is granted on **evidence, not assertion**, and the evidence is a specific prop or token that falls short — the one `antd token <Component>` lists and whose value the design overrides. "An antd pair would need more override CSS" is not evidence: it predicts work instead of naming a gap, and the reviewer cannot check it. Write the claim as `<prop/token> is <antd value>, design wants <design value>` on the element, and a claim that cannot be written that way means the primitive already fits.

Worked example: the admin login form kept hand-rolled controls on the reasoning "an antd `Form`/`Input` pair would need more override CSS than those components cost". Nothing in that sentence is checkable, and it was wrong — the difference was `controlHeight: 48`, `borderRadius`, and `colorBorder`, all reachable through a nested `ConfigProvider` (see `docs/antd.md`). The rewrite took 19 minutes and deleted 138 lines.

Reviewer step: for each new client component, list the antd primitives it uses, and state the reason for every raw interactive element that kept its tag. Treat an exemption comment that names no prop or token as a failed exemption, then check the named prop yourself with `antd token <Component>`. The bar is state, not styling: `Form` + `Input` + `Button` carry validation, in-flight disabling, and error display, so a hand-rolled control trio hands the reviewer a state machine to audit instead.

Query antd before writing it: the `antd` skill runs the offline CLI (`antd info Button`, `antd semantic`, `antd demo`, `antd token`), and `antd lint <paths>` catches deprecated usage after the edit. The CLI bundles metadata for several major versions, so pass `--version <installed>` (read `node_modules/antd/package.json`) whenever the answer could differ across releases.

## Theming antd

Try the layers in order — each one costs less than the next: a prop, then a component token in `src/app/providers.tsx`, then semantic `classNames`, then a CSS-module selector, and `!important` not at all. `docs/antd.md` holds the token and override reference, including why antd's injected rules lose or win ties in the cascade.

Reviewer step: an override that reaches into antd internals (`:global(.ant-*)` on a descendant) needs a comment naming the token or prop that misses the design value, or a pointer to why one does not exist.

## CSS modules

Every `styles.x` reference resolves to a class defined in the imported `*.module.css`. An unresolved reference renders `class="undefined"` and neither `tsc` nor ESLint can see it, which is why `scripts/check-css-modules.mjs` exists. Run `npm run check:css` after touching a module.

## Scope

This file adds rules; it does not restate `AGENTS.md`. Where the two disagree, `AGENTS.md` §7 foundation rules and `docs/design.md` tokens win.
