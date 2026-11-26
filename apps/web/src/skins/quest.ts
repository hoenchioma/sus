import type { quest } from '@sus/engine';

export type QuestSkinId = quest.QuestSkinId;
export type Lang = 'en' | 'bn';
type Side = quest.Side;
type QuestRole = quest.QuestRole;

interface CardText {
  en: string;
  bn: string;
}

/** Card faces: named Polashi characters plus Avalon's generic roles. */
export const CARD_NAMES: Record<string, CardText> = {
  mirMadan: { en: 'Mir Madan', bn: 'মীর মদন' },
  mohonLal: { en: 'Mohon Lal', bn: 'মোহন লাল' },
  siraj: { en: 'Nawab Siraj-ud-Daulah', bn: 'নবাব সিরাজউদ্দৌলা' },
  lutfunnesa: { en: 'Lutfunnesa', bn: 'লুৎফুন্নেসা' },
  deBusi: { en: 'De Busi', bn: 'দেবুসি' },
  saintFrey: { en: 'Saint Frey', bn: 'সেন্ট ফ্রে' },
  mirJafar: { en: 'Mir Jafar', bn: 'মীর জাফর' },
  ghoseti: { en: 'Ghoseti Begum', bn: 'ঘষেটি বেগম' },
  rayDurlov: { en: 'Ray Durlov', bn: 'রায় দুর্লভ' },
  umichad: { en: 'Umichad', bn: 'উমিচাঁদ' },
  bahadurAliKhan: { en: 'Bahadur Ali Khan', bn: 'বাহাদুর আলী খান' },
  aminaBegum: { en: 'Amina Begum', bn: 'আমিনা বেগম' },
  raniBhabani: { en: 'Rani Bhabani', bn: 'রানী ভবানী' },
  jeanLaw: { en: "Jean Law", bn: "জাঁ ল'" },
  robertClive: { en: 'Robert Clive', bn: 'রবার্ট ক্লাইভ' },
  jagatSeth: { en: 'Jagat Seth', bn: 'জগৎ শেঠ' },
  merlin: { en: 'Merlin', bn: 'Merlin' },
  percival: { en: 'Percival', bn: 'Percival' },
  servant: { en: 'Loyal Servant', bn: 'Loyal Servant' },
  assassin: { en: 'Assassin', bn: 'Assassin' },
  morgana: { en: 'Morgana', bn: 'Morgana' },
  mordred: { en: 'Mordred', bn: 'Mordred' },
  oberon: { en: 'Oberon', bn: 'Oberon' },
  minion: { en: 'Minion of Mordred', bn: 'Minion of Mordred' },
};

export interface QuestTerms {
  game: string;
  sides: Record<Side, string>;
  commander: string;
  chapter: string;
  chapters: string;
  success: string;
  betrayal: string;
  spy: string;
  guesser: string;
  /** Character name that holds each power in this skin. */
  roleNames: Record<QuestRole, string>;
  powers: Record<QuestRole, string>;
}

const polashiEn: QuestTerms = {
  game: 'Polashi',
  sides: { good: 'Nawab', evil: 'EIC' },
  commander: 'Commander',
  chapter: 'Chapter',
  chapters: 'Chapters',
  success: 'Success',
  betrayal: 'Betrayal',
  spy: 'Spy',
  guesser: 'Mir Jafar',
  roleNames: {
    merlin: 'Mir Madan',
    percival: 'Mohon Lal',
    servant: "Nawab's loyalist",
    assassin: 'Mir Jafar',
    morgana: 'Ghoseti Begum',
    mordred: 'Ray Durlov',
    oberon: 'Umichad',
    minion: 'EIC conspirator',
  },
  powers: {
    merlin: 'You know who the EIC are (except Ray Durlov). Guide the Nawab without being found out: if the Nawab win, Mir Jafar gets one guess at you.',
    percival: 'You see Mir Madan, but Ghoseti Begum may look the same. Protect the real Mir Madan.',
    servant: 'No special power. Read the room and keep the EIC off the battlefield.',
    assassin: 'You and the EIC know each other. If the Nawab win three chapters, you point at Mir Madan; get it right and the EIC win.',
    morgana: 'You appear as Mir Madan to Mohon Lal. Sow doubt.',
    mordred: "Mir Madan can't see you. Hide in plain sight.",
    oberon: "You're on the EIC side, but you don't know them and they don't know you.",
    minion: 'You and the EIC know each other. Slip a Betrayal into the chapters.',
  },
};

