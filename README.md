# Metrotapes

The portfolio site for Metrotapes, built as an interactive subway station. The station is the navigation: the photo, video and about pages are camera shots inside a 3D scene rather than separate page layouts. Blog posts are ordinary pages.

Live at [metrotapes.com](https://metrotapes.com).

## How it works

- A boot screen leads into a kiosk in the station. Routes are `/`, `/photo`, `/video`, `/about` and `/blog`.
- The scene is built with React Three Fiber and Three.js, with post-processing and a few graphics quality tiers.
- Content (photos, about text, blog posts and the video playlist id) comes from Sanity.
- Videos are read from a YouTube playlist through a small serverless endpoint at `/api/videos`, which falls back to the playlist's RSS feed when no API key is set.
- The Sanity Studio lives in `studio/` and is built into the deployed site under `/studio`.

## Stack

Vite, React 18, React Router, Three.js with React Three Fiber, styled-components, Sanity, deployed on Vercel.

## Running it locally

You need a current Node.js LTS.

```sh
npm install
npm run dev
```

The site runs on the Vite dev server, which also serves `/api/videos`. To edit content locally, run the studio in a second terminal:

```sh
npm install --prefix studio
npm run dev:studio
```

Optional environment variables (put them in `.env.local`):

- `VITE_SANITY_PROJECT_ID` and `VITE_SANITY_DATASET` to point at a different Sanity project. The defaults are the production ones.
- `YOUTUBE_API_KEY` for the YouTube Data API. Without it the video list uses the playlist RSS feed.

## Scripts

- `npm run dev` starts the site
- `npm run dev:studio` starts the Sanity Studio
- `npm run build` builds the site and the studio
- `npm run build:site` builds only the site
- `npm run lint` runs ESLint
