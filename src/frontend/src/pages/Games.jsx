import { Link } from "react-router-dom";

export default function Games() {
  return (
    <div>
      <h1 className="page-title">Games & Tools</h1>
      <p className="page-subtitle">Fun games and handy tools for the family.</p>

      <h2 className="tree-admin-title">Games</h2>
      <div className="card-grid tree-grid" style={{ marginBottom: 32 }}>
        <Link to="/games/chess" className="card tree-card">
          <div className="card-emoji">♟️</div>
          <div className="card-title">Chess</div>
          <div className="card-description">Challenge a family member to a game.</div>
        </Link>
        <Link to="/games/scrabble" className="card tree-card">
          <div className="card-emoji">🔤</div>
          <div className="card-title">Scrabble</div>
          <div className="card-description">Honor-system scoring, 2-4 players.</div>
        </Link>
        <Link to="/games/roulette" className="card tree-card">
          <div className="card-emoji">🎰</div>
          <div className="card-title">Roulette</div>
          <div className="card-description">One shared table, gamble your Love.</div>
        </Link>
        <Link to="/games/rock-paper-scissors" className="card tree-card">
          <div className="card-emoji">✂️</div>
          <div className="card-title">Rock Paper Scissors</div>
          <div className="card-description">Challenge someone, pick blind, reveal together.</div>
        </Link>
        <Link to="/games/sudoku" className="card tree-card">
          <div className="card-emoji">🧩</div>
          <div className="card-title">Sudoku</div>
          <div className="card-description">A new daily-ish puzzle every 36 hours. Easy, medium, or hard.</div>
        </Link>
        <Link to="/games/poker" className="card tree-card">
          <div className="card-emoji">🃏</div>
          <div className="card-title">Poker</div>
          <div className="card-description">Heads-up No-Limit Texas Hold'em. 20 Love buy-in.</div>
        </Link>
        <Link to="/games/tetris" className="card tree-card">
          <div className="card-emoji">🧱</div>
          <div className="card-title">Tetris</div>
          <div className="card-description">Classic block-stacking. Free play, or wager Love in tournaments.</div>
        </Link>
      </div>

      <h2 className="tree-admin-title">Tools</h2>
      <div className="card-grid tree-grid">
        <Link to="/games/spin-wheel" className="card tree-card">
          <div className="card-emoji">🎡</div>
          <div className="card-title">Wheel of Random</div>
          <div className="card-description">Add names or options, spin to pick one at random.</div>
        </Link>
        <Link to="/games/hat-game" className="card tree-card">
          <div className="card-emoji">🎩</div>
          <div className="card-title">Hat Draw</div>
          <div className="card-description">Put answers in a hat, everyone draws one at random.</div>
        </Link>
        <Link to="/games/dice-roll" className="card tree-card">
          <div className="card-emoji">🎲</div>
          <div className="card-title">Dice Roll</div>
          <div className="card-description">Roll one die or several — add more for bigger rolls.</div>
        </Link>
        <Link to="/games/coin-toss" className="card tree-card">
          <div className="card-emoji">🪙</div>
          <div className="card-title">Coin Toss</div>
          <div className="card-description">Flip a coin — wolf head or salmon tail?</div>
        </Link>
        <Link to="/games/straw-draw" className="card tree-card">
          <div className="card-emoji">🥢</div>
          <div className="card-title">Draw Straws</div>
          <div className="card-description">Everyone gets a straw — reveal yours whenever you're ready.</div>
        </Link>
        <Link to="/games/secret-santa" className="card tree-card">
          <div className="card-emoji">🎅</div>
          <div className="card-title">Secret Santa</div>
          <div className="card-description">Everyone gets a secret match — only you see who you got.</div>
        </Link>
      </div>
    </div>
  );
}
