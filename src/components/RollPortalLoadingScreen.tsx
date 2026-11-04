import React, { useEffect, useState } from 'react';

interface RollPortalLoadingScreenProps {
  durationMs?: number;
  onFinish: () => void;
}

export const RollPortalLoadingScreen: React.FC<RollPortalLoadingScreenProps> = ({
  durationMs = 7000,
  onFinish,
}) => {
  const [progress, setProgress] = useState<number>(0);
  const [fadingOut, setFadingOut] = useState<boolean>(false);

  useEffect(() => {
    const startTime = performance.now();
    let rafId: number | null = null;

    const updateProgress = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);
      if (elapsed < durationMs) {
        rafId = requestAnimationFrame(updateProgress);
      }
    };

    rafId = requestAnimationFrame(updateProgress);

    const fadeTimer = window.setTimeout(() => {
      setFadingOut(true);
    }, Math.max(0, durationMs - 400));

    const finishTimer = window.setTimeout(() => {
      onFinish();
    }, durationMs);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(finishTimer);
    };
  }, [durationMs, onFinish]);

  return (
    <div
      data-testid="rollportal-loading-screen"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-end overflow-hidden bg-[#0e0c18] select-none transition-opacity duration-400 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Imagem Oficial anexada pelo usuário */}
      <img
        src="/assets/aistudio/1793796964368_e3daa681.jpg"
        alt="RollPortal — Sua Jornada Começa Aqui"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Vinheta inferior suave para destacar o círculo pontilhado e o texto Carregando */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

      {/* Bloco Central Inferior: Círculo Redondo Pontilhado Rodando + Texto "Carregando..." */}
      <div className="relative z-10 mb-10 sm:mb-14 flex flex-col items-center gap-3.5 px-8 py-5 rounded-3xl bg-[#11101d]/85 border border-violet-400/35 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
        {/* Círculo Redondo Pontilhado Girando */}
        <div
          data-testid="dotted-loading-spinner"
          className="relative w-16 h-16 flex items-center justify-center"
        >
          <svg
            viewBox="0 0 64 64"
            className="w-16 h-16 animate-spin"
            style={{ animationDuration: '1.8s' }}
            aria-hidden="true"
          >
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="url(#rollportalSpinnerGrad)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="3 10.5"
            />
            <defs>
              <linearGradient id="rollportalSpinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="50%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          {/* Anel interno pontilhado girando em sentido oposto para efeito fluido */}
          <svg
            viewBox="0 0 48 48"
            className="absolute w-10 h-10 animate-spin"
            style={{ animationDuration: '2.6s', animationDirection: 'reverse' }}
            aria-hidden="true"
          >
            <circle
              cx="24"
              cy="24"
              r="18"
              fill="none"
              stroke="#f59e0b"
              strokeOpacity="0.7"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="2 8"
            />
          </svg>
        </div>

        {/* Nome "Carregando" */}
        <div className="flex flex-col items-center gap-1.5">
          <span
            data-testid="loading-screen-label"
            className="text-lg sm:text-xl font-extrabold tracking-widest uppercase text-amber-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
          >
            Carregando...
          </span>
          <div className="w-48 h-1.5 rounded-full bg-zinc-800/90 overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-violet-400 to-sky-400 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
