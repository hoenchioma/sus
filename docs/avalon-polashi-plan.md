# Avalon / Polashi — design plan

Design for Sus's second game: an Avalon-style quest game with two skins, **Polashi** (Bangladeshi re-theme by Playground Inc., Nawab vs East India Company) and **Avalon**. The rules come from the official Polashi rulebook. The engine pattern follows the shared Sus engine (setup + ordered steps, replay, cursor, rule definitions); file names will be aligned once the Mafia engine lands.


## 1. Overview and scope (v1)
- **One "quest" engine, two skins (Avalon and Polashi), both in v1.** The skins differ only in names, terms, art, text and audio.
- **Both modes ship together:** Mode 1 (one phone) and Mode 2 (everyone's phone, plus an optional TV).
- **Included in v1:**
  - the base game;
  - all 4 optional powers;
  - the Spy (গুপ্তচর) for Polashi, which plays as Lady of the Lake in the Avalon skin.
- **11–15 players** ship in v1, marked experimental (§2b).

## 2. Rules (from the official Polashi rulebook, identical to Avalon)
- **Sides by player count (5–10):**
  - Nawab: 3, 4, 4, 5, 6, 6. মীর মদন (Mir Madan) is always one of them.
  - EIC: 2, 2, 3, 3, 3, 4. মীর জাফর (Mir Jafar) is always one of them.
- **Chapter team sizes:**

  | Players | Ch1 | Ch2 | Ch3 | Ch4 | Ch5 |
  |---|---|---|---|---|---|
  | 5 | 2 | 3 | 2 | 3 | 3 |
  | 6 | 2 | 3 | 4 | 3 | 4 |
  | 7 | 2 | 3 | 3 | 4★ | 4 |
  | 8–10 | 3 | 4 | 4 | 5★ | 5 |

  ★ means EIC needs 2 Betrayal (বিশ্বাসঘাতক) cards to win that chapter.
- **Proposals:** the Commander (সেনাপতি) proposes a team and may include themself.
- **Voting:** everyone votes at once, the Commander included. A team passes only with strictly more Yes than No. If it's rejected, the player to the Commander's left becomes Commander. 5 rejected teams in a row within the same chapter means EIC wins.
- **Chapter cards:** Nawab players must play Success. EIC players may play Success or Betrayal. One Betrayal makes EIC win the chapter (two on a ★ chapter). After every chapter, the Commander passes left.
- **End of game:** the game ends as soon as one side has won 3 chapters. If that side is the Nawab, EIC discuss among themselves, then Mir Jafar points at one Nawab-side player. If that player is Mir Madan, EIC wins.
- **Spy:**
  - Starts with the player to the right of the first Commander.
  - Used after chapters 2, 3 and 4: the Spy inspects one player, who always shows their true side.
  - The Spy may say anything about what they saw, but can never show the card.
  - The inspected player becomes the next Spy. Nobody who has already been Spy can be inspected.

## 2b. 11–15 players (experimental house rule)
Neither Avalon nor Polashi has official rules above 10 players; the only examples found are fan apps. This table is our own, built on the official game's patterns:
- traitors make up about 35–40% of the table;
- teams cover 40–55% of the players;
- bigger teams get more 2-Betrayal (★) chapters;
- the 5-rejection limit stays.

| Players | Nawab / EIC | Ch1 | Ch2 | Ch3 | Ch4 | Ch5 |
|---|---|---|---|---|---|---|
| 11 | 7 / 4 | 3 | 4 | 4 | 5★ | 5 |
| 12 | 7 / 5 | 3 | 4 | 4 | 5★ | 6★ |
| 13 | 8 / 5 | 4 | 4 | 5 | 6★ | 6★ |
| 14 | 9 / 5 | 4 | 5 | 5 | 6★ | 6★ |
| 15 | 9 / 6 | 4 | 5 | 5★ | 6★ | 7★ |

- **Same table for both skins.** It's plain data, so it can be tuned after playtests.
- **Warning:** the setup screen says "Unofficial: 11+ players is a house rule".
- **Suggestions:** at 11+ players, setup suggests turning on the Spy and discussion timers.
- **Balance meter:** each new player count gets its own starting value.

## 3. Characters (Polashi skin; Avalon equivalents)
| Side | Character | Avalon | Power |
|---|---|---|---|
| Nawab | মীর মদন Mir Madan | Merlin | Always on: sees all EIC except Ray Durlov (Umichad included) |
| Nawab | মোহন লাল Mohon Lal | Percival | Optional: sees Mir Madan, plus Ghoseti Begum as a second candidate |
| Nawab | নবাব সিরাজউদ্দৌলা, লুৎফুন্নেসা, দেবুসি (De Busi), সেন্ট ফ্রে (Saint Frey) | Loyal Servants | None |
| EIC | মীর জাফর Mir Jafar | Assassin | Always on: makes the final guess |
| EIC | ঘষেটি বেগম Ghoseti Begum | Morgana | Optional: appears as Mir Madan to Mohon Lal |
| EIC | রায় দুর্লভ Ray Durlov | Mordred | Optional: hidden from Mir Madan |
| EIC | উমিচাঁদ Umichad | Oberon | Optional: doesn't know the other EIC, and they don't know him |

**Dealing**
- **Powers on:** a character whose power is on is always dealt. Remaining seats are filled at random from that side's other cards.
- **Polashi with a power off:** that character can still be dealt as a plain card. The 10 cards cover 10 players exactly.
- **Avalon with a power off:** that card isn't dealt at all. The plain cards are 5 Loyal Servants and 3 Minions.
- **Skin flag:** each character's skin data has a flag saying which of these two behaviours applies.

**Extra plain cards for 11–15 players (Polashi)**
- **Nawab:** বাহাদুর আলী খান (Bahadur Ali Khan) and নৌবে সিং হাজারী (Naub Singh Hazari), commanders who fought beside Mir Madan, plus one more Nawab figure still to be picked.
- **EIC:** রবার্ট ক্লাইভ (Robert Clive) and জগৎ শেঠ (Jagat Seth).
- **Status:** these names are proposals for the user to confirm, including their Bangla spellings.
- **Dealing:** these cards only enter the pool once the original 10 run out.
- **Avalon:** simply uses more generic Servants and Minions.

## 4. Engine fit
Engine files live under `packages/engine/src/games/quest/`:

| File | Holds |
|---|---|
| `tables.ts` | Side sizes, chapter sizes, ★ chapters (shared by both skins) |
| `roles.ts` | Role IDs, sides, mandatory and optional powers |
| `knowledge.ts` | Pure function: (deal, powers) → what each player sees. Drives both the Mode 2 reveal and the Mode 1 script |
| `steps.ts` | The step types below |
| `derive.ts` | Replay to state: Commander, rejection count, chapter results, Spy holder and past Spies, phase, winner |
| `rules.ts` | House-rule definitions (§6) |
| `balance.ts` | Balance meter (§6) |
| `script.ts` | Ordered ritual lines with conditions for each optional power |

**Steps**
- `Deal`
- `Propose(commander, team)`
- `Vote(perPlayer)`
- `ChapterResult(perPlayerCards)`
- `SpyCheck(spy, target)`
- `Guess(target)`

Validation rejects illegal steps: wrong team size, a Nawab player playing Betrayal, inspecting a past Spy.

**Skins**
- Skins live in `apps/web/src/skins/{polashi,avalon}/`. Each holds names and terms per language, SVG art, audio clip maps, and the plain-when-off flag.
- The engine never holds display text.

**Mode 2 server**
- The Durable Object holds the full state.
- Each phone gets a per-player view built by `knowledge.ts`, plus the public state.
- The TV gets only the public view.

## 5. Modes
**Mode 1 (one phone; the app always deals)**
1. Each player takes the phone and privately sees their character and its power text.
2. The host runs the eyes-closed ritual from the app's script.
   - The rulebook's base and advanced scripts are used, with lines for disabled powers dropped.
   - Narration audio is optional, so the reader can keep their own eyes closed. Pauses are adjustable.
3. For chapter cards, the phone is passed to each team member. The Nawab screen looks identical but only allows Success. The app shows only the counts.
4. Spy checks are done by passing the phone.
5. Votes are shown by hand at the table, and the host taps them into a per-player grid.

Mode 1 also has a full back/forward/edit cursor. Editing a secret step asks for it to be entered again; it doesn't show the old choices.

**Mode 2 (everyone's phone, optional TV)**
- **Lobby:** players join with a code. The host drags them into seating order (this matters for left/right passing) and sets powers, the Spy and presets.
- **No ritual:** each phone shows the player's role and what they know, behind a hold-to-view screen.
- **Each chapter:**
  1. The Commander picks the team on their phone and calls the vote.
  2. Everyone votes secretly; when all are in, the votes are revealed at once.
  3. Team members play their cards.
  4. The TV reveals the cards.
- **Spy:** the check happens on the Spy's phone, and the TV announces it.
- **End:** EIC are revealed to each other, and Mir Jafar picks on his phone.
- **Game over:** all roles are revealed, plus a timeline.
- **Host controls:** the host can pause and undo the last public step only.
- **Without a TV:** phones show a compact board between private actions.

## 6. House rules and balance
| Rule | Default | Lock / warning |
|---|---|---|
| মোহন লাল (Mohon Lal) power | Off | — |
| ঘষেটি বেগম (Ghoseti Begum) power | Off | Locked unless Mohon Lal is on ("only fools Mohon Lal") |
| রায় দুর্লভ (Ray Durlov) power | Off | Locked when EIC seats run out (see below) |
| উমিচাঁদ (Umichad) power | Off | Same seat lock as Ray Durlov. Warns at 5–6 players |
| গুপ্তচর (Spy) | Off | Warns below 7 players: "rulebook recommends 7+, strongly helps the Nawab side" |
| First Commander | Random | Or the host chooses |
| Anonymous votes | Off | — |
| Discussion timers | Off | When on, proposal and EIC-discussion durations appear |
| Narration audio | On | Mode 1 only |

- **EIC seat limits:** extra EIC powers (Ghoseti, Ray Durlov, Umichad) are capped at 1 for 5–6 players, 2 for 7–9 and 3 for 10–15. The lock reason names the conflict.
- **No hammer variant:** the rulebook's 5-rejection loss stays as written.
- **Presets:**
  - First game: no powers.
  - Classic: Mohon Lal and Ghoseti Begum.
  - Full: everything the player count allows.
- **Balance weights** (to tune after playtests):
  - Mohon Lal: +2 Nawab.
  - Ghoseti Begum: +2 EIC.
  - Ray Durlov: +2 EIC.
  - Umichad: +1 Nawab.
  - Spy: +2 Nawab, plus 1 more below 7 players.
  - Per-player-count base: 0 for now.

## 7. TV and audio
**The board**
- A stylised Polashi battlefield map with 5 chapter tiles, each showing its size and ★.
- A seat ring showing the Commander crest, team tokens, the Spy badge and past-Spy marks.
- A rejection track (1–5).
- Only the latest vote is shown; there's no vote history.

**Reveals**
- **Votes:** all flip at once.
- **Chapter cards:** they flip one by one with rising tension, while the team's faces show above the shuffled cards. The map tile then stamps green or red.
- **Spy:** "X checked Y", without the result.
- **Last chance:** the EIC seats glow, "Mir Jafar is choosing…", then a spotlight reveal.

**Audio**
- Plays from the TV, or the host phone if there's no TV. In Mode 1 it plays from the one phone.
- **Sound effects only, no music:** flips, a chime, a sting, a stamp, a thud.
- **Narration:** Polashi in Bangla and English (following the host/TV language); Avalon in English. No player names are spoken.
- **The ritual** is built from per-line clips, with a variant for each power combination.
- **Phase announcements:** chapter start, new Commander, time to vote, team approved or rejected, chapter won, Spy checking, last chance, and the win lines.

## 8. Bangla / i18n
- **No i18n library.** Typed `en.ts` / `bn.ts` dictionaries, so a missing key is a type error, plus a small `t(key, vars)` helper.
- **Skin terms slot into shared screens.** Polashi terms: সেনাপতি (Commander), অধ্যায় (Chapter), বিশ্বাসঘাতক (Betrayal), সফল (Success), দল টোকেন (team token), গুপ্তচর (Spy).
- **Bangla is Polashi-only.** The EN/বাং toggle appears only with the Polashi skin (default বাং) and covers every screen in a Polashi game. Mafia stays English.
- **Mode 2:** each phone picks its own language; the TV follows the host.
- **Numbers** use `Intl.NumberFormat('bn-BD')`, which gives Bangla digits.
- **Tone** follows the rulebook: EIC, Character and loyalty stay in English.
- **Fonts:** Baloo Da 2 for the UI plus a decorative Bangla font for titles, both self-hosted so they work offline.

## 9. Art brief
All characters use the Kurzgesagt template: a rounded body, big simple eyes, one signature colour and one prop. Polashi adds Mughal-gold trim, and every card has a side crest (green Nawab emblem or red Company seal).

**Polashi characters**

| Character | Colour | Prop |
|---|---|---|
| Mir Madan | Emerald | Plumed turban and talwar |
| Mohon Lal | Teal | Lantern |
| Nawab Siraj-ud-Daulah | Green and gold | Sarpech and pearls |
| Lutfunnesa | Jade | Veil and letter |
| De Busi | French blue | Tricorn and map |
| Saint Frey | Slate blue | Tricorn and cannon |
| Mir Jafar | Crimson and gold | Hidden dagger |
| Ghoseti Begum | Magenta | Mask on a stick |
| Ray Durlov | Maroon | Hooded shawl, in shadow |
| Umichad | Amber red | Coin purse and goblet, wobbly pose |

**Pieces:** Commander crest with quill, crossed-musket team tokens, Yes/No vote tokens, flag cards, map tiles and loyalty cards.

**Avalon:**
- Merlin, Percival, Assassin, Morgana, Mordred, Oberon.
- Generic Servants ×5 and Minions ×3.
- The Lady of the Lake token.

**Seats** use neutral initial avatars, so the board never hints at roles.

## 10. Deferred and open items
- Per-player-count balance base values, including 11–15.
- Confirm the extra Polashi names (one more Nawab figure still to pick) and their art.
- Narration clip recording list, to be finalised with the script text.
- Align file names with the real engine once `mode-1` lands.

## Test checklist (for implementation)

- **Knowledge:** the knowledge matrix for every combination of powers.
- **Locks:** seat-limit locks at 5, 6, 7 and 10 players, and the Ghoseti lock.
- **11–15 players:** side sizes, chapter sizes and ★ chapters from the experimental table, and that dealing uses the extra cards only once the original 10 have run out.
- **Chapters:** 2-Betrayal ★ chapters.
- **Rejections:** the 5th rejection, and that the counter resets each chapter.
- **Commander:** rotation, including after a chapter.
- **Spy:** right-of-Commander start, no re-checking a past Spy, and only 3 checks.
- **End guess:** a correct and a wrong guess.
- **Validation:** a Nawab Betrayal is rejected.
