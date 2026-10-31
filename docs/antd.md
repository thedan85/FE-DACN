# Ant Design v6 — theming and override reference

Installed: `antd` 6.6.8 (`node_modules/antd/package.json`). Read this before writing a `:global(.ant-*)` rule or a `!important`.

The v6 rules that matter here differ from v5 in three ways: semantic `classNames`/`styles` props exist on every component, component tokens are the intended customization seam, and the injected rules are wrapped in `:where()`. Query the installed version rather than trusting memory:

```bash
antd info Button --version 6.6.8      # props
antd semantic Modal --format json     # semantic slot keys
antd token Skeleton --format json     # component token names
antd demo Button basic --format json  # a working example
```

## How the theme reaches the page

Two layers, both fed from one file:

1. `src/lib/design-tokens.ts` — the typed source of truth. It exports `designTokens` (for TS) and emits CSS custom properties (`--color-admin-sidebar-surface`, `--space-6`, `--radius-pill`, …), applied as an inline `style` on `<html>` in `src/app/layout.tsx`. That is why component CSS modules can use `var(--color-…)` without any `:root` block in `globals.css`.
2. `src/app/providers.tsx` — a `ConfigProvider` mapping those same tokens onto antd's global `token` and per-component `components` theme: `colorPrimary`, `colorText`, `fontFamily`, `controlHeight: 44`, `borderRadius: radius.icon`, and Button/Card/Input/Select overrides.

`<AntdRegistry>` in `layout.tsx` collects the generated styles for SSR, so antd styling survives the server render without a flash.

Consequence: the antd defaults in this project are **not** the library defaults. `controlHeight` is 44 and `Button` is a pill (`radius.pill`), which is why a 42px, 6px-radius sidebar control needs an override at all.

## The ladder — try in this order

1. **A prop.** `size`, `variant`/`color`, `block`, `shape` on `Button`; `gap` on `Flex`/`Space`; `width` on `Skeleton.paragraph`. Cheapest and most robust.
2. **A component token** in `providers.tsx` under `components.<Name>`. Right when the value is a design decision that holds everywhere.
3. **Semantic `classNames`** — `classNames={{ body: styles.x }}`. Right when the override is local and you need a stable hook.
4. **A CSS-module selector** in that component's own module. Right for layout the component has no slot for.
5. **`!important`** — not at all. If a rule needs it, a token was skipped.

### Tokens that replace common CSS fights

| Instead of | Use |
|---|---|
| `height` on controls | the global `controlHeight` (currently 44) — not a Button component token |
| `padding-inline`, `font-weight` on buttons | `Button.paddingInline`, `Button.fontWeight` |
| `.ant-btn-icon { margin-inline-end: 0 }` | `Button.iconGap: 0` |
| `.ant-skeleton-paragraph li { height: 8px }` | `Skeleton.paragraphLiHeight: 8` |
| skeleton bar gaps / radius | `Skeleton.paragraphMarginTop`, `Skeleton.blockRadius` |
| `.ant-input { padding-block, font-size }` | `Input.paddingBlock`, `Input.paddingInline`, `Input.inputFontSize` |
| modal title size/colour | `Modal.titleFontSize`, `Modal.titleColor` |

A nested `<ConfigProvider theme={{ components: { … } }}>` around one region scopes a token without touching the global theme. Prefer it to rewriting one instance's CSS.

## Why overrides win or lose (verified, not folklore)

antd compiles its styles through `@ant-design/cssinjs` with `hashPriority: 'low'` (the default in `StyleContext`), so every injected selector is wrapped: `:where(.css-<hash>).ant-input-affix-wrapper`.

`:where()` contributes **zero** specificity. Two consequences:

- **Your class can beat antd without `!important`** when it out-ranks the bare antd class. `.search:global(.ant-input-affix-wrapper)` is 0,2,0 against antd's 0,1,0 — it wins.
- **A tie is decided by injection order, not source order.** antd injects its tags at runtime, after your static module CSS, so equal specificity means antd wins even though your file "comes later". The failure in this repo's history was skeleton `li` styling: `.identitySkeleton … .ant-skeleton-paragraph li` tied with antd's own chain and lost. Mirroring antd's inner chain (`.ant-skeleton-section`) raised specificity and won.

Do not try to fix a tie with `!important`; add the missing parent class to the selector.

### Selector shapes

```css
/* antd puts its class on the SAME element as yours → co-selector */
.search:global(.ant-input-affix-wrapper) { … }

/* your class is an ancestor, antd's element is a descendant → descendant */
.modal :global(.ant-modal-footer .ant-btn-primary) { … }

/* an element you also tag (a Button with your className) → co-selector + tag */
.sidebar button.footerAction:global(.ant-btn) { … }
```

`styles.x` and antd's class are separate class names on the same node; combining them as one compound selector is what raises specificity.

## Selectors that silently stop matching

An antd class that no longer exists fails the same way as a missing CSS-module class: no error, no style. v6 renamed the modal panel — its DOM is rendered by `@rc-component/dialog`, where the panel is `${prefixCls}-container`:

| v5 selector | v6 selector |
|---|---|
| `.ant-modal-content` | `.ant-modal-container` |
| `.ant-modal-close-x` | still present, but `classNames.close` is the hook |

Before writing an `:global(.ant-*)` rule, confirm the class exists in the installed build:

```bash
# should print a path per hit; no output means the selector is dead
Get-ChildItem node_modules\antd\es -Recurse -Filter *.js |
  Select-String -Pattern 'ant-modal-container' -List
```

The same check applies to CSS custom properties: `var(--color-surface)` with a typo or an old name silently resolves to nothing. Every `--color-*`, `--space-*`, `--radius-*`, and `--font-*` must exist in `src/lib/design-tokens.ts`; grep it before trusting a name.

## Structures that surprise

- **`Skeleton` root is `display: table`.** `gap` and `align-items` do nothing. The avatar→bars distance is the header cell's `padding-inline-end`; row widths come from the `paragraph.width` prop (accepts an array of px strings), not CSS, because antd sets them inline.
- **`Modal` needs `:global(.ant-modal-container)`** for the panel surface: `className` lands on the `.ant-modal` wrapper (rendered by `@rc-component/dialog`), `rootClassName` is the outermost portal node, and the panel itself carries `-container`. There is no `-content` class in v6.
- **`Modal` footer buttons.** `okButtonProps.className` does work (it lands on the `Button`), so use it when one button needs a hook. Reach for `.ant-modal-footer .ant-btn*` when the footer's pair should share styling — it covers both buttons and their variants in one place, which is why the dialogs here use it.
- **`Tree`/`Dropdown` internals** (`.ant-tree-title`, `.ant-tree-treenode`, `.ant-dropdown-menu-item`) are only reachable as descendants.

## State overrides

Pseudo-class order matters once you override a variant:

```css
.placeOrder:global(.ant-btn-primary) { … }
.placeOrder:global(.ant-btn-primary):not(:disabled):hover { … }  /* keep :disabled out */
```

Override the hover/active/disabled states explicitly when you restyle a background — antd's own state rules still apply and will otherwise fill in from its tokens.

## Checklist before writing an override

1. Does `antd token <Component>` already expose it? → set it in `providers.tsx`.
2. Does the component expose a `classNames` slot for exactly this part? → use it, keep the CSS local.
3. Is the selector specificity strictly above antd's for the same element? → if not, add the ancestor antd uses.
4. Does the rule use `var(--…)` from `design-tokens.ts` rather than a raw hex, px, or radius? → convert it.
5. Would the comment explain *why* the token path failed? → write that comment, or delete the override.
