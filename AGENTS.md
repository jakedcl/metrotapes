# metrotapes

A Vite + React 18 single-page app (portfolio/media site) styled with `styled-components`, backed by [Sanity](https://www.sanity.io/) as a headless CMS. Routing is client-side via `react-router-dom`; deployed on Vercel (`vercel.json` rewrites all routes to `index.html`).

## Cursor Cloud specific instructions

### Services

There is a single service: the Vite dev server for the React SPA. Standard scripts live in `package.json` (`dev`, `build`, `lint`, `preview`); package manager is `npm` (there is a `package-lock.json`). There is no automated test suite.

- Run dev: `npm run dev` (Vite on port `5173`, host enabled — see `vite.config.js`).
- Lint: `npm run lint`. Note it currently reports pre-existing `react/prop-types` errors in `src/components/ProjectGrid.jsx` and `react-hooks/exhaustive-deps` warnings in `src/components/ImageModal.jsx`. These are unrelated to environment setup; do not "fix" them as part of setup.
- Build: `npm run build` (outputs to `dist/`).

### Backend / data (Sanity)

- The Sanity client (`src/lib/sanity.js`) is read-only and falls back to a hardcoded public `projectId` (`l3itmzli`) and dataset (`production`), so the app loads real CMS content (photos, about, videos) with **no env vars required**. Override with `VITE_SANITY_PROJECT_ID` / `VITE_SANITY_DATASET` only if you need a different dataset.

### Non-obvious caveats

- Core UX flow: the landing route `/` is a lock screen — you must click/swipe the MetroCard to unlock and reveal the Home "machine" with `photo` / `video` / `about` nav. Other routes (`/photo`, `/about`, `/video`, `/blog`) auto-unlock.
- The `/video` page needs a `VITE_YOUTUBE_API_KEY` (YouTube Data API v3). Without it, the page renders a graceful "Missing VITE_YOUTUBE_API_KEY" status message instead of videos — this is expected, not a bug.
- The Home page embeds a YouTube `<iframe>` background video. In datacenter/VM/cloud environments YouTube may show a "Sign in to confirm you're not a bot" gate inside the embed. This is a YouTube anti-bot measure tied to the VM's IP, not an app or environment defect — the rest of the app is unaffected.
