import { useMemo, useEffect } from "react";

const CONFETTI_COLORS = ["#e8702e", "#1c6b3d", "#1e5fae", "#e0a530", "#d63384", "#7b1fa2"];
const BALLOON_COLORS = ["#d63384", "#e8702e", "#1e5fae", "#7b1fa2", "#e0a530", "#2e8b57"];
const PETAL_EMOJI = ["🌸", "💗", "🌺", "💕"];
const STREAK_COLORS = ["#fff59d", "#ffe0b2", "#fff"];
const RING_COLORS = ["#e0a530", "#d63384", "#e0a530"];

function useAutoDone(onDone, duration) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), duration);
    return () => clearTimeout(t);
  }, [onDone, duration]);
}

/* ================= Loved Message Effects ================= */

function LovedConfetti({ onDone }) {
  useAutoDone(onDone, 1500);
  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 45 + Math.random() * 45;
        return {
          id: i,
          dx: Math.cos(angle) * radius,
          dy: Math.sin(angle) * radius,
          rot: 180 + Math.random() * 540,
          delay: Math.random() * 0.2,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          size: 5 + Math.random() * 4,
        };
      }),
    []
  );
  return (
    <div className="loved-fx-layer">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="loved-fx-confetti-piece"
          style={{
            "--dx": p.dx + "px",
            "--dy": p.dy + "px",
            "--rot": p.rot + "deg",
            "--fx-delay": p.delay + "s",
            "--piece-color": p.color,
            width: p.size + "px",
            height: p.size * 1.7 + "px",
            boxShadow: "0 0 4px " + p.color,
          }}
        />
      ))}
    </div>
  );
}

function LovedHeartPulse({ onDone }) {
  useAutoDone(onDone, 1600);
  const hearts = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        angle: i * (360 / 14) + (Math.random() * 10 - 5),
        delay: (i % 5) * 0.06,
        size: 12 + Math.random() * 8,
      })),
    []
  );
  return (
    <div className="loved-fx-layer">
      {hearts.map((h) => (
        <span
          key={h.id}
          className="loved-fx-heart"
          style={{
            "--angle": h.angle + "deg",
            "--fx-delay": h.delay + "s",
            fontSize: h.size + "px",
            filter: "drop-shadow(0 0 3px rgba(214, 51, 132, 0.7))",
          }}
        >
          💗
        </span>
      ))}
    </div>
  );
}

function LovedSparkleTrail({ onDone }) {
  useAutoDone(onDone, 1900);
  const spots = [
    { top: "2%", left: "8%" },
    { top: "2%", left: "50%" },
    { top: "2%", left: "88%" },
    { top: "50%", left: "-2%" },
    { top: "50%", left: "102%" },
    { top: "96%", left: "8%" },
    { top: "96%", left: "50%" },
    { top: "96%", left: "88%" },
    { top: "18%", left: "22%" },
    { top: "18%", left: "78%" },
    { top: "78%", left: "22%" },
    { top: "78%", left: "78%" },
  ];
  const sparkles = useMemo(
    () => spots.map((s, i) => ({ ...s, id: i, delay: Math.random() * 0.6 })),
    []
  );
  const streaks = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        angle: i * 36,
        delay: Math.random() * 0.15,
        color: STREAK_COLORS[i % STREAK_COLORS.length],
      })),
    []
  );
  return (
    <div className="loved-fx-layer">
      {streaks.map((s) => (
        <span
          key={"streak-" + s.id}
          className="loved-fx-streak"
          style={{ "--angle": s.angle + "deg", "--fx-delay": s.delay + "s", "--streak-color": s.color }}
        />
      ))}
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="loved-fx-sparkle"
          style={{ top: s.top, left: s.left, "--fx-delay": s.delay + "s" }}
        >
          ✨
        </span>
      ))}
    </div>
  );
}

function LovedGlowRipple({ onDone }) {
  useAutoDone(onDone, 2000);
  const rings = [0, 0.25, 0.5];
  return (
    <div className="loved-fx-layer">
      {rings.map((delay, i) => (
        <span
          key={i}
          className="loved-fx-glow-ring"
          style={{ "--fx-delay": delay + "s", "--ring-color": RING_COLORS[i] }}
        />
      ))}
    </div>
  );
}

function LovedGoldenShimmer({ onDone }) {
  useAutoDone(onDone, 2000);
  const sparkles = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        top: 10 + Math.random() * 80 + "%",
        left: 10 + Math.random() * 80 + "%",
        delay: 0.1 + i * 0.12,
      })),
    []
  );
  return (
    <div className="loved-fx-layer">
      <div className="loved-fx-shimmer-wrap">
        <div className="loved-fx-shimmer-bar" />
      </div>
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="loved-fx-sparkle"
          style={{ top: s.top, left: s.left, "--fx-delay": s.delay + "s" }}
        >
          ✨
        </span>
      ))}
    </div>
  );
}

export const LOVED_EFFECT_COMPONENTS = {
  confetti: LovedConfetti,
  heartPulse: LovedHeartPulse,
  sparkleTrail: LovedSparkleTrail,
  glowRipple: LovedGlowRipple,
  goldenShimmer: LovedGoldenShimmer,
};

export function LovedEffectOverlay({ effectKey, onDone }) {
  const Comp = LOVED_EFFECT_COMPONENTS[effectKey];
  if (!Comp) return null;
  return <Comp onDone={onDone} />;
}

