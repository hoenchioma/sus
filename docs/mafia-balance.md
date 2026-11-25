# Mafia balance notes

How the balance meter and suggested setups were tuned, and what's still open. Numbers come from bot games played on the real engine (thousands of games per setup); treat absolute win rates as ±10 points, since bots don't bluff or read votes the way people do.

## What the simulations found

- **The old suggested setups favoured the Mafia.** At middling village skill the Village won 11–58% depending on player count, and 8 of 11 setups were under 35%. The main cause is the parity rule plus night-1 kills: with 3 Mafia at 8–9 players, one wrong elimination usually loses the game.
- **The old meter was offset.** A score of 0 meant about 26% Village wins, and power roles were valued at roughly twice their measured effect.
- **"Both die" on a tied runoff is fine.** Ties are rare (5–20% of games), nearly always kill one Mafia and one villager, and slightly help the Village.
- **The Lover is worth about one Villager.** Its saves are offset by heartbreak deaths and the partner's lost vote.
- **"Jester ends the game" is very punishing.** The Jester wins 31–42% of games with it on; with "game goes on" it costs the Village only 1–2 points.
- **Serial Killer games ended in a lot of draws,** mostly 1-on-1 endgames.

## What changed

- **Meter refitted on a ×2 scale.**

  | Role | Points |
  |---|---|
  | Villager | +2 |
  | Mafia | −9 |
  | Godfather | −9 (−11 when looking innocent) |
  | Roleblocker | −10 |
  | Detective | +7 |
  | Doctor | +3 |
  | Bodyguard | +2 |
  | Lover | +3 |
  | Vigilante | +3 |
  | Mayor | +3 |

  - Modifiers: −1 baseline, −2 when nothing is revealed on death, +4 for no kills on night 1, +6 when protectors can repeat targets, +2 when the dead can talk.
  - Balanced is ±5 (about one Villager either way).
- **New suggested setups for 5–15 players,** each validated at roughly 40–60% Village wins. 6, 10 and 15 players also turn on "No kills on night 1".
- **New warning** when a single wrong elimination can hand the Mafia the game.
- **Engine fixes from playtesting:**
  - a Doctor or Lover save now comes before a Bodyguard dying for the same target
  - the Serial Killer wins a 1-on-1 against a non-Mafia player instead of drawing
  - one Detective check per night
  - night timers are no longer visible on phones
  - a lone Roleblocker can kill
  - ghost votes are single-use across runoffs
  - no elimination without either a majority or a real runoff
  - ballots are revealed after each vote

## Open questions (rules the group chose; not changed)

- Make "Jester wins, game goes on" the default.
- Let the Lover's partner keep their vote.
