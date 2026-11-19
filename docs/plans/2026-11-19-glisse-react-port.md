# Glisse Liquid Glass React Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the PocketMC Telemetry dashboard webapp to React (Vite + TypeScript) and integrate official React components from the `glisse` library (`<Glass>`, `<Button>`, `<Switch>`, `<TabBar>`, `<SegmentedControl>`, `<Input>`, `<Slider>`) for authentic Liquid Glass optical refraction and physics.

**Architecture:** A lightweight, high-performance client-side React single-page application built with Vite and TypeScript. Telemetry data is fetched from live PocketMC Render proxies using a robust `useTelemetry` React hook. Real `glisse` components (`glisse@0.6.0`) are utilized across the entire UI with an ambient `<LiquidAura>` fluid ribbon wallpaper backdrop (`data-glisse-backdrop="true"`).

**Tech Stack:** React 19 / 18, TypeScript, Vite, `glisse@0.6.0`, `jsvectormap` (with world map), Lucide icons / SVG assets.

## Global Constraints
- Target Node.js v20+ / v26.
- All glass components must use the genuine `glisse` npm package (`import { Glass, Button, Switch, TabBar, SegmentedControl, Input } from "glisse"`).
- Background canvas must carry `data-glisse-backdrop="true"` to activate Glisse's optical refraction engine.
- Zero regression in telemetry functionality: live stats aggregation, real-time client counts, server engine distribution, country flags, search filtering, and interactive world map.
- Production build output must generate clean static assets in `./dist` for automated GitHub Pages deployment via GitHub Actions.

## Review Focus
1. **Glass Refraction Visibility:** Ensure `<Glass>` elements sit over the dynamic `<LiquidAura>` canvas so optical bezel bending and dispersion are rendered correctly.
2. **Switch & Segmented Control Interaction:** Verify state changes (`7d`, `24h`, `30d`, `total` and auto-refresh toggle) smoothly trigger state updates and spring animations.
3. **Responsive Map Lifecycle:** Prevent memory leaks by properly destroying and recreating `jsvectormap` instances on React component unmount or theme change.
4. **Offline / Proxy Fallback:** Gracefully handle proxy timeouts or network errors with user-friendly retry states.
5. **Fast Load & Zero Lag:** Keep bundle size compact with tree-shaking, fast hydration, and throttled canvas animations.

---

### Task 1: Initialize Vite React TypeScript Scaffolding & Install Dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html` (Vite SPA entry)

- [ ] Initialize `package.json` with scripts (`dev`, `build`, `preview`) and dependencies: `react`, `react-dom`, `glisse@0.6.0`, `jsvectormap`, `lucide-react`.
- [ ] Configure `vite.config.ts` with React plugin and base path `./` for GitHub Pages compatibility.
- [ ] Set up `tsconfig.json` for modern React JSX (`react-jsx`) and strict type checking.
- [ ] Run `npm install` and verify zero dependency conflicts.
- [ ] Commit: `chore: scaffold vite react typescript project with glisse`

---

### Task 2: Implement Telemetry Data Model & `useTelemetry` Hook

**Files:**
- Create: `src/types/telemetry.ts`
- Create: `src/services/telemetryApi.ts`
- Create: `src/hooks/useTelemetry.ts`

- [ ] Define comprehensive TypeScript interfaces for raw proxy stats, aggregated metrics, and distribution dictionaries.
- [ ] Implement `fetchAggregatedStats` in `telemetryApi.ts` querying `https://pocket-mc-proxy.onrender.com/api/telemetry/stats` with timeout and fallback logic.
- [ ] Create `useTelemetry(refreshIntervalSeconds, autoRefreshEnabled)` hook providing `{ data, loading, error, lastUpdated, refresh }`.
- [ ] Verify telemetry fetch with Node test script or quick hook test.
- [ ] Commit: `feat(telemetry): implement telemetry data model and useTelemetry hook`

---

### Task 3: Implement Dynamic Fluid Aura Canvas (`<LiquidAura>`)

**Files:**
- Create: `src/components/LiquidAura.tsx`
- Create: `src/styles/liquid-aura.css`

- [ ] Build `<LiquidAura>` component with `<canvas>` inside `<div className="liquid-aura-bg" data-glisse-backdrop="true">`.
- [ ] Implement smooth Lissajous ribbon animation with theme-aware palettes (Dark: Sapphire/Violet/Cyan/Rose; Light: Sky/Lavender/Mint/Aqua).
- [ ] Add subtle pointer drift and automatic frame throttle on tab blur / `prefers-reduced-motion`.
- [ ] Verify canvas renders smoothly with zero CPU spikes.
- [ ] Commit: `feat(ui): implement LiquidAura dynamic wallpaper canvas with glisse backdrop support`

---

### Task 4: Build Glisse Floating Command Bar (`<GlisseTopBar>`)