const polashiBn: QuestTerms = {
  game: 'পলাশী',
  sides: { good: 'নবাব', evil: 'EIC' },
  commander: 'সেনাপতি',
  chapter: 'অধ্যায়',
  chapters: 'অধ্যায়',
  success: 'সফল',
  betrayal: 'বিশ্বাসঘাতক',
  spy: 'গুপ্তচর',
  guesser: 'মীর জাফর',
  roleNames: {
    merlin: 'মীর মদন',
    percival: 'মোহন লাল',
    servant: 'নবাবের অনুগত',
    assassin: 'মীর জাফর',
    morgana: 'ঘষেটি বেগম',
    mordred: 'রায় দুর্লভ',
    oberon: 'উমিচাঁদ',
    minion: 'EIC ষড়যন্ত্রকারী',
  },
  powers: {
    merlin: 'আপনি জানেন কারা EIC (রায় দুর্লভ ছাড়া)। ধরা না পড়ে নবাবের দলকে পথ দেখান: নবাব জিতলে মীর জাফর একবার আপনাকে খুঁজে বের করার চেষ্টা করবে।',
    percival: 'আপনি মীর মদনকে দেখতে পান, কিন্তু ঘষেটি বেগমকেও একই রকম দেখাতে পারে। আসল মীর মদনকে রক্ষা করুন।',
    servant: 'কোনো বিশেষ ক্ষমতা নেই। সবাইকে বুঝে নিন আর EIC-কে যুদ্ধক্ষেত্র থেকে দূরে রাখুন।',
    assassin: 'আপনি আর EIC একে অপরকে চেনেন। নবাব তিনটি অধ্যায় জিতলে আপনি মীর মদনকে দেখিয়ে দেবেন; ঠিক হলে EIC জিতবে।',
    morgana: 'মোহন লালের চোখে আপনাকে মীর মদনের মতো দেখায়। সন্দেহ ছড়ান।',
    mordred: 'মীর মদন আপনাকে দেখতে পান না। সবার সামনেই লুকিয়ে থাকুন।',
    oberon: 'আপনি EIC-র পক্ষে, কিন্তু আপনি তাদের চেনেন না, তারাও আপনাকে চেনে না।',
    minion: 'আপনি আর EIC একে অপরকে চেনেন। অধ্যায়ে চুপিচুপি বিশ্বাসঘাতক কার্ড দিন।',
  },
};

const avalonEn: QuestTerms = {
  game: 'Avalon',
  sides: { good: 'Loyal Servants', evil: 'Minions of Mordred' },
  commander: 'Leader',
  chapter: 'Quest',
  chapters: 'Quests',
  success: 'Success',
  betrayal: 'Fail',
  spy: 'Lady of the Lake',
  guesser: 'the Assassin',
  roleNames: {
    merlin: 'Merlin',
    percival: 'Percival',
    servant: 'Loyal Servant of Arthur',
    assassin: 'Assassin',
    morgana: 'Morgana',
    mordred: 'Mordred',
    oberon: 'Oberon',
    minion: 'Minion of Mordred',
  },
  powers: {
    merlin: 'You know the Minions of Mordred (except Mordred). Guide the good side without revealing yourself: if good wins, the Assassin gets one guess at you.',
    percival: 'You see Merlin, but Morgana may look the same. Protect the real Merlin.',
    servant: 'No special power. Work out who to trust and keep evil off the quests.',
    assassin: 'You know your fellow Minions. If good completes three quests, name Merlin; get it right and evil wins.',
    morgana: 'You appear as Merlin to Percival. Sow confusion.',
    mordred: "Merlin can't see you. Hide in plain sight.",
    oberon: "You're evil, but you don't know the other Minions and they don't know you.",
    minion: 'You know your fellow Minions. Slip a Fail into the quests.',
  },
};

