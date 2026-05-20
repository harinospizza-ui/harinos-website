# Harino's Pizza Web App

Mobile-first ordering app for Harino's Pizza built with React, TypeScript, and Vite.

## Features

- Offer carousel with three editable offer cards
- Category and item-based discount logic
- Auto-added promotional items when offer conditions are met
- Outlet routing based on customer location and road distance
- WhatsApp checkout flow
- Install prompt support for Android and iOS users
- Local storage for only the latest three past orders

## Run Locally

Prerequisite: Node.js 20+ recommended

1. Install dependencies:
   `npm install`
2. Start the development server:
   `npm run dev`
3. Build for production:
   `npm run build`

## Main Files To Edit

- `constants.tsx`
  Use this for menu items, outlet details, and all three offer cards.
- `manifest.json`
  Use this for install name, icons, and app identity.
- `index.html`
  Use this for meta tags, splash details, and global styles.

## Deployment Notes

- Deploy the built app on the same production domain to keep installed users on the same app identity.
- The app checks for new versions and reloads fresh code instead of relying on stale browser cache.
- Keep outlet coordinates and phone numbers updated in `constants.tsx` so orders are routed correctly.
