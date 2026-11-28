# Sus

A helper app for in-person social deduction games: Mafia / Werewolf and Polashi / Avalon.

- **Mode 1 — Host tracker:** one phone; the host runs the game out loud and the app tracks choices, deaths, votes, and lets you step back and forth.
- **Mode 2 — Everyone on their phone:** the app runs the game, with an optional TV dashboard.

## Games

### Mafia / Werewolf

A hidden team kills one player each night; everyone else talks it out by day and votes someone out. The town wins by removing every killer; the Mafia wins once it matches the rest in number. For 5+ players (up to 20 on phones). The setup screen suggests a balanced mix for the player count and scores any mix you pick.

The two games play by the same rules; only the names, art and narration differ. Each role is listed below as **Mafia name / Werewolf name**.

| Role | Team | Power |
|---|---|---|
| **Civilian / Villager** | Town | No power: just your wits and your vote. |
| **Mafia / Werewolf** | Mafia | Picks a victim with the rest of the team each night. |
| **Godfather / Alpha Wolf** | Mafia | Leads the team and has the final say on the kill. Optionally looks innocent to the Detective. |
| **Roleblocker / Witch** | Mafia | Cancels one player's power each night. |
| **Doctor / Healer** | Town | Protects one player from being killed each night. |
| **Detective / Seer** | Town | Checks one player each night: Mafia or not? |
| **Bodyguard / Guardian** | Town | Guards one player and dies in their place if they're attacked. |
| **Lover** | Town | Protects a partner each night. If the Lover dies at night, the partner dies too. The partner is named in the morning and can't vote that day. |
| **Vigilante / Hunter** | Town | One shot at night, once per game. |
| **Mayor / Elder** | Town | Can reveal themselves by day; from then on their vote counts twice. |
| **Serial Killer / Lone Wolf** | Neutral | Kills every night; wins only as the last one standing. |
| **Jester / Fool** | Neutral | Wins by getting voted out. |

House rules cover what a death reveals, whether protectors must switch targets, self-protection, how many votes are needed and how ties are broken, ghost votes for the dead, and more. Presets: Classic, Beginner and Hidden roles. On phones, nights are either *quick tap* (everyone taps at once, so nobody can tell who has a power) or *narrated* (the TV or host phone calls each role in turn).

### Polashi / Avalon

Teams go on five missions. Each round a leader proposes a team and everyone votes on it. If the team is approved, its members secretly play Success or Betrayal, and one Betrayal sinks the mission (two on mission 4 with 7+ players). Three successes win it for the good side, unless the evil side then identifies their hidden informer. Three failures, or five rejected teams in a row, win it for evil. For 5–15 players (11–15 use a house table).

**Polashi** retells the 1757 Battle of Plassey: the Nawab's loyalists against the East India Company (EIC) and its conspirators, in English or Bangla. **Avalon** is the classic Arthurian version. Each role is listed below as **Polashi name / Avalon name**.

| Role | Side | Power |
|---|---|---|
| **Mir Madan / Merlin** | Good | Knows who is evil (except Ray Durlov / Mordred). Must guide without being found out. |
| **Mohon Lal / Percival** | Good | Sees Mir Madan / Merlin, but Ghoseti Begum / Morgana looks the same. |
| **Nawab's loyalist / Loyal Servant** | Good | No power. |
| **Mir Jafar / Assassin** | Evil | Knows the evil team. If good wins three missions, gets one guess at Mir Madan / Merlin; a correct guess wins it for evil. |
| **Ghoseti Begum / Morgana** | Evil | Appears as Mir Madan / Merlin to Mohon Lal / Percival. |
| **Ray Durlov / Mordred** | Evil | Hidden from Mir Madan / Merlin. |
| **Umichad / Oberon** | Evil | On the evil side, but unknown to them and they to him. |
| **EIC conspirator / Minion of Mordred** | Evil | Knows the evil team; slips Betrayals into missions. |

Mir Madan / Merlin and Mir Jafar / Assassin are always in play; the others are optional. In Polashi, each card also carries a named historical figure from the battle, such as Siraj-ud-Daulah or Robert Clive. This is just flavour and doesn't affect the rules. Optional rules:
- **Spy / Lady of the Lake:** after missions 2–4, the holder secretly learns one player's side.
- **Anonymous votes**
- **Choosing the first leader:** host's pick or random.

Presets: First game, Classic and Full.

## Development

```bash
npm install
npm test             # engine tests
npm run build        # typecheck + production build
npm run dev          # web app on http://localhost:5173 (Mode 1 works on its own)
npm run dev:server   # Mode 2: builds the web app and serves it + rooms on http://localhost:8787
npm run typecheck    # tsc across engine, web and server
npm run e2e          # simulated games (Mafia, Polashi, Avalon): starts the local Worker and plays full games with bot phones in Chromium
```

For Mode 2 with hot reload, run `npm run dev:server` and `npm run dev` side by side; Vite proxies `/api` to the local Worker.

### CI

- Every push runs the typecheck.
- Pull requests run the engine tests and the simulated games. Run one on its own with `node e2e/run.mjs polashi`. If the simulated game fails, the phone screenshots are uploaded as an artifact.

### Deploying (Mode 2)