export function questTerms(skin: QuestSkinId, lang: Lang): QuestTerms {
  if (skin === 'avalon') return avalonEn;
  return lang === 'bn' ? polashiBn : polashiEn;
}

export const cardName = (card: string | undefined, lang: Lang) => (card ? (CARD_NAMES[card]?.[lang] ?? card) : '');

/** Interface strings. Keys are shared; Bangla is only used with the Polashi skin. */
export interface UiText {
  hostGame: string;
  join: string;
  players: string;
  start: string;
  dealRoles: string;
  needPlayers: (n: number) => string;
  holdToSee: string;
  gotIt: string;
  waitingForOthers: string;
  yourSide: string;
  youKnow: Record<'evil' | 'merlinCandidates' | 'team', string>;
  knowNothing: string;
  proposeTeam: (n: number) => string;
  proposing: (commander: string, n: number) => string;
  proposeButton: string;
  approve: string;
  reject: string;
  voteOnTeam: string;
  votesIn: (n: number, of: number) => string;
  teamApproved: string;
  teamRejected: string;
  playCard: string;
  onTeamWaiting: string;
  goodOnlySuccess: string;
  spyPick: string;
  spyWaiting: (spy: string) => string;
  spyResult: (target: string, side: string) => string;
  spyChecked: (spy: string, target: string) => string;
  lastChance: (guesser: string) => string;
  guessPrompt: string;
  rejections: string;
  twoNeeded: string;
  wins: Record<Side, string>;
  reason: Record<'chapters' | 'rejections' | 'guessed' | 'missed', (guesser: string, target: string) => string>;
  endedByHost: string;
  playAgain: string;
  back: string;
  next: string;
  undo: string;
  skipWaiting: string;
  pause: string;
  resume: string;
  endGame: string;
  leave: string;
  powers: string;
  preset: Record<'first' | 'classic' | 'full', string>;
  rule: Record<string, string>;
  experimental: string;
  ladySmall: string;
  oberonStrong: string;
  ritual: string;
  ritualLines: Record<string, string>;
  passTo: (name: string) => string;
  onlyThem: (name: string) => string;
  done: string;
  team: string;
  everyone: string;
  language: string;
  timer: string;
  off: string;
  random: string;
  hostPicks: string;
  firstCommander: string;
  cues: Record<string, string>;
  locked: string;
  secs: (n: number) => string;
  mins: (n: number) => string;
  host: string;
  rejoinCode: string;
  rejoinHint: string;
  useRejoinCode: string;
  joinNew: string;
  yourName: string;
  playerName: string;
  tvHint: string;
  seatingNote: string;
  newHost: (name: string) => string;
  undone: string;
  roomMissing: (code: string) => string;
  quotaTitle: string;
  quotaBody: (time: string) => string;
  quotaBanner: (time: string) => string;
  onePhone: string;
  home: string;
}