/* ================= Love Send Effects ================= */

function SendFireworks({ onDone }) {
  useAutoDone(onDone, 2300);
  const bursts = useMemo(
    () =>
      Array.from({ length: 5 }, (_, b) => {
        const particles = Array.from({ length: 16 }, (_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const radius = 55 + Math.random() * 35;
          return {
            id: i,
            dx: Math.cos(angle) * radius,
            dy: Math.sin(angle) * radius,
            color: CONFETTI_COLORS[(b + i) % CONFETTI_COLORS.length],
            delay: Math.random() * 0.12,
          };
        });
        return {
          id: b,
          top: 15 + Math.random() * 40 + "%",
          left: 15 + Math.random() * 70 + "%",
          delay: b * 0.3,
          particles,
        };
      }),
    []
  );
  return (
    <div className="send-fx-layer">
      {bursts.map((b) => (
        <div
          key={b.id}
          className="send-fx-firework-burst"
          style={{ "--burst-top": b.top, "--burst-left": b.left }}
        >
          {b.particles.map((p) => (
            <span
              key={p.id}
              className="send-fx-firework-particle"
              style={{
                "--dx": p.dx + "px",
                "--dy": p.dy + "px",
                "--particle-color": p.color,
                "--fx-delay": b.delay + p.delay + "s",
                boxShadow: "0 0 6px " + p.color,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SendShootingStars({ onDone }) {
  useAutoDone(onDone, 2100);
  const colors = ["#fff", "#cfe8ff", "#ffe0b2", "#ffd1e8"];
  const stars = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        top: 5 + Math.random() * 45 + "%",
        delay: i * 0.18 + Math.random() * 0.1,
        width: 70 + Math.random() * 60,
        color: colors[i % colors.length],
      })),
    []
  );
  return (
    <div className="send-fx-layer">
      {stars.map((s) => (
        <span
          key={s.id}
          className="send-fx-star"
          style={{
            "--star-top": s.top,
            "--fx-delay": s.delay + "s",
            width: s.width + "px",
            background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, " + s.color + " 60%, #fff 100%)",
          }}
        />
      ))}
    </div>
  );
}

function SendFallingPetals({ onDone }) {
  useAutoDone(onDone, 3400);
  const petals = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100 + "%",
        sway: Math.random() * 80 - 40 + "px",
        delay: Math.random() * 0.7,
        emoji: PETAL_EMOJI[i % PETAL_EMOJI.length],
        size: 14 + Math.random() * 12,
      })),
    []
  );
  return (
    <div className="send-fx-layer">
      {petals.map((p) => (
        <span
          key={p.id}
          className="send-fx-petal"
          style={{
            "--petal-left": p.left,
            "--sway": p.sway,
            "--fx-delay": p.delay + "s",
            fontSize: p.size + "px",
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

function SendScreenFlash({ onDone }) {
  useAutoDone(onDone, 1200);
  const rings = [
    { delay: 0, color: "#ffb300" },
    { delay: 0.15, color: "#d63384" },
    { delay: 0.3, color: "#fff" },
  ];
  return (
    <div className="send-fx-layer">
      <div className="send-fx-flash" />
      {rings.map((r, i) => (
        <div
          key={i}
          className="send-fx-ring"
          style={{ animationDelay: r.delay + "s", borderColor: r.color }}
        />
      ))}
    </div>
  );
}

function SendBalloonRise({ onDone }) {
  useAutoDone(onDone, 3500);
  const balloons = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const delay = Math.random() * 0.6;
        const sparks = Array.from({ length: 5 }, (_, s) => {
          const angle = (s / 5) * Math.PI * 2;
          const radius = 12 + Math.random() * 10;
          return {
            id: s,
            dx: Math.cos(angle) * radius,
            dy: Math.sin(angle) * radius,
          };
        });
        return {
          id: i,
          left: 6 + Math.random() * 88 + "%",
          sway: Math.random() * 50 - 25 + "px",
          delay,
          color: BALLOON_COLORS[i % BALLOON_COLORS.length],
          size: 22 + Math.random() * 10,
          sparks,
          sparkDelay: delay + 2.4,
        };
      }),
    []
  );
  return (
    <div className="send-fx-layer">
      {balloons.map((b) => (
        <span
          key={b.id}
          className="send-fx-balloon"
          style={{
            "--balloon-left": b.left,
            "--sway": b.sway,
            "--fx-delay": b.delay + "s",
            "--balloon-color": b.color,
            width: b.size + "px",
            height: b.size * 1.25 + "px",
          }}
        >
          {b.sparks.map((sp) => (
            <span
              key={sp.id}
              className="send-fx-balloon-spark"
              style={{
                "--spark-dx": sp.dx + "px",
                "--spark-dy": sp.dy + "px",
                "--spark-delay": b.sparkDelay + "s",
                "--spark-color": b.color,
              }}
            />
          ))}
        </span>
      ))}
    </div>
  );
}

export const SEND_EFFECT_COMPONENTS = {
  fireworks: SendFireworks,
  shootingStars: SendShootingStars,
  fallingPetals: SendFallingPetals,
  screenFlash: SendScreenFlash,
  balloonRise: SendBalloonRise,
};

export function SendEffectOverlay({ effectKey, onDone }) {
  const Comp = SEND_EFFECT_COMPONENTS[effectKey];
  if (!Comp) return null;
  return <Comp onDone={onDone} />;
}
