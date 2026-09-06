import React, { useEffect, useRef, useState } from 'react';
import { Card } from './Card.jsx';

// Helpers to build example cards.
const c = (suit, rank) => ({ id: `${suit}${rank}-${Math.random().toString(36).slice(2, 6)}`, suit, rank, isJoker: false });
const jolly = () => ({ id: 'J-' + Math.random().toString(36).slice(2, 6), suit: null, rank: 0, isJoker: true });

function Ex({ cards, note }) {
  return (
    <div className="rb-example">
      <div className="rb-example-cards">
        {cards.map((card) => <Card key={card.id} card={card} small />)}
      </div>
      {note && <div className="rb-example-note">{note}</div>}
    </div>
  );
}

// Each chapter: { title, icon, body }
const CHAPTERS = [
  {
    title: 'Che cos’è il Burraco',
    icon: '🃏',
    body: (
      <>
        <p>Il Burraco è un gioco di carte italiano nato dalla Canasta, molto popolare
        e appassionante. Si gioca in <b>2</b> (uno contro uno) o in <b>4</b> (due
        coppie, in diagonale).</p>
        <p>L’obiettivo di ogni mano è formare delle <b>combinazioni</b> di carte,
        realizzare almeno un <b>burraco</b> e <b>chiudere</b> per primo. Vince chi
        raggiunge il punteggio stabilito (di solito <b>2005</b> punti) sommando i
        punti di più mani.</p>
        <div className="rb-tip">Non preoccuparti: le prossime pagine ti spiegano tutto,
        passo dopo passo. 😉</div>
      </>
    ),
  },
  {
    title: 'Le carte',
    icon: '🂠',
    body: (
      <>
        <p>Si usano <b>due mazzi</b> da 54 carte, quindi <b>108 carte</b> in totale,
        <b> jolly compresi</b> (4 jolly).</p>
        <p>Le carte speciali sono le <b>matte</b>, cioè le carte che possono
        sostituire qualsiasi altra:</p>
        <ul>
          <li><b>Jolly</b> — la matta più potente.</li>
          <li><b>Pinella</b> — così si chiama il <b>2</b> quando fa da matta.</li>
        </ul>
        <Ex cards={[jolly(), c('H', 2), c('S', 2)]} note="Jolly e pinelle: le matte del gioco" />
        <div className="rb-tip">Regola d’oro: in ogni combinazione può esserci <b>una
        sola matta</b>.</div>
      </>
    ),
  },
  {
    title: 'Preparazione',
    icon: '🃏',
    body: (
      <>
        <p>Dopo aver mescolato:</p>
        <ul>
          <li>Ogni giocatore riceve <b>11 carte</b> in mano.</li>
          <li>Si formano <b>2 pozzetti</b> (mazzetti coperti) da <b>11 carte</b>.</li>
          <li>Le carte restanti formano il <b>tallone</b> (il mazzo da cui pescare).</li>
          <li>Una carta scoperta dà il via alla pila degli <b>scarti</b>.</li>
        </ul>
        <p>Nell’app trovi il tallone e gli scarti al centro del tavolo; il pozzetto
        è indicato con l’icona 🎁.</p>
      </>
    ),
  },
  {
    title: 'Il tuo turno',
    icon: '⏱️',
    body: (
      <>
        <p>Ad ogni turno fai <b>tre cose</b>, in ordine:</p>
        <ol>
          <li><b>Peschi</b>: una carta dal <b>tallone</b>, oppure prendi
          <b> tutta</b> la pila degli scarti.</li>
          <li><b>Giochi</b> (facoltativo): crei nuove combinazioni e aggiungi carte
          a quelle già in tavola.</li>
          <li><b>Scarti</b>: una carta, per passare il turno.</li>
        </ol>
        <div className="rb-tip">Prendere tutti gli scarti può essere potentissimo…
        ma ti riempie la mano: fallo solo se ne vale la pena!</div>
      </>
    ),
  },
  {
    title: 'Le combinazioni',
    icon: '🧩',
    body: (
      <>
        <p>Ci sono due tipi di combinazione, entrambe di <b>almeno 3 carte</b>:</p>
        <p><b>Scala</b> — carte dello <b>stesso seme</b> in sequenza.</p>
        <Ex cards={[c('H', 5), c('H', 6), c('H', 7), c('H', 8)]} note="Scala di cuori 5-6-7-8" />
        <p><b>Tris / Poker</b> — carte dello <b>stesso valore</b> (semi diversi).</p>
        <Ex cards={[c('C', 9), c('D', 9), c('S', 9)]} note="Tris di nove" />
        <p>L’asso può stare sia <b>basso</b> (A-2-3) sia <b>alto</b> (Q-K-A).</p>
      </>
    ),
  },
  {
    title: 'Le matte',
    icon: '⭐',
    body: (
      <>
        <p>Jolly e pinelle sostituiscono qualsiasi carta mancante, ma:</p>
        <ul>
          <li><b>Una sola matta</b> per combinazione.</li>
          <li>Un <b>2 nel suo posto naturale</b> (es. A-2-3 di cuori, o un tris di 2)
          <b> non</b> conta come matta.</li>
        </ul>
        <Ex cards={[c('S', 5), jolly(), c('S', 7)]} note="Il jolly fa da 6 di picche" />
        <Ex cards={[c('H', 1), c('H', 2), c('H', 3)]} note="Qui il 2 è naturale: non è una matta" />
        <p>Puoi anche <b>aggiungere una matta</b> a una combinazione già in tavola,
        purché non ne contenga già una.</p>
      </>
    ),
  },
  {
    title: 'Il Burraco',
    icon: '🔥',
    body: (
      <>
        <p>Il <b>burraco</b> è una combinazione di <b>7 o più carte</b>. È il cuore
        del gioco: senza almeno un burraco <b>non puoi chiudere</b>.</p>
        <Ex cards={[c('D', 3), c('D', 4), c('D', 5), c('D', 6), c('D', 7), c('D', 8), c('D', 9)]}
            note="Burraco PULITO (senza matte) = 200 punti" />
        <Ex cards={[c('C', 4), c('C', 5), jolly(), c('C', 7), c('C', 8), c('C', 9), c('C', 10)]}
            note="Burraco SPORCO (con una matta) = 100 punti" />
        <div className="rb-tip">Un burraco pulito vale il doppio: se puoi, tieni le matte
        da parte!</div>
      </>
    ),
  },
  {
    title: 'Il Pozzetto',
    icon: '🎁',
    body: (
      <>
        <p>Quando finisci <b>tutte le carte in mano</b> per la prima volta, prendi il
        <b> pozzetto</b>: 11 carte nuove che entrano nella tua mano, e continui a
        giocare.</p>
        <p>In <b>2 vs 2</b> c’è un pozzetto per <b>squadra</b>: lo prende il primo
        della coppia che rimane senza carte.</p>
        <div className="rb-tip">Attenzione: se finisci la mano <b>senza</b> aver preso
        il pozzetto, subisci una penalità di <b>-100</b> punti.</div>
      </>
    ),
  },
  {
    title: 'La chiusura',
    icon: '🔒',
    body: (
      <>
        <p>Per <b>chiudere</b> la mano (e fermarla per tutti) ti servono
        <b> contemporaneamente</b>:</p>
        <ul>
          <li>aver già preso il <b>pozzetto</b>;</li>
          <li>almeno un <b>burraco</b> sul tavolo;</li>
          <li>liberarti di tutte le carte, terminando con lo <b>scarto</b> finale.</li>
        </ul>
        <p>Chi chiude guadagna <b>+100</b> punti di bonus. La mano finisce anche se
        si esaurisce il tallone.</p>
      </>
    ),
  },
  {
    title: 'Il punteggio',
    icon: '📊',
    body: (
      <>
        <p><b>Valore delle carte</b> (in combinazione contano +, in mano a fine mano
        contano −):</p>
        <table className="rb-table">
          <tbody>
            <tr><td>Jolly</td><td>30</td></tr>
            <tr><td>Pinella (2)</td><td>20</td></tr>
            <tr><td>Asso</td><td>15</td></tr>
            <tr><td>8, 9, 10, J, Q, K</td><td>10</td></tr>
            <tr><td>3, 4, 5, 6, 7</td><td>5</td></tr>
          </tbody>
        </table>
        <p><b>Bonus e penalità</b>:</p>
        <ul>
          <li>Burraco pulito <b>+200</b>, sporco <b>+100</b>.</li>
          <li>Chiusura <b>+100</b>.</li>
          <li>Pozzetto non preso <b>−100</b>.</li>
          <li>Le carte rimaste in mano si <b>sottraggono</b>.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'In coppia (2 vs 2)',
    icon: '🤝',
    body: (
      <>
        <p>In quattro si gioca a <b>coppie</b>, sedute in diagonale. I compagni:</p>
        <ul>
          <li><b>condividono</b> le combinazioni sul tavolo;</li>
          <li>condividono pozzetto, burraco e punteggio;</li>
          <li>possono aggiungere carte alle combinazioni del compagno.</li>
        </ul>
        <p>Nel tavolo dell’app il tuo compagno ha il <b>pallino verde</b> ed è
        segnato come <b>compagno</b>; gli avversari hanno il pallino arancione.</p>
        <div className="rb-tip">Gioca di squadra: a volte conviene “servire” il
        compagno invece di pensare solo alla tua mano.</div>
      </>
    ),
  },
  {
    title: 'Come si usa l’app',
    icon: '📱',
    body: (
      <>
        <ul>
          <li>Tocca le carte in mano per <b>selezionarle</b>.</li>
          <li><b>Combina</b> crea la combinazione con le carte selezionate.</li>
          <li>Tocca una <b>tua combinazione</b> (con carte selezionate) per
          <b> aggiungere</b> — anche una matta.</li>
          <li>Seleziona <b>una sola carta</b> e premi <b>Scarta</b> per finire il
          turno.</li>
          <li>Il pulsante <b>👁 scarti</b> ti mostra tutte le carte scartate.</li>
        </ul>
        <div className="rb-tip">Buona fortuna e buon divertimento! 🍀</div>
      </>
    ),
  },
];

export function RulesBook({ onClose }) {
  // page 0 = cover, 1 = index, 2..N+1 = chapters
  const [page, setPage] = useState(0);
  const total = CHAPTERS.length + 2;
  const touch = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setPage((p) => Math.min(total - 1, p + 1));
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onClose]);

  const go = (p) => setPage(Math.max(0, Math.min(total - 1, p)));

  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    if (dx < -45) go(page + 1);
    else if (dx > 45) go(page - 1);
    touch.current = null;
  };

  const isCover = page === 0;
  const isIndex = page === 1;
  const chapter = !isCover && !isIndex ? CHAPTERS[page - 2] : null;

  return (
    <div className="overlay rb-overlay" onClick={onClose}>
      <div className="rb-book" onClick={(e) => e.stopPropagation()}
           onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button className="rb-close" onClick={onClose} aria-label="Chiudi">✕</button>

        <div className="rb-paper">
          {isCover && (
            <div className="rb-cover">
              <div className="rb-cover-suits">
                <span className="s-red">♥</span><span className="s-black">♠</span>
                <span className="s-red">♦</span><span className="s-black">♣</span>
              </div>
              <h1>Il Libro del<br />Burraco</h1>
              <p className="rb-cover-sub">Regole, esempi e consigli</p>
              <button className="btn btn-big btn-primary" onClick={() => go(1)}>Apri il libro →</button>
            </div>
          )}

          {isIndex && (
            <div className="rb-index">
              <h2 className="rb-chapter-title"><span>📖</span> Indice</h2>
              <ol className="rb-toc">
                {CHAPTERS.map((ch, i) => (
                  <li key={i}>
                    <button onClick={() => go(i + 2)}>
                      <span className="toc-ic">{ch.icon}</span>
                      <span className="toc-title">{ch.title}</span>
                      <span className="toc-page">{i + 1}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {chapter && (
            <div className="rb-chapter" key={page}>
              <h2 className="rb-chapter-title"><span>{chapter.icon}</span> {chapter.title}</h2>
              <div className="rb-content">{chapter.body}</div>
            </div>
          )}
        </div>

        <div className="rb-nav">
          <button className="rb-arrow" disabled={page === 0} onClick={() => go(page - 1)}>←</button>
          <div className="rb-progress">
            {!isCover && (
              <button className="rb-index-btn" onClick={() => go(1)}>Indice</button>
            )}
            <span className="rb-pageno">{page === 0 ? 'Copertina' : isIndex ? 'Indice' : `${page - 1} / ${CHAPTERS.length}`}</span>
          </div>
          <button className="rb-arrow" disabled={page === total - 1} onClick={() => go(page + 1)}>→</button>
        </div>
      </div>
    </div>
  );
}
