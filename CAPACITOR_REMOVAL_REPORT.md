# Capacitor removal report

## Removed

- `capacitor.config.ts`
- `ios/`
- `android/` when present
- `@capacitor/core`
- `@capacitor/ios`
- `@capacitor/cli`
- Generated build directories `out/` and `.next/`
- Installed dependency directory `node_modules/`
- Local environment file `.env.local` from the distributable ZIP
- Git metadata `.git/` from the distributable ZIP

## Updated

- `package.json`
- `package-lock.json`
- `next.config.ts`
- `src/app/globals.css`
- `README.md`

## Intentionally retained

- Static export in `next.config.ts`
- `trailingSlash`
- `images.unoptimized`
- PWA service worker and manifest files
- iPhone safe-area CSS used by Safari and installed PWAs

## Verification

- No Capacitor package remains in `package.json` or `package-lock.json`.
- No application source imports Capacitor.
- Next.js compilation and TypeScript validation completed successfully.
- Static page generation began successfully, but the build process did not exit before the execution timeout.
