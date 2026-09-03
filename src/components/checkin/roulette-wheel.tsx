"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type RouletteWheelProps = {
  /** Nombres a mostrar en la ruleta, en orden fijo (debe incluir siempre al ganador). */
  names: string[];
  /** Indice del ganador dentro de `names`. null = todavia no se sorteo (ruleta decorativa, sin girar a proposito). */
  highlightIndex: number | null;
  /** Nombre completo del ganador, para el cartel final. */
  winnerName: string | null;
  /** Cambia con cada sorteo nuevo (ej. la lista de excluidos) para disparar un giro nuevo. */
  spinToken: string;
  emptyLabel: string;
};

const SEGMENT_COLORS = [
  "#1a1c1e",
  "#715a3e",
  "#93000a",
  "#44474a",
  "#c6a475",
  "#75777a",
  "#a8481f",
  "#3d2f1c",
  "#5c5f62",
  "#8a6d47",
];

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 6;

/** angulo medido en sentido horario desde arriba (12 en punto) = 0, como conic-gradient. */
function polarPoint(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function truncate(name: string, max = 14) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function RouletteWheel({ names, highlightIndex, winnerName, spinToken, emptyLabel }: RouletteWheelProps) {
  const count = names.length;
  const segAngle = count > 0 ? 360 / count : 360;
  const [rotation, setRotation] = useState(0);
  const [revealed, setRevealed] = useState(true);
  const appliedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (highlightIndex === null || count === 0) {
      return;
    }
    if (appliedTokenRef.current === spinToken) {
      return;
    }
    appliedTokenRef.current = spinToken;

    const centerAngle = highlightIndex * segAngle + segAngle / 2;

    // Si esta pestana ya mostro este mismo resultado antes (ej. se recargo la
    // pagina sobre un sorteo ya resuelto), no repetir el show de giros: se
    // deja la rueda apuntando directo al ganador.
    let alreadyRevealed = false;
    try {
      alreadyRevealed = sessionStorage.getItem(`roulette-revealed:${spinToken}`) === "1";
    } catch {
      // sessionStorage puede no estar disponible (ventana privada, etc.) -no bloqueante
    }

    if (alreadyRevealed) {
      const targetMod = (((360 - centerAngle) % 360) + 360) % 360;
      setRotation((prev) => {
        const currentMod = ((prev % 360) + 360) % 360;
        return prev - currentMod + targetMod;
      });
      setRevealed(true);
      return;
    }

    setRevealed(false);

    const maxJitter = Math.max(segAngle / 2 - 4, 1);
    const jitter = (Math.random() * 2 - 1) * maxJitter;
    const targetMod = (((360 - centerAngle + jitter) % 360) + 360) % 360;
    const spins = 6 + Math.floor(Math.random() * 3);

    const spinTimer = setTimeout(() => {
      setRotation((prev) => {
        const currentMod = ((prev % 360) + 360) % 360;
        let delta = targetMod - currentMod;
        if (delta <= 0) {
          delta += 360;
        }
        return prev + spins * 360 + delta;
      });
    }, 150);

    const revealTimer = setTimeout(() => {
      setRevealed(true);
      try {
        sessionStorage.setItem(`roulette-revealed:${spinToken}`, "1");
      } catch {
        // idem
      }
    }, 150 + 4700);

    return () => {
      clearTimeout(spinTimer);
      clearTimeout(revealTimer);
    };
  }, [spinToken, highlightIndex, count, segAngle]);

  const isSpinning = highlightIndex !== null && !revealed;

  return (
    <div className="mx-auto flex flex-col items-center">
      <div className="relative w-fit">
        <span className="material-symbols-outlined absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-[42px] text-error drop-shadow-md">
          arrow_drop_down
        </span>
        {count === 0 ? (
          <div className="flex h-64 w-64 items-center justify-center rounded-full border-4 border-dashed border-outline-variant/40 p-6 text-center text-body-md text-on-surface-variant sm:h-72 sm:w-72">
            {emptyLabel}
          </div>
        ) : (
          <div className="h-64 w-64 sm:h-72 sm:w-72">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className={clsx(
                "h-full w-full rounded-full border-[6px] border-on-surface shadow-xl",
                highlightIndex === null && "animate-[spin_50s_linear_infinite]",
              )}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: highlightIndex !== null ? "transform 4.7s cubic-bezier(0.12, 0.66, 0.1, 1)" : undefined,
              }}
            >
              {count === 1 ? (
                <>
                  <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={SEGMENT_COLORS[0]} />
                  <text
                    x={CENTER}
                    y={CENTER}
                    fill="#ffffff"
                    fontSize={13}
                    fontWeight={700}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {truncate(names[0], 18)}
                  </text>
                </>
              ) : (
                names.map((name, i) => {
                  const startAngle = i * segAngle;
                  const endAngle = (i + 1) * segAngle;
                  const start = polarPoint(startAngle, RADIUS);
                  const end = polarPoint(endAngle, RADIUS);
                  const largeArc = segAngle > 180 ? 1 : 0;
                  const path = `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
                  const labelAngle = startAngle + segAngle / 2;
                  const labelPoint = polarPoint(labelAngle, RADIUS * 0.62);

                  return (
                    <g key={`${name}-${i}`}>
                      <path
                        d={path}
                        fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                        stroke="#f9f9f7"
                        strokeWidth={1.5}
                      />
                      <text
                        x={labelPoint.x}
                        y={labelPoint.y}
                        fill="#ffffff"
                        fontSize={count > 8 ? 8 : 10}
                        fontWeight={700}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${labelAngle}, ${labelPoint.x}, ${labelPoint.y})`}
                      >
                        {truncate(name, count > 8 ? 11 : 14)}
                      </text>
                    </g>
                  );
                })
              )}
              <circle cx={CENTER} cy={CENTER} r={22} fill="#000101" stroke="#f9f9f7" strokeWidth={3} />
            </svg>
          </div>
        )}
      </div>

      {isSpinning ? (
        <p className="mt-5 animate-pulse text-center text-body-lg font-bold text-on-surface-variant">
          Girando...
        </p>
      ) : null}

      {revealed && winnerName ? (
        <div className="mt-5 w-full max-w-sm rounded-2xl border-2 border-primary/30 bg-surface-container-lowest p-6 text-center shadow-lg">
          <span className="material-symbols-outlined animate-bounce mb-2 text-5xl text-primary">
            emoji_events
          </span>
          <p className="mb-1 text-label-md font-bold tracking-[0.2em] text-primary uppercase">Ganador</p>
          <p className="text-headline-md font-bold">{winnerName}</p>
        </div>
      ) : null}
    </div>
  );
}
