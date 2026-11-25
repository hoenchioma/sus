# Sus

A helper app for in-person social deduction games (Mafia / Werewolf, with Avalon-style games planned).

- **Mode 1 — Host tracker:** one phone; the host runs the night out loud and the app tracks choices, deaths, votes, and lets you step back and forth.
- **Mode 2 — Everyone on their phone:** the app runs the game, with an optional TV dashboard.

## Development

```bash
npm install
npm run dev     # web app on http://localhost:5173
npm test        # engine tests
npm run build   # typecheck + production build
```

- `packages/engine` — pure TypeScript game logic (roles, night resolution, votes, win checks, house rules, balance meter). A game is a setup plus a list of steps; state is always derived by replaying the steps, which is what makes back/forward editing safe.
- `apps/web` — React + Vite + Tailwind PWA (Mafia and Werewolf skins, SVG character art).
