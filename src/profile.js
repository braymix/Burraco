// Anonymous local identity: a random userId + a chosen nickname, stored locally.
// No email, no password - the userId is the account.

const KEY = 'burraco.profile';

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'u-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const FUN_NAMES = [
  'Assopigliatutto', 'Pinella', 'Jolly', 'Scala Reale', 'Burracone',
  'Mazziere', 'Pozzetto', 'Tris', 'Poker', 'Mano Fortunata',
];

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
    name: FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)],
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
