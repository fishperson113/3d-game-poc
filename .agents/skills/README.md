# Repository-scoped agent skills

`img2threejs/` is installed locally as a history-free source snapshot from the commit pinned in `tools/img2threejs.lock.json`. Run `npm run skill:install:img2threejs` to reproduce it. The snapshot is ignored, while reviewed generated factories under `src/parts/` are committed as game source.

This directory is outside `src/`: skills assist coding agents at authoring time and are never imported into the browser application.