const en: UiText = {
  hostGame: 'Host',
  join: 'Join',
  players: 'Players',
  start: 'Start',
  dealRoles: 'Deal characters',
  needPlayers: (n) => `Need at least ${n} players`,
  holdToSee: 'Hold to see your character',
  gotIt: 'Got it',
  waitingForOthers: 'Waiting for everyone…',
  yourSide: 'Your side',
  youKnow: { evil: 'These players are on the other side:', merlinCandidates: 'One of these is your protected ally:', team: 'Your side:' },
  knowNothing: "You don't know anyone's loyalty.",
  proposeTeam: (n) => `Choose ${n} players for the team`,
  proposing: (c, n) => `${c} is choosing a team of ${n}`,
  proposeButton: 'Propose this team',
  approve: 'Approve',
  reject: 'Reject',
  voteOnTeam: 'Vote on the team',
  votesIn: (n, of) => `${n} of ${of} voted`,
  teamApproved: 'Team approved',
  teamRejected: 'Team rejected',
  playCard: 'Play your card in secret',
  onTeamWaiting: 'The team is playing their cards…',
  goodOnlySuccess: 'Your side can only play Success.',
  spyPick: 'Choose someone to inspect',
  spyWaiting: (s) => `${s} is inspecting someone…`,
  spyResult: (t, side) => `${t} is on the ${side} side.`,
  spyChecked: (s, t) => `${s} inspected ${t}`,
  lastChance: (g) => `Last chance: ${g} is choosing…`,
  guessPrompt: 'Who is protected by the other side? Point them out.',
  rejections: 'Rejected teams',
  twoNeeded: '2 needed',
  wins: { good: 'wins', evil: 'wins' },
  reason: {
    chapters: () => 'Three chapters fell.',
    rejections: () => 'Five teams in a row were rejected.',
    guessed: (g, t) => `${g} found ${t}.`,
    missed: (g, t) => `${g} pointed at ${t} and missed.`,
  },
  endedByHost: 'The host ended the game',
  playAgain: 'Play again with this room',
  back: 'Back',
  next: 'Next',
  undo: 'Undo last step',
  skipWaiting: 'Skip waiting',
  pause: 'Pause',
  resume: 'Resume',
  endGame: 'End game',
  leave: 'Leave room',
  powers: 'Characters and powers',
  preset: { first: 'First game', classic: 'Classic', full: 'Full' },
  rule: { percival: 'Percival', morgana: 'Morgana', mordred: 'Mordred', oberon: 'Oberon', lady: 'Spy', firstCommander: 'First Commander', anonymousVotes: 'Anonymous votes' },
  experimental: 'Unofficial: more than 10 players is a house rule.',
  ladySmall: 'The rulebook recommends the Spy at 7+ players.',
  oberonStrong: 'The loner helps the evil side a lot in bigger games.',
  ritual: 'Eyes-closed ritual',
  ritualLines: {
    closeEyes: 'Everyone, close your eyes and put out your fist.',
    evilOpen: 'Evil side, open your eyes and look at each other.',
    evilOpenNotOberon: 'Evil side, except the loner, open your eyes and look at each other.',
    evilClose: 'Evil side, close your eyes.',
    evilThumbs: 'Evil side, put your thumb up.',
    evilThumbsNotMordred: 'Evil side, except the hidden one, put your thumb up.',
    merlinOpen: 'The seer of the good side, open your eyes and see the evil side.',
    merlinClose: 'Seer, close your eyes.',
    evilThumbsDown: 'Evil side, put your thumbs down.',
    merlinThumbs: 'Seer, put your thumb up.',
    merlinMorganaThumbs: 'Seer and the imposter, put your thumbs up.',
    percivalOpen: 'The protector, open your eyes and see who to protect.',
    percivalClose: 'Protector, close your eyes.',
    thumbsDown: 'Thumbs down.',
    everyoneOpen: 'Everyone, open your eyes.',
  },
  passTo: (n) => `Pass the phone to ${n}`,
  onlyThem: (n) => `Only ${n} should look.`,
  done: 'Done',
  team: 'Team',
  everyone: 'Everyone',
  language: 'Language',
  timer: 'Discussion timer',
  off: 'Off',
  random: 'Random',
  hostPicks: 'Host picks',
  firstCommander: 'First Commander',
  locked: 'Not available with these settings',
  secs: (n) => `${n}s`,
  mins: (n) => `${n} min`,
  host: 'Host',
  rejoinCode: 'Rejoin code',
  rejoinHint: 'Enter it on the new phone under "Use a rejoin code".',
  useRejoinCode: 'Already in this game? Use a rejoin code',
  joinNew: 'Join as a new player',
  yourName: 'Your name',
  playerName: 'Player name',
  tvHint: 'TV screen: open this on any big screen',
  seatingNote: 'Seating order matters: the Commander passes to the left (down this list).',
  newHost: (name) => `${name} is now the host`,
  undone: 'The host undid the last step',
  roomMissing: (code) => `Room ${code} not found`,
  quotaTitle: 'Phone games are paused',
  quotaBody: (time) => `Today's free server allowance is used up. Phone games work again at ${time}. Meanwhile you can still play on one phone.`,
  quotaBanner: (time) => `The server can't save games until ${time}. This game keeps going, but if every phone drops it may be lost.`,
  onePhone: 'Play on one phone',
  home: 'Home',
  cues: {
    newCommander: 'A new Commander chooses a team.',
    vote: 'Time to vote on the team.',
    approved: 'The team is approved.',
    rejected: 'The team is rejected.',
    chapterWon: 'The chapter is won.',
    chapterLost: 'The chapter is lost to betrayal.',
    spy: 'The Spy is investigating.',
    lastChance: 'Last chance. The traitors choose.',
    goodWins: 'The loyal side wins.',
    evilWins: 'The traitors win.',
  },
};

