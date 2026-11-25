# Polashi / Avalon balance notes

Tuned from about 510,000 simulated games played through the quest engine's own step functions. The bots reason about votes, chapter results and Spy claims; Merlin hides, evil coordinates, the Assassin reads voting patterns. Differences between setups are the reliable part; absolute win rates depend on how sharp the group is ("read skill").

## Findings

- **With no powers, the official 5–10 table is close to even at middling skill:** 55/53/52/51/50/51% good wins.
  - Small games lean slightly good.
  - Big games swing hard with group skill: at 15 players good wins 22% at low skill and 62% at high skill.
- **Power values:**

  | Power | Effect on good win rate |
  |---|---|
  | Percival | +9.6pp at 5–10 players, +5.3pp at 11+ |
  | Morgana | −4pp |
  | Mordred | about 0 (evil wins more chapters, but the Assassin's hit rate falls) |
  | Oberon | −11pp at 5–10 players, −16pp at 11+ (good loses its vote-reading signal) |
  | Spy | about +5pp, with no extra boost below 7 players |

- **The "Full" preset at 10–15 players leaned evil** (38–45% good) because Oberon is allowed from 10.
- **The house table at 15 (9 good / 6 evil) leaned evil** by 5–13pp compared with the 10-player game.

## What changed

- **Balance meter:**
  - Percival +4 (+2 at 11+)
  - Morgana −2
  - Mordred 0
  - Oberon −2 / −5 / −6 at ≤6 / 7–9 / 10+ players
  - Spy +2
  - Base offsets +2 / +1 / +1 at 5 / 6 / 7 players

  The fit error dropped from 8.5 to 2.2 points of win rate.
- **House table:**
  - 14 players now use teams 4/4/5/5/6.
  - 15 players are now 10 good / 5 evil, also with teams 4/4/5/5/6. Both now play like the official 10-player game.
- **Warnings:** Oberon at 7+ players warns that it helps evil a lot. The Spy warning just repeats the rulebook's 7+ advice.
- **Engine:** a vote record containing anyone who isn't seated is now rejected.
