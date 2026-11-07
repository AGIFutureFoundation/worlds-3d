# Worlds 3D — Deploy Plan

**Status:** PLAN ONLY. No repo created, nothing pushed, nothing deployed. Deploy only after Mike approves the exact version (and after the real-browser playtest in BUILD-REPORT.md).

## Recommended target: a NEW repo under AGIFutureFoundation

**Repo:** `AGIFutureFoundation/worlds-3d` (public, branch `main`, no custom domain at first).
**Why a new repo, not the Foundation repo:** the Foundation repo's Pages custom-domain setup for `www.agifuturefoundation.org` is under active investigation (2026-11-06 17:30 PST finding: WorldForge-Browser's `site/CNAME` also claims `www.agifuturefoundation.org`, both repos' Pages custom-domain settings are empty, and www still serves the old Kylon site — Mike's decision on whether WorldForge relinquishes www is pending). Deploying worlds-3d into that repo would entangle this build with that unresolved conflict. A fresh repo deploys cleanly to `https://agifuturefoundation.github.io/worlds-3d/` with zero domain questions.
**Why not the fellowship.chat repo:** that repo is the Worlds Hub (lobby + plans + showcase). Keeping worlds-3d separate preserves the "one repo, one site" pattern the other three sites follow and avoids mixing a 9.2 MB 3D build into the hub's release flow. Link the two sites to each other instead (already done: the lobby links to the hub; the hub can link back to worlds-3d once live).

## What deploys (file manifest)

Total build: 9.2 MB, 36 files. No build step — static files, served as-is.

**Text files — snapshot push** (verify repo HEAD against the sync record first; append the new SHA after each success; approval cards expire after 30 minutes — push only while Mike is present):
- `index.html`, `lobby.js`, `player.html`, `player.js`, `site.css`, `data.js`
- `data/worlds.json`, `data/anchors.json`, `data/fabrics/` (6 files)
- `worlds/` (7 files)
- `engine/engine.js`, `engine/engine.css`, `engine/test.html`, `engine/test-world.json`
- `engine/three.module.min.js`, `engine/GLTFLoader.js`, `utils/BufferGeometryUtils.js`
- `tools/build_worlds.py`, `tools/gen_data_js.py`
- `ENGINE-NOTE.md`, `WORLDS-NOTE.md`, `BUILD-REPORT.md`, `DEPLOY-PLAN.md`
- Total text: ~1.9 MB. One snapshot push is fine (well under the 16 MiB snapshot limit).
- New sync record at `~/workspace/your_files/worlds-3d.muse-github-snapshot-sync.json` (adjacent to the build folder), first entry = the initial push SHA.

**Binaries — GitHub web upload** (the 7 GLBs, 7.3 MB total — each file is under the 25 MB web-upload limit; largest is capsule.glb at 3.4 MB):
- `assets/glb/Stool.glb` (1.4 MB), `Bucket.glb` (504 KB), `Crate.glb` (1.2 MB), `Tin.glb` (504 KB), `Container.glb` (640 KB), `duck.glb` (120 KB), `capsule.glb` (3.4 MB)
- Upload in two web batches (4 + 3), one commit per batch, each verified at its exact path before the next batch. Do NOT use a Mac git push for these.

**Repo creation:** the GitHub API cannot create org repos from the Muse GitHub App (it lacks org repo-creation permission — same as the Foundation and fellowship.chat repos, both created via the browser web UI). Create `AGIFutureFoundation/worlds-3d` in the browser as the org owner (public, main, no README/gitignore/license files — the snapshot push supplies the content), then run the snapshot push, then the web-upload batches.

## Verification after deploy
1. `https://agifuturefoundation.github.io/worlds-3d/` → 200, lobby renders, stats strip reads "544 worlds · 7 playable now · 0 live on RP1".
2. `player.html?world=agi-corp-hub` → 200 and (in a real browser) the Hub mounts; complete the Welcome Tour quest once.
3. `data.js`, `data/worlds.json`, `assets/glb/Stool.glb`, `engine/three.module.min.js` → 200 each.
4. Search "bull" in the lobby → 1 result; biome "desert" → 3.
5. Confirm the live site shows the same file set as local (spot-check `worlds/smartciti-holodeck.json` → 200).

## Custom domain — left open for Mike
Ship first on the `github.io` preview URL. A custom domain (e.g. `worlds.fellowship.chat` or a `worlds-3d` subdomain) is a separate decision: it needs the fellowship.chat zone to be Active first (DNS propagation watch is running) and a call on whether worlds-3d lives under fellowship.chat or its own domain. Do not attach any custom domain in the first deploy.

## Rollback
Delete the repo (or disconnect Pages) — the local build folder is the source of truth and is untouched by the deploy. Nothing else depends on this repo.

## After this deploy
- Link worlds-3d from the fellowship.chat hub (Worlds section) and from the Foundation site (projects/RP1 pages) in their next approved pushes.
- Real-browser playtest findings get fixed locally first, then pushed as a follow-up snapshot.