const bd = (n: number) => new Intl.NumberFormat('bn-BD').format(n);

const bn: UiText = {
  hostGame: 'হোস্ট',
  join: 'যোগ দিন',
  players: 'খেলোয়াড়',
  start: 'শুরু',
  dealRoles: 'চরিত্র বণ্টন করুন',
  needPlayers: (n) => `কমপক্ষে ${bd(n)} জন খেলোয়াড় দরকার`,
  holdToSee: 'আপনার চরিত্র দেখতে চেপে ধরুন',
  gotIt: 'বুঝেছি',
  waitingForOthers: 'সবার জন্য অপেক্ষা…',
  yourSide: 'আপনার পক্ষ',
  youKnow: { evil: 'এরা অন্য পক্ষের:', merlinCandidates: 'এদের একজন আপনার রক্ষা করার মিত্র:', team: 'আপনার পক্ষ:' },
  knowNothing: 'আপনি কারও আনুগত্য জানেন না।',
  proposeTeam: (n) => `দলের জন্য ${bd(n)} জনকে বেছে নিন`,
  proposing: (c, n) => `${c} ${bd(n)} জনের দল বাছাই করছেন`,
  proposeButton: 'এই দল প্রস্তাব করুন',
  approve: 'সমর্থন',
  reject: 'প্রত্যাখ্যান',
  voteOnTeam: 'দলের উপর ভোট দিন',
  votesIn: (n, of) => `${bd(of)} জনের মধ্যে ${bd(n)} জন ভোট দিয়েছেন`,
  teamApproved: 'দল অনুমোদিত',
  teamRejected: 'দল প্রত্যাখ্যাত',
  playCard: 'গোপনে আপনার কার্ড দিন',
  onTeamWaiting: 'দল কার্ড দিচ্ছে…',
  goodOnlySuccess: 'আপনার পক্ষ শুধু সফল কার্ড দিতে পারে।',
  spyPick: 'কাকে পরীক্ষা করবেন বেছে নিন',
  spyWaiting: (s) => `${s} একজনকে পরীক্ষা করছেন…`,
  spyResult: (t, side) => `${t} ${side} পক্ষের।`,
  spyChecked: (s, t) => `${s} ${t}-কে পরীক্ষা করেছেন`,
  lastChance: (g) => `শেষ সুযোগ: ${g} বাছাই করছেন…`,
  guessPrompt: 'অন্য পক্ষ কাকে রক্ষা করছে? তাকে দেখিয়ে দিন।',
  rejections: 'প্রত্যাখ্যাত দল',
  twoNeeded: '২টি লাগবে',
  wins: { good: 'জয়ী', evil: 'জয়ী' },
  reason: {
    chapters: () => 'তিনটি অধ্যায় হাতছাড়া হয়েছে।',
    rejections: () => 'পরপর পাঁচটি দল প্রত্যাখ্যাত হয়েছে।',
    guessed: (g, t) => `${g} ${t}-কে খুঁজে পেয়েছেন।`,
    missed: (g, t) => `${g} ${t}-কে দেখিয়েছেন, কিন্তু ভুল।`,
  },
  endedByHost: 'হোস্ট খেলা শেষ করেছেন',
  playAgain: 'এই রুমে আবার খেলুন',
  back: 'পেছনে',
  next: 'পরের ধাপ',
  undo: 'শেষ ধাপ বাতিল',
  skipWaiting: 'অপেক্ষা বাদ দিন',
  pause: 'বিরতি',
  resume: 'চালু করুন',
  endGame: 'খেলা শেষ',
  leave: 'রুম ছাড়ুন',
  powers: 'চরিত্র ও ক্ষমতা',
  preset: { first: 'প্রথম খেলা', classic: 'ক্লাসিক', full: 'সম্পূর্ণ' },
  rule: { percival: 'মোহন লাল', morgana: 'ঘষেটি বেগম', mordred: 'রায় দুর্লভ', oberon: 'উমিচাঁদ', lady: 'গুপ্তচর', firstCommander: 'প্রথম সেনাপতি', anonymousVotes: 'গোপন ভোট' },
  experimental: 'অনানুষ্ঠানিক: ১০ জনের বেশি খেলোয়াড় একটি ঘরোয়া নিয়ম।',
  ladySmall: 'নিয়ম বই ৭+ খেলোয়াড়ে গুপ্তচর রাখতে বলে।',
  oberonStrong: 'বড় খেলায় উমিচাঁদ EIC-কে অনেক সাহায্য করে।',
  ritual: 'চোখ বন্ধের পর্ব',
  ritualLines: {
    closeEyes: 'সবাই চোখ বন্ধ করুন আর মুঠো সামনে রাখুন।',
    evilOpen: 'EIC, চোখ খুলুন আর একে অপরকে দেখে নিন।',
    evilOpenNotOberon: 'উমিচাঁদ ছাড়া EIC, চোখ খুলুন আর একে অপরকে দেখে নিন।',
    evilClose: 'EIC, চোখ বন্ধ করুন।',
    evilThumbs: 'EIC, বুড়ো আঙুল তুলুন।',
    evilThumbsNotMordred: 'রায় দুর্লভ ছাড়া EIC, বুড়ো আঙুল তুলুন।',
    merlinOpen: 'মীর মদন, চোখ খুলুন আর EIC-কে দেখে নিন।',
    merlinClose: 'মীর মদন, চোখ বন্ধ করুন।',
    evilThumbsDown: 'EIC, আঙুল নামান।',
    merlinThumbs: 'মীর মদন, বুড়ো আঙুল তুলুন।',
    merlinMorganaThumbs: 'মীর মদন আর ঘষেটি বেগম, বুড়ো আঙুল তুলুন।',
    percivalOpen: 'মোহন লাল, চোখ খুলুন আর দেখে নিন।',
    percivalClose: 'মোহন লাল, চোখ বন্ধ করুন।',
    thumbsDown: 'আঙুল নামান।',
    everyoneOpen: 'সবাই চোখ খুলুন।',
  },
  passTo: (n) => `ফোনটি ${n}-কে দিন`,
  onlyThem: (n) => `শুধু ${n} দেখবেন।`,
  done: 'শেষ',
  team: 'দল',
  everyone: 'সবাই',
  language: 'ভাষা',
  timer: 'আলোচনার সময়',
  off: 'বন্ধ',
  random: 'এলোমেলো',
  hostPicks: 'হোস্ট বাছবেন',
  firstCommander: 'প্রথম সেনাপতি',
  locked: 'এই সেটিংসে পাওয়া যাবে না',
  secs: (n) => `${bd(n)} সেকেন্ড`,
  mins: (n) => `${bd(n)} মিনিট`,
  host: 'হোস্ট',
  rejoinCode: 'আবার যোগ দেওয়ার কোড',
  rejoinHint: 'নতুন ফোনে "আবার যোগ দেওয়ার কোড" থেকে এটি লিখুন।',
  useRejoinCode: 'আগেই এই খেলায় আছেন? আবার যোগ দেওয়ার কোড ব্যবহার করুন',
  joinNew: 'নতুন খেলোয়াড় হিসেবে যোগ দিন',
  yourName: 'আপনার নাম',
  playerName: 'খেলোয়াড়ের নাম',
  tvHint: 'টিভি স্ক্রিন: যেকোনো বড় স্ক্রিনে এটি খুলুন',
  seatingNote: 'বসার ক্রম গুরুত্বপূর্ণ: সেনাপতির দায়িত্ব বাঁ দিকে (এই তালিকার নিচের দিকে) যায়।',
  newHost: (name) => `${name} এখন হোস্ট`,
  undone: 'হোস্ট শেষ ধাপ বাতিল করেছেন',
  roomMissing: (code) => `${code} রুম পাওয়া যায়নি`,
  quotaTitle: 'ফোনে খেলা আপাতত বন্ধ',
  quotaBody: (time) => `আজকের ফ্রি সার্ভারের সীমা শেষ। ${time}-এ ফোনে খেলা আবার চালু হবে। এর মধ্যে এক ফোনে খেলা যাবে।`,
  quotaBanner: (time) => `${time} পর্যন্ত সার্ভার খেলা সেভ করতে পারবে না। খেলা চলছে, কিন্তু সবার কানেকশন কেটে গেলে খেলাটা হারিয়ে যেতে পারে।`,
  onePhone: 'এক ফোনে খেলুন',
  home: 'হোম',
  cues: {
    newCommander: 'নতুন সেনাপতি দল বাছাই করবেন।',
    vote: 'দলের উপর ভোট দেওয়ার সময়।',
    approved: 'দল অনুমোদিত হয়েছে।',
    rejected: 'দল প্রত্যাখ্যাত হয়েছে।',
    chapterWon: 'অধ্যায়ে নবাবের জয়।',
    chapterLost: 'বিশ্বাসঘাতকতায় অধ্যায় হাতছাড়া।',
    spy: 'গুপ্তচর খোঁজ নিচ্ছেন।',
    lastChance: 'শেষ সুযোগ। মীর জাফর বাছাই করছেন।',
    goodWins: 'নবাবের পক্ষ জয়ী।',
    evilWins: 'EIC জয়ী।',
  },
};