Mode 2 runs on Cloudflare's free tier. One Worker serves the app and `/api`, and each room is a Durable Object. Anyone can deploy their own copy to their own Cloudflare account.

**Settings** (environment variables, or a `.env` file at the repo root):

| Variable | Required | Meaning |
|---|---|---|
| `DEPLOY_DOMAIN` | no | Hostname to serve on, e.g. `sus.example.com`. It must be in a zone on your Cloudflare account; Cloudflare creates the DNS record and certificate. Without it, the app is served on your `workers.dev` subdomain. |
| `CLOUDFLARE_ACCOUNT_ID` | only with several accounts | Which account to deploy to. |
| `CLOUDFLARE_API_TOKEN` | in CI | Not needed locally after `wrangler login`. |

**From your machine:**

```bash
npx -w @sus/server wrangler login
```

```bash
DEPLOY_DOMAIN=sus.example.com npm run deploy
```

It prints the live URL at the end. Check it with the simulated games: `BASE_URL=<that url> npm run e2e`.

**From GitHub:** every push to `main` deploys automatically, then plays the simulated games against the live site. You can also run the Deploy workflow by hand from the Actions tab. Under Settings → Secrets and variables → Actions, add:

- **Secret `CLOUDFLARE_API_TOKEN`:** a token with Workers Scripts: Edit and Account Settings: Read on your account. With a custom domain, also Workers Routes: Edit, DNS: Edit and Zone: Read on that domain's zone.
- **Secret `CLOUDFLARE_ACCOUNT_ID`:** shown on the Workers & Pages overview page.
- **Variable `DEPLOY_DOMAIN`** (optional): as above.

The workflow uses a `production` environment, so you can require an approval in the repo settings.

### TV screen

Open `<your site>/tv` on any big screen. It shows a 4-digit code; on the host's phone, the lobby's **Show it on a TV** card takes that code and sends the TV into the room. `<your site>/tv/CODE` still works directly.

**Android TV app.** The TV's browser works, but the app is nicer: it opens straight to the pairing code, plays the narrator and sounds without a tap (using the TV's own voice), and keeps the screen awake.

It runs on Android TV, Google TV and Fire TV. To install it on a Fire TV:

1. Install **Downloader** from the Fire TV app store.
2. Turn on developer options: Settings → My Fire TV → About, then click the device name 7 times.
3. Allow installs from Downloader: Settings → My Fire TV → Developer options → Install unknown apps → Downloader → On.
4. In Downloader, enter `<your site>/tv.apk` (for example `sus.example.com/tv.apk`) and install.

Updates install the same way, over the top.

**Builds and releases.** The *Android TV app* workflow builds the APK for the deployed address:

| Trigger | What it publishes |
|---|---|
| Every push to `main` | Refreshes the rolling **`latest`** pre-release. It follows `main`, like the site, and `<your site>/tv.apk` redirects to it. |
| Pushing a version tag, e.g. `v1.2.0` | A versioned release with its own APK, kept on the Releases page. |
| Run workflow (manual) | Same as a push to `main`, e.g. after changing `DEPLOY_DOMAIN`. |

Every build gets a higher version number than the last, so any of them installs over whatever is on the TV. Release downloads need a public repository: the TV can't sign in to GitHub. The workflow needs these repository secrets:

| Secret | What it is |
|---|---|
| `ANDROID_TV_KEYSTORE_BASE64` | The signing keystore, base64-encoded |
| `ANDROID_TV_KEYSTORE_PASSWORD` | Its password |
| `ANDROID_TV_KEY_ALIAS` | The key's alias |
| `ANDROID_TV_KEY_PASSWORD` | The key's password |

Create the keystore once, keep a copy safe, and never change it. Android only installs an update signed with the same key as the installed app.

```bash
keytool -genkeypair -keystore sus-tv.jks -alias sus -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Sus"
```

```bash
base64 -w0 sus-tv.jks
```

The second command prints the value for `ANDROID_TV_KEYSTORE_BASE64`.

To build locally, you need JDK 17+ and the Android SDK:

```bash
cd apps/androidtv && SUS_URL=https://sus.example.com ./gradlew assembleDebug
```

A debug build can point at `wrangler dev`; from the Android emulator that's `SUS_URL=http://10.0.2.2:8787`.

## Layout

- `packages/engine` — pure TypeScript game logic (roles, night resolution, votes, win checks, house rules, balance meter). A game is a setup plus a list of steps; state is always derived by replaying the steps, which is what makes back/forward editing safe.
- `apps/web` — React + Vite + Tailwind PWA (Mafia and Werewolf skins, SVG character art). Routes: `/` (home + Mode 1), `/play/CODE` (player phone), `/tv/CODE` (TV dashboard).
- `apps/androidtv` — the Android TV app: a small Android wrapper around `/tv` that adds the TV's voice and keeps the screen on.
- `apps/server` — Cloudflare Worker + `RoomObject` Durable Object. The room logic itself lives in `packages/engine/src/mafia/online.ts`; the server only holds sockets, persists the room and sends each client its own view.
- Narration clips go in `apps/web/public/audio/<skin>/<cue>.mp3` (e.g. `wake-mafia.mp3`, `sleep-doctor.mp3`, `night.mp3`, `dawn.mp3`); until they exist the browser's voice reads the lines.
