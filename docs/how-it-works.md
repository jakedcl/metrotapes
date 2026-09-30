# How it works

Metrotapes is a single-page Vite and React app. The home page is a 3D subway station, and the photo, video and about pages are camera moves to screens on its walls. Content lives in Sanity and the videos come from a YouTube playlist. This page covers how those pieces fit. Paths are relative to the repo root.

## Routing and the 3D scene

- `src/App.jsx` has routes for `/`, `/photo`, `/video`, `/about` and `/blog`. Anything else redirects to `/`.
- Only `/blog` renders as a normal page. For the other four routes the route element is `null`. `SHOT` in `App.jsx` maps the path to a camera shot (`kiosk`, `photo`, `video`, `about`), and `StationScene.jsx` (React Three Fiber, lazy loaded) flies the camera there.
- The page content (`PhotoPage`, `VideoPage`, `AboutPage`) is rendered as HTML on top of the canvas, but only after the camera reports it has arrived (`onArrive` sets `pageReady`), so the content doesn't show up while the camera is still moving.
- The boot screen only shows on a first visit to `/`. It waits until the scene has mounted and the preload below has finished. Visiting a wall page directly, or having reduced motion turned on, skips the intro.

## Preloading content

`src/lib/preloadStation.js` starts during boot. It loads the station textures, then fetches the photos, about text and video list, and keeps the results in a small in-memory cache keyed `photo`, `video` and `about`, each with a status of `idle`, `ready`, `empty` or `error`.

The three wall pages read from that cache when they mount (`getWallPageCache`) so they can paint straight away. They wait on `whenStationPreloaded()` and then use the cached result, and only fetch again themselves if the cache never filled. The blog does not use the cache and queries Sanity on its own.

## Content from Sanity

The site reads from a public, read-only Sanity client (`src/lib/sanity.js`, CDN on, published perspective). It uses these document types, defined in `studio/schemaTypes/`:

| Type | Used by |
|---|---|
| `photos` (first document, `images`) | Photo wall |
| `about` | About wall |
| `videos` (`playlistId`) | Read server-side by `/api/videos` |
| `post` | Blog |

The studio also defines `home`, `article`, `landingVideo` and `mediaItem`. Nothing in `src/` queries those.

The studio is a separate project in `studio/`. `npm run build` builds the site, then installs and builds the studio with `SANITY_STUDIO_BASEPATH=/studio`, so it ends up in `dist/studio`. `vercel.json` rewrites `/studio` to the studio's `index.html` and everything else that isn't `/api/`, `robots.txt` or `sitemap.xml` to the site's `index.html`.

## The videos endpoint

`/api/videos` exists so the YouTube key and the playlist id never reach the browser. The logic is in `server/youtubePlaylist.js`. `api/videos.js` wraps it for Vercel, and a small plugin in `vite.config.js` serves the same function on the dev server.

1. It reads `playlistId` from the `videos` document in Sanity, and strips any `?si=` share junk that got pasted into the Studio field.
2. If `YOUTUBE_API_KEY` (or `VITE_YOUTUBE_API_KEY`) is set, it pages through the YouTube Data API `playlistItems` (up to 10 pages of 50), then batch-fetches durations. Durations that fail to load are left off.
3. If there's no key, it reads the playlist's public RSS feed instead. That feed has titles and ids but no durations.
4. Deleted and private videos are skipped.
5. An empty playlist id or an empty playlist returns 200 with `empty: true`. An upstream failure returns 502. Successful non-empty responses get `s-maxage=300, stale-while-revalidate=86400`.

The video page builds thumbnails itself from `i.ytimg.com` and plays with the YouTube embed.

## Graphics tiers

`src/lib/gfxTier.jsx` defines three quality settings, `low`, `mid` and `high`, that control pixel ratio, bloom, antialiasing, film grain, light count and texture sizes. The tier is picked once on load. Reduced motion, data saver, a narrow screen, 4 GB of memory or less, or a touch device with 4 cores or fewer all select `low`. Desktop defaults to `mid`, and `?gfx=low|mid|high` forces one. `high` is only reachable with that parameter. `GfxWatch` in `StationScene.jsx` measures frame rate on `high`, and if it falls below 40 fps it drops to `mid`. It never moves back up.

## Environment variables

All optional. The Sanity defaults point at the production project.

| Variable | Used for |
|---|---|
| `VITE_SANITY_PROJECT_ID`, `VITE_SANITY_DATASET` | Sanity project for the site (also read by the API, along with `SANITY_PROJECT_ID` and `SANITY_DATASET`) |
| `YOUTUBE_API_KEY` (or `VITE_YOUTUBE_API_KEY`) | YouTube Data API for the playlist. Without it the RSS feed is used. |

## Limits worth knowing

- **Without an API key the video list has no durations.** The RSS feed also carries no paging, so very long playlists are not guaranteed to show in full.
- **The API key is read from `VITE_YOUTUBE_API_KEY` too.** Only the server code reads it, but a `VITE_` name is the kind Vite exposes to client code, so prefer `YOUTUBE_API_KEY`.
- **The studio config has the project id and dataset written in** (`studio/sanity.config.js`, `studio/sanity.cli.cjs`), as does the API fallback, so pointing at another project means changing those too.
- **The preload tries to warm video thumbnails** from fields the API doesn't return, so in practice only photos and about images are preloaded.
- **`StationScene.jsx` is one very large file** (about 5,000 lines) that holds the whole scene.
