# Meal Planner

A Next.js progressive web app for weekly meal planning, recipes, pantry tracking, shopping lists, and cooking schedules.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
```

The project uses Next.js static export, so the production PWA is generated in `out/`.

## PWA files

The web manifest, service worker, and installable-app assets live under `public/`.

## Native apps

This repository no longer contains Capacitor or generated iOS/Android wrapper projects. A future native iOS app should be maintained as a separate SwiftUI project while sharing the same Supabase backend.
