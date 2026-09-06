# Burraco 🃏

Il gioco di carte italiano **Burraco** come **PWA** (Progressive Web App), con
**bot** per giocare offline e **multiplayer online** in tempo reale.

- 🤖 **Contro il Bot** — gioco completo che funziona anche **offline** (tutta la
  logica gira nel browser).
- 🌐 **Online** — partita rapida con abbinamento automatico o **stanza privata**
  con codice da condividere con un amico.
- 📱 **PWA installabile** — aggiungi alla schermata home, schermo intero, icona
  dedicata, service worker per la cache.
- 👤 **Account senza email** — un'identità anonima (id generato localmente + un
  nickname) salvata sul dispositivo. Nessuna email, nessuna password.

## Come si gioca (versione 2 giocatori)

- 2 mazzi da 54 carte (108 carte totali, 4 jolly).
- 11 carte a testa, 2 pozzetti da 11, un tallone e la pila degli scarti.
- Ad ogni turno: **peschi** (dal tallone o prendendo tutti gli scarti),
  **combini** (scale dello stesso seme o tris/poker dello stesso valore, con al
  massimo una "matta" per combinazione — jolly o 2), poi **scarti** una carta.
- Un **burraco** è una combinazione di 7+ carte (200 pt se pulito, 100 se sporco).
- Per **chiudere** servono il pozzetto già preso e almeno un burraco.
- Vince chi raggiunge per primo **2005 punti**.

Il regolamento completo è disponibile nell'app (pulsante *Come si gioca*).

## Tecnologia

- **Client**: React + Vite, PWA con `vite-plugin-pwa`.
- **Server**: Node.js + Express + Socket.IO (stato di gioco autoritativo).
- **Motore di gioco**: ESM puro condiviso tra client e server
  (`src/engine/`), con bot euristico (`src/engine/bot.js`).

Il motore è lo stesso in locale e online: in modalità *contro il bot* gira
interamente nel browser; online il server è autoritativo e, se un giocatore si
disconnette, un bot ne prende il posto per non bloccare la partita.

## Avvio in locale

```bash
npm install

# Sviluppo (client su :5173 con proxy, server su :3001)
npm run dev

# Build di produzione + avvio del server che serve la PWA
npm run build
npm start          # http://localhost:3001
```

La porta del server è configurabile con la variabile d'ambiente `PORT`.

## Struttura del progetto

```
src/
  engine/          # motore di gioco condiviso (carte, regole, stato, bot)
    cards.js       # mazzo, valori, utilità
    rules.js       # validazione combinazioni e punteggi
    engine.js      # macchina a stati della partita
    bot.js         # IA euristica
  game/            # controller per client
    LocalController.js   # partita locale vs bot (offline)
    OnlineController.js   # partita online via Socket.IO
  ui/              # componenti React (tavolo, carte, regole)
  App.jsx          # menu, lobby online, navigazione
  profile.js       # identità anonima locale (senza email)
server/
  index.js         # Express + Socket.IO, matchmaking, stanze, stats
public/icons/      # icone PWA
```

## Deploy

Il progetto ha due parti: la **PWA statica** (client) e il **server online**
(Node + Socket.IO, processo sempre attivo con WebSocket). Il gioco *contro il
bot* è tutto lato client; il gioco *online* richiede il server.

### Opzione consigliata — Solo Render (tutto-in-uno)
Il server Node serve anche la PWA, quindi basta **un unico servizio**. È incluso
`render.yaml`: crea un "Web Service" da questo repo (build `npm install && npm run
build`, start `npm start`). Non impostare `VITE_SERVER_URL` (il client usa la
stessa origine).

### Solo Netlify — solo gioco contro il Bot
Netlify **non** può ospitare il server online (niente WebSocket persistenti). Va
benissimo se vuoi solo la modalità offline: è incluso `netlify.toml` (build
`npm run build`, publish `dist`).

### Netlify + Render — client su Netlify, server su Render
1. Deploy del server su Render (come sopra).
2. Su Netlify imposta la variabile di build `VITE_SERVER_URL` con l'URL del
   server Render, es. `https://burraco.onrender.com`.
3. Il client si collegherà al Socket.IO su Render (il server accetta già le
   connessioni cross-origin).

### Locale
```bash
npm ci
npm run build
PORT=8080 npm start   # http://localhost:8080
```