**Files:**
- Create: `src/components/GlisseTopBar.tsx`
- Create: `src/styles/topbar.css`

- [ ] Build `<GlisseTopBar>` using Glisse's authentic `<TabBar>` for section links (`Overview`, `Clients`, `Servers`, `Map`).
- [ ] Implement Glisse's `<Switch>` for the live 30s auto-refresh toggle with active state reflection.
- [ ] Implement Glisse's `<Button variant="glass">` for the manual Refresh action with spinning icon.
- [ ] Integrate Theme toggle (`dark` / `light`) managing `document.documentElement` attribute and `localStorage`.
- [ ] Commit: `feat(ui): implement GlisseTopBar with authentic glisse TabBar, Switch, and Buttons`

---

### Task 5: Build Glisse KPI Cards & Section Containers

**Files:**
- Create: `src/components/KpiCard.tsx`
- Create: `src/components/SectionCard.tsx`
- Create: `src/components/TimeframeControl.tsx`

- [ ] Build `<KpiCard>` wrapping metrics inside `<Glass>` from `glisse` with specular highlights and metric formatting.
- [ ] Build `<SectionCard>` with `<Glass>` surface, icon badge, title, and insight banner.
- [ ] Build `<TimeframeControl>` using Glisse's authentic `<SegmentedControl>` for `[ 7 Days | 24 Hours | 30 Days | All Time ]`.
- [ ] Wire timeframe changes to update active user counts and percentages in real time.
- [ ] Commit: `feat(ui): implement Glisse KPI cards and timeframe SegmentedControl`

---

### Task 6: Build Searchable Distribution Breakdowns with Glisse `<Input>`

**Files:**
- Create: `src/components/BreakdownCard.tsx`
- Create: `src/components/BreakdownList.tsx`
- Create: `src/utils/countryFlags.ts`

- [ ] Port `countries.js` to typed `countryFlags.ts` returning ISO flag images from FlagCDN.
- [ ] Build `<BreakdownCard>` featuring Glisse's authentic `<Input type="search">` for instant live filtering.
- [ ] Render progress bar rows with Glisse slider track aesthetic (`--lg-rail` and glowing fill).
- [ ] Test live filtering on versions and countries with empty-state messages.
- [ ] Commit: `feat(ui): implement BreakdownCard with real glisse search Input and progress rows`

---

### Task 7: Build Server Engines Fleet Table with Authentic Flavor Logos

**Files:**
- Create: `src/components/ServerFleetTable.tsx`
- Move: `src/flavors/*` to `public/flavors/*`

- [ ] Create `<ServerFleetTable>` displaying Minecraft server engine rows (Paper, Fabric, NeoForge, Forge, Vanilla, Bedrock, Spigot, Purpur).
- [ ] Show official server flavor logo, server count, percentage share, and colored progress bar.
- [ ] Commit: `feat(ui): implement ServerFleetTable with official flavor icons`

---

### Task 8: Build Global Activity Map (`<TelemetryWorldMap>`)

**Files:**
- Create: `src/components/TelemetryWorldMap.tsx`

- [ ] Implement `<TelemetryWorldMap>` using `jsvectormap` within a `<Glass>` container.
- [ ] Plot cyan/blue live active player markers and green registered install markers.
- [ ] Provide interactive tooltips with country name, flag, active player count, and total installs.
- [ ] Properly clean up map instance on unmount and theme switch.
- [ ] Commit: `feat(map): implement TelemetryWorldMap with jsvectormap and glisse glass framing`

---

### Task 9: Assemble Dashboard Single-Page App & Fullscreen Heatmap View

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Create: `src/components/FullscreenHeatmap.tsx`
- Create: `src/styles/app.css`

- [ ] Assemble all sections into `<App>`: TopBar, Installations & User Base, Active Clients, Live Servers, Global Map, and Footer.
- [ ] Add route/view switcher for fullscreen heatmap (`?view=heatmap` or `#heatmap`) with a Glisse `<Button>` back link.
- [ ] Verify keyboard navigation, accessibility attributes, and responsive layout from mobile (360px) to 4K displays.
- [ ] Commit: `feat: assemble full React telemetry app with glisse components`

---

### Task 10: Production Build, GitHub Actions Workflow & Verification

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Test: Build output in `./dist`

- [ ] Update `.github/workflows/deploy.yml` with `actions/setup-node@v4`, `npm ci`, `npm run build`, and deploy `./dist` to GitHub Pages.
- [ ] Run `npm run build` locally and verify zero TypeScript errors, bundle size under control, and clean HTML output.
- [ ] Start local preview server and run browser subagent to verify authentic Glisse components, refraction, and interactive controls.
- [ ] Commit and push to `origin/main`.
- [ ] Commit: `ci: update GitHub Actions deployment workflow for Vite React app`
