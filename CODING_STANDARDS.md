# Coding standards

Read during review, not during implementation. Everything here is a judgement call a reviewer applies against a diff; the mechanical checks own themselves and run in `npm run check`.

## Antd in client components

A `"use client"` component reaches for the Ant Design v6 primitive for anything interactive or stateful: `Button`, `Input`, `Select`, `Form`, `Checkbox`, `Radio`, `Switch`, `Modal`, `Drawer`, `Table`, `Tabs`, `Dropdown`, `Menu`, `Breadcrumb`, `Alert`, `Badge`, `Skeleton`, `Avatar`, `Empty`, `Result`, `Spin`, `Tooltip`, `Popconfirm`, `Pagination`, `Space`, `Flex`, `Typography`.

Custom markup stays for layout shells and static design regions, where the design's own SVG assets and spacing are the thing being matched (sidebar nav rows, header bars, hero and CTA bands).

The exception test: a raw element earns its tag when it wraps design-supplied content the primitive cannot host, or when antd's DOM cannot express the design without more override CSS than the element saves. Note the reason on the element as a comment.

Reviewer step: for each new client component, list the antd primitives it uses, and state the reason for every raw interactive element that kept its tag. The bar is state, not styling: `Form` + `Input` + `Button` carry validation, in-flight disabling, and error display, so a hand-rolled control trio hands the reviewer a state machine to audit instead.

Query antd before writing it: the `antd` skill runs the offline CLI (`antd info Button --version 6.6.5`, `antd semantic`, `antd demo`), and `antd lint <paths>` catches deprecated usage after the edit.

## Theming antd

Reach for the `ConfigProvider` in `src/app/providers.tsx` first: component tokens under `components.<Name>` and a nested provider around one region beat per-instance CSS.

When CSS has to win, remember antd v6 wraps its rules in `:where(.css-hash)` and puts its classes on the same element as yours: write co-selectors (`.search:global(.ant-input-affix-wrapper)`) and keep the override in that component's module.

## CSS modules

Every `styles.x` reference resolves to a class defined in the imported `*.module.css`. An unresolved reference renders `class="undefined"` and neither `tsc` nor ESLint can see it, which is why `scripts/check-css-modules.mjs` exists. Run `npm run check:css` after touching a module.

## Scope

This file adds rules; it does not restate `AGENTS.md`. Where the two disagree, `AGENTS.md` §7 foundation rules and `docs/design.md` tokens win.
