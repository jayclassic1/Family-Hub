import { useEffect, useState } from "react";

const COLORS = ["#e8702e", "#e0a530", "#1c6b3d", "#1e5fae", "#7b1fa2", "#d63384", "#f2c94c"];

export default function ConfettiBurst({ active, onDone }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!active) return;
    const newPieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      duration: 2 + Math.random() * 1.5,
      delay: Math.random() * 0.4,
    }));
    setPieces(newPieces);
    const t = setTimeout(() => {
      setPieces([]);
      if (onDone) onDone();
    }, 3200);
    return () => clearTimeout(t);
  }, [active]);

  if (pieces.length === 0) return null;

  return (
    <div className="confetti-overlay">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left + "%",
            background: p.color,
            animationDuration: p.duration + "s",
            animationDelay: p.delay + "s",
          }}
        />
      ))}
    </div>
  );
}
