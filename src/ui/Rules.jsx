import React from 'react';

export function RulesModal({ onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card rules" onClick={(e) => e.stopPropagation()}>
        <h2>Come si gioca a Burraco</h2>
        <div className="rules-body">
          <p>Si gioca in <b>2</b> (1 vs 1) o in <b>4</b> (2 vs 2, in coppia) con 2 mazzi da 54 carte (108 carte, 4 jolly). In 2 vs 2 i compagni condividono le combinazioni.</p>

          <h3>Obiettivo</h3>
          <p>Formare combinazioni e realizzare un <b>burraco</b> (combinazione di 7+ carte) per poter chiudere. Vince chi raggiunge per primo <b>{'2005'}</b> punti.</p>

          <h3>Il turno</h3>
          <ol>
            <li><b>Pesca</b>: una carta dal <b>tallone</b> oppure prendi <b>tutti</b> gli scarti.</li>
            <li><b>Gioca</b>: crea nuove combinazioni e aggiungi carte a quelle già in tavola.</li>
            <li><b>Scarta</b>: una carta per terminare il turno.</li>
          </ol>

          <h3>Combinazioni</h3>
          <ul>
            <li><b>Scala</b>: 3+ carte dello stesso seme in sequenza (es. 5♥ 6♥ 7♥).</li>
            <li><b>Tris/Poker</b>: 3+ carte dello stesso valore (es. 8♣ 8♦ 8♠).</li>
            <li>Le <b>matte</b> (jolly ★ e i 2 "pinella") sostituiscono qualsiasi carta. Al massimo <b>una matta</b> per combinazione.</li>
            <li>Un 2 nel suo posto naturale (es. A-2-3, o un tris di 2) <b>non</b> conta come matta.</li>
          </ul>

          <h3>Burraco & Pozzetto</h3>
          <ul>
            <li><b>Burraco pulito</b> (senza matte) = <b>200</b> punti; <b>sporco</b> = <b>100</b>.</li>
            <li>Quando finisci le carte prendi il tuo <b>pozzetto</b> (11 carte) e continui.</li>
            <li>Per <b>chiudere</b> servono: pozzetto già preso e almeno un burraco.</li>
          </ul>

          <h3>Punteggio</h3>
          <ul>
            <li>Jolly 30 · 2 (pinella) 20 · Asso 15 · figure/8-9-10 10 · 3-7 5 punti.</li>
            <li>+100 per la chiusura. -100 se non hai preso il pozzetto.</li>
            <li>Le carte rimaste in mano si <b>sottraggono</b>.</li>
          </ul>

          <h3>Come si usa l'app</h3>
          <ul>
            <li>Tocca le carte in mano per selezionarle.</li>
            <li><b>Combina</b> crea la combinazione selezionata.</li>
            <li>Tocca una tua combinazione in tavola (con carte selezionate) per <b>aggiungere</b>.</li>
            <li>Seleziona una sola carta e premi <b>Scarta</b> per finire il turno.</li>
          </ul>
        </div>
        <button className="btn btn-big btn-primary" onClick={onClose}>Ho capito</button>
      </div>
    </div>
  );
}
