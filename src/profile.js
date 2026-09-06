// Anonymous local identity: a random userId + a chosen nickname, stored locally.
// No email, no password - the userId is the account.

const KEY = 'burraco.profile';

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'u-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Random funny "first name + surname" nicknames, Burraco/luck themed.
const FIRST_NAMES = [
  'Mano', 'Freddy', 'Gina', 'Nando', 'Pina', 'Bruno', 'Gigi', 'Rosa',
  'Tonino', 'Ciro', 'Lella', 'Beppe', 'Sandra', 'Mimmo', 'Rocco', 'Vale',
  'Nino', 'Carmela', 'Peppe', 'Ivana', 'Dario', 'Ornella', 'Saro', 'Gustavo',
  'Lady', 'Don', 'Zia', 'Zio', 'Cummenda', 'Miss',
];
const SURNAMES = [
  'Fortunato', 'Pigliatutto', 'Pinella', 'Jolly', 'Asso', 'Pozzetto',
  'Mazziere', 'Scartini', 'Prenditutto', 'Buttalà', 'Calacarte', 'Bluff',
  'Scala Reale', 'Burracone', 'Occhiodilince', 'Manolesta', 'Vincitore',
  'Sbagliacarte', 'Tris', 'Poker', 'Sette Bello', 'Chiudetutto',
  'Rubascarti', 'Contapunti', 'Matta', 'Baro Gentile',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(SURNAMES)}`;
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.userId && p.name) return p;
    }
  } catch { /* ignore */ }
  const profile = {
    userId: randomId(),
    name: randomName(),
  };
  saveProfile(profile);
  return profile;
}

export function saveProfile(profile) {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* ignore */ }
  return profile;
}

export function setName(name) {
  const p = loadProfile();
  p.name = (name || '').trim().slice(0, 20) || p.name;
  return saveProfile(p);
}

// ---- Settings (match length, etc.) ----
const SETTINGS_KEY = 'burraco.settings';

// Available match lengths (points to win). x005 keeps ties impossible-ish.
export const TARGET_PRESETS = [
  { value: 505, label: 'Lampo', hint: '~1-2 mani' },
  { value: 1005, label: 'Veloce', hint: '~3-4 mani' },
  { value: 2005, label: 'Classica', hint: 'partita piena' },
  { value: 3005, label: 'Lunga', hint: 'per i maratoneti' },
];

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.targetScore === 'number') return { targetScore: s.targetScore };
    }
  } catch { /* ignore */ }
  return { targetScore: 2005 };
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  return settings;
}

export function setTargetScore(value) {
  const s = loadSettings();
  s.targetScore = value;
  return saveSettings(s);
}
