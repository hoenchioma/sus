# Sus

A helper app for in-person social deduction games (Mafia / Werewolf, with Avalon-style games planned).

- **Mode 1 — Host tracker:** one phone; the host runs the night out loud and the app tracks choices, deaths, votes, and lets you step back and forth.
- **Mode 2 — Everyone on their phone:** the app runs the game, with an optional TV dashboard.

## Development

```bash
npm install
npm test             # engine tests
npm run build        # typecheck + production build
npm run dev          # web app on http://localhost:5173 (Mode 1 works on its own)
npm run dev:server   # Mode 2: builds the web app and serves it + rooms on http://localhost:8787
```

For Mode 2 with hot reload, run `npm run dev:server` and `npm run dev` side by side; Vite proxies `/api` to the local Worker.

### Deploying (Mode 2)

Mode 2 runs on Cloudflare's free tier: one Worker serves the app and `/api`, and each room is a Durable Object.

```bash
npx -w @sus/server wrangler login
npm run deploy
```

- `packages/engine` — pure TypeScript game logic (roles, night resolution, votes, win checks, house rules, balance meter). A game is a setup plus a list of steps; state is always derived by replaying the steps, which is what makes back/forward editing safe.
- `apps/web` — React + Vite + Tailwind PWA (Mafia and Werewolf skins, SVG character art). Routes: `/` (home + Mode 1), `/play/CODE` (player phone), `/tv/CODE` (TV dashboard).
- `apps/server` — Cloudflare Worker + `RoomObject` Durable Object. The room logic itself lives in `packages/engine/src/mafia/online.ts`; the server only holds sockets, persists the room and sends each client its own view.
- Narration clips go in `apps/web/public/audio/<skin>/<cue>.mp3` (e.g. `wake-mafia.mp3`, `sleep-doctor.mp3`, `night.mp3`, `dawn.mp3`); until they exist the browser's voice reads the lines.