/** English ritual lines that name the actual Polashi or Avalon characters. */
const ritualEn: Record<QuestSkinId, Partial<Record<string, string>>> = {
  polashi: {
    evilOpen: 'EIC, open your eyes and look at each other.',
    evilOpenNotOberon: 'EIC, except Umichad, open your eyes and look at each other.',
    evilClose: 'EIC, close your eyes.',
    evilThumbs: 'EIC, put your thumb up.',
    evilThumbsNotMordred: 'EIC, except Ray Durlov, put your thumb up.',
    merlinOpen: 'Mir Madan, open your eyes and see the EIC.',
    merlinClose: 'Mir Madan, close your eyes.',
    evilThumbsDown: 'EIC, put your thumbs down.',
    merlinThumbs: 'Mir Madan, put your thumb up.',
    merlinMorganaThumbs: 'Mir Madan and Ghoseti Begum, put your thumbs up.',
    percivalOpen: 'Mohon Lal, open your eyes and look.',
    percivalClose: 'Mohon Lal, close your eyes.',
  },
  avalon: {
    evilOpen: 'Minions of Mordred, open your eyes and look at each other.',
    evilOpenNotOberon: 'Minions of Mordred, except Oberon, open your eyes and look at each other.',
    evilClose: 'Minions of Mordred, close your eyes.',
    evilThumbs: 'Minions of Mordred, put your thumb up.',
    evilThumbsNotMordred: 'Minions of Mordred, except Mordred himself, put your thumb up.',
    merlinOpen: 'Merlin, open your eyes and see the agents of evil.',
    merlinClose: 'Merlin, close your eyes.',
    evilThumbsDown: 'Minions of Mordred, put your thumbs down.',
    merlinThumbs: 'Merlin, put your thumb up.',
    merlinMorganaThumbs: 'Merlin and Morgana, put your thumbs up.',
    percivalOpen: 'Percival, open your eyes and look.',
    percivalClose: 'Percival, close your eyes.',
  },
};

export function uiText(skin: QuestSkinId, lang: Lang): UiText {
  if (skin === 'polashi' && lang === 'bn') return bn;
  return {
    ...en,
    // Avalon's side names are plural ("Minions of Mordred win").
    wins: skin === 'avalon' ? { good: 'win', evil: 'win' } : en.wins,
    ritualLines: { ...en.ritualLines, ...ritualEn[skin] } as Record<string, string>,
  };
}

export const formatNumber = (n: number, lang: Lang) => new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en').format(n);
