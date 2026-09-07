# Besiege-lite Web PoC

Walking skeleton for the architecture accepted in [`DECISIONS.md`](./DECISIONS.md). The project uses vanilla TypeScript, Vite, Three.js, Rapier, Vitest and Playwright; there is no UI framework, ECS or multiplayer layer.

## Run

```bash
npm ci
npm run dev
```

Quality gate:

```bash
npm run check
```

Implementation work is split into parallel-safe sessions in [`docs/README.md`](./docs/README.md). Plans 01–04 form the parallel foundation wave; plan 05 is the ordered playable-runtime integration wave.

`img2threejs` is repository-scoped agent tooling installed at `.agents/skills/img2threejs`. It is intentionally outside `src/`, excluded from the browser bundle, and pinned by `tools/img2threejs.lock.json`.

Install its pinned, history-free source snapshot with:

```bash
npm run skill:install:img2threejs
```
