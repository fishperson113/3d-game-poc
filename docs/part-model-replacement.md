# Part model replacement

Plan 04 keeps assembly and physics data independent from the Three.js model. A model replacement changes the visual adapter or its generated factory; it does not change the part definition ID, socket IDs, blueprint transforms, colliders, joints, or control bindings.

## Files and ownership

For one part, edit these authoring/runtime files:

- `art-source/parts/<part>/brief.md` is the visual brief and provenance source.
- `src/parts/<part>/visual.generated.ts` is the generated geometry factory. Regenerate it from the source brief/pipeline when an approved asset pipeline is available; do not hand-edit generated geometry as a substitute for the source.
- `src/parts/<part>/visual.adapter.ts` owns normalization and idempotent disposal. The adapter is the only module that imports the generated factory.
- `src/parts/<part>/manifest.json` records the visual factory, revision, normalization, variants, brief, license and tool SHA. Its assembly sockets and physics section are authoritative gameplay data and stay unchanged for a visual-only replacement.

The stable IDs are `core.structural-block`, `core.powered-wheel` and `core.steering-hinge`. Variant A/B is selected in Build mode for QA and is deliberately absent from the blueprint.

## Normalization rules

The generated root is a child of the semantic part root. Keep one unit equal to one metre, Y-up, forward +Z and the origin at the authoritative part frame. Apply scale, axis conversion and origin correction to the visual child in the adapter. Do not move the part root or update sockets to compensate for a model export. Wheel axle and steering axes remain the physics contract: the renderer applies the body transform once and does not add a second wheel rotation animation.

Factories create a new `THREE.Group` per instance. They do not create a scene, camera, lights, renderer, RAF or global listener. `dispose()` is idempotent and is called by the renderer when a blueprint is rebuilt or the app is torn down.

## Provenance and pipeline limitation

The manifest provenance must include the brief, license and the SHA recorded by `tools/img2threejs.lock.json`. The lock commit and `.agents/skills/img2threejs/.source-commit` were verified as `6e60b5e22419464b4853e01ddb6c0e6f6659a733`.

The current checkout has no external reference image and the local skill checkout has no `.git` directory. The three committed factories therefore come from the reviewed internal procedural briefs. The strict img2threejs quality stages were not claimed as passed: there is no reference-image license/SHA or reproducible generator checkout to attach to that evidence. Runtime/build does not depend on Python or the skill checkout.

## QA and rollback

Run the following for each part:

```text
npm run part:qa -- core.structural-block
npm run part:qa -- core.powered-wheel
npm run part:qa -- core.steering-hinge
```

Then run `npm run test:e2e`. The browser test assembles the machine from the palette, starts it, drives and steers it, resets it, captures the same-camera A/B screenshots, compares blueprint and compiled physics JSON, and performs 20 more Start/Reset cycles. The evidence images are [plan04-visual-a.png](./evidence/plan04-visual-a.png) and [plan04-visual-b.png](./evidence/plan04-visual-b.png).

To roll back a visual revision, restore the previous brief/generated factory/adapter revision and the manifest visual revision, then rerun part QA and e2e. If sockets, colliders, axes or bindings must change, treat that as a gameplay contract migration and review it separately; it is not a model replacement.
