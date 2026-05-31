"use client";
import { useState, useEffect } from "react";

interface WeekData {
  week: number;
  date: string;
  btcDelta: number;
  hedgeFired: boolean;
  phValue: number;
  plpValue: number;
}

interface PeriodData {
  id: string;
  label: string;
  description: string;
  finalPH: number;
  finalPLP: number;
  weeks: WeekData[];
}

const PERIODS: PeriodData[] = [
  {
    id: "C",
    label: "Q2 2022 -- Terra/Luna",
    description: "BTC -54% in 13 weeks. Five hedge triggers. The strategy earns its keep.",
    finalPH: -26.21,
    finalPLP: -32.57,
    weeks: [
      { week: 1,  date: "2022-04-11", btcDelta: -5.88,  hedgeFired: true,  phValue: 985.54,  plpValue: 968.54 },
      { week: 2,  date: "2022-04-18", btcDelta: -0.57,  hedgeFired: false, phValue: 986.38,  plpValue: 972.27 },
      { week: 3,  date: "2022-04-25", btcDelta: -2.49,  hedgeFired: false, phValue: 987.22,  plpValue: 976.01 },
      { week: 4,  date: "2022-05-02", btcDelta: -11.52, hedgeFired: true,  phValue: 939.60,  plpValue: 912.34 },
      { week: 5,  date: "2022-05-09", btcDelta: -7.96,  hedgeFired: true,  phValue: 914.31,  plpValue: 872.29 },
      { week: 6,  date: "2022-05-16", btcDelta: -3.30,  hedgeFired: false, phValue: 896.97,  plpValue: 858.36 },
      { week: 7,  date: "2022-05-23", btcDelta: -2.73,  hedgeFired: false, phValue: 897.73,  plpValue: 861.67 },
      { week: 8,  date: "2022-05-30", btcDelta: +1.53,  hedgeFired: false, phValue: 898.49,  plpValue: 864.99 },
      { week: 9,  date: "2022-06-06", btcDelta: -11.18, hedgeFired: true,  phValue: 857.00,  plpValue: 810.34 },
      { week: 10, date: "2022-06-13", btcDelta: -22.58, hedgeFired: true,  phValue: 758.74,  plpValue: 703.61 },
      { week: 11, date: "2022-06-20", btcDelta: +2.26,  hedgeFired: false, phValue: 759.38,  plpValue: 706.32 },
      { week: 12, date: "2022-06-27", btcDelta: -8.19,  hedgeFired: true,  phValue: 737.92,  plpValue: 674.36 },
    ],
  },
  {
    id: "A",
    label: "Q3 2024 -- Volatile sideways",
    description: "BTC oscillated wildly but closed flat. Two hedge triggers.",
    finalPH: -14.55,
    finalPLP: -14.83,
    weeks: [
      { week: 1,  date: "2024-07-08", btcDelta: +8.84,  hedgeFired: false, phValue: 1000.85, plpValue: 1003.85 },
      { week: 2,  date: "2024-07-15", btcDelta: +12.12, hedgeFired: false, phValue: 1001.70, plpValue: 1007.72 },
      { week: 3,  date: "2024-07-22", btcDelta: +0.12,  hedgeFired: false, phValue: 1002.55, plpValue: 1011.59 },
      { week: 4,  date: "2024-07-29", btcDelta: -14.78, hedgeFired: true,  phValue: 934.59,  plpValue: 925.71 },
      { week: 5,  date: "2024-08-05", btcDelta: +0.95,  hedgeFired: false, phValue: 935.38,  plpValue: 929.27 },
      { week: 6,  date: "2024-08-12", btcDelta: -0.49,  hedgeFired: false, phValue: 936.17,  plpValue: 932.84 },
      { week: 7,  date: "2024-08-19", btcDelta: +9.91,  hedgeFired: false, phValue: 936.96,  plpValue: 936.43 },
      { week: 8,  date: "2024-08-26", btcDelta: -10.77, hedgeFired: true,  phValue: 895.88,  plpValue: 879.55 },
      { week: 9,  date: "2024-09-02", btcDelta: -4.24,  hedgeFired: false, phValue: 873.83,  plpValue: 860.55 },
      { week: 10, date: "2024-09-09", btcDelta: +7.77,  hedgeFired: false, phValue: 874.57,  plpValue: 863.86 },
      { week: 11, date: "2024-09-16", btcDelta: +7.52,  hedgeFired: false, phValue: 875.31,  plpValue: 867.18 },
      { week: 12, date: "2024-09-23", btcDelta: +3.18,  hedgeFired: false, phValue: 876.05,  plpValue: 870.52 },
      { week: 13, date: "2024-09-30", btcDelta: -4.24,  hedgeFired: false, phValue: 854.49,  plpValue: 851.71 },
    ],
  },
  {
    id: "B",
    label: "Q2 2024 -- Steady drawdown",
    description: "BTC drifted down post-halving. Two hedge triggers.",
    finalPH: -6.11,
    finalPLP: -6.54,
    weeks: [
      { week: 1,  date: "2024-04-08", btcDelta: -5.33,  hedgeFired: true,  phValue: 988.85,  plpValue: 971.86 },
      { week: 2,  date: "2024-04-15", btcDelta: -1.10,  hedgeFired: false, phValue: 989.69,  plpValue: 975.60 },
      { week: 3,  date: "2024-04-22", btcDelta: -2.81,  hedgeFired: false, phValue: 990.53,  plpValue: 979.35 },
      { week: 4,  date: "2024-04-29", btcDelta: +1.42,  hedgeFired: false, phValue: 991.37,  plpValue: 983.12 },
      { week: 5,  date: "2024-05-06", btcDelta: -3.95,  hedgeFired: false, phValue: 968.71,  plpValue: 963.62 },
      { week: 6,  date: "2024-05-13", btcDelta: +7.79,  hedgeFired: false, phValue: 969.53,  plpValue: 967.33 },
      { week: 7,  date: "2024-05-20", btcDelta: +3.37,  hedgeFired: false, phValue: 970.36,  plpValue: 971.05 },
      { week: 8,  date: "2024-05-27", btcDelta: -1.08,  hedgeFired: false, phValue: 971.18,  plpValue: 974.78 },
      { week: 9,  date: "2024-06-03", btcDelta: +2.78,  hedgeFired: false, phValue: 972.01,  plpValue: 978.53 },
      { week: 10, date: "2024-06-10", btcDelta: -4.27,  hedgeFired: false, phValue: 947.96,  plpValue: 957.24 },
      { week: 11, date: "2024-06-17", btcDelta: -5.20,  hedgeFired: true,  phValue: 938.15,  plpValue: 931.05 },
      { week: 12, date: "2024-06-24", btcDelta: -0.69,  hedgeFired: false, phValue: 938.95,  plpValue: 934.63 },
    ],
  },
];

const GRID_VALUES = [700, 800, 900, 1000];

function mapY(value: number): number {
  return 220 - ((value - 600) / 460) * 204;
}

function sign(n: number): string {
  return n >= 0 ? "+" : "";
}

export function StrategySimulator() {
  const [activePeriod, setActivePeriod] = useState("C");
  const [currentWeek, setCurrentWeek] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const period = PERIODS.find((p) => p.id === activePeriod)!;
  const totalWeeks = period.weeks.length;
  const finished = currentWeek >= totalWeeks;

  const chartData: WeekData[] = [
    { week: 0, date: "", btcDelta: 0, hedgeFired: false, phValue: 1000, plpValue: 1000 },
    ...period.weeks,
  ];

  function mapX(week: number): number {
    return 56 + (week / totalWeeks) * 644;
  }

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setCurrentWeek((prev) => {
        if (prev >= totalWeeks) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [isPlaying, totalWeeks]);

  useEffect(() => {
    if (currentWeek >= totalWeeks && isPlaying) {
      setIsPlaying(false);
    }
  }, [currentWeek, totalWeeks, isPlaying]);

  function handlePeriodChange(id: string) {
    setActivePeriod(id);
    setCurrentWeek(0);
    setIsPlaying(false);
    setHasStarted(false);
  }

  function handlePlay() {
    if (finished) {
      setCurrentWeek(0);
      setHasStarted(true);
      setIsPlaying(true);
      return;
    }
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      setHasStarted(true);
      setIsPlaying(true);
    }
  }

  function handleReset() {
    setCurrentWeek(0);
    setIsPlaying(false);
    setHasStarted(false);
  }

  const revealed = chartData.slice(0, currentWeek + 1);
  const phPoints = revealed.map((d) => `${mapX(d.week).toFixed(1)},${mapY(d.phValue).toFixed(1)}`).join(" ");
  const plpPoints = revealed.map((d) => `${mapX(d.week).toFixed(1)},${mapY(d.plpValue).toFixed(1)}`).join(" ");
  const lastPoint = revealed[revealed.length - 1];

  const revealedTriggers = period.weeks.filter((w) => w.hedgeFired && w.week <= currentWeek);
  const currentData = currentWeek > 0 ? period.weeks[currentWeek - 1] : null;

  let playText: string;
  if (!hasStarted) {
    playText = "Play simulation";
  } else if (finished) {
    playText = "Replay";
  } else if (isPlaying) {
    playText = "Pause";
  } else {
    playText = "Resume";
  }

  const finalDelta = period.finalPH - period.finalPLP;

  return (
    <div className="border border-border bg-paper-raised p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-4">Strategy Simulator</p>
      <p className="text-sm italic text-ink-secondary mb-3">{period.description}</p>

      <svg viewBox="0 0 720 260" className="w-full block">
        {GRID_VALUES.map((v) => (
          <g key={v}>
            <line x1={56} y1={mapY(v).toFixed(1)} x2={700} y2={mapY(v).toFixed(1)} stroke="#8F8674" strokeOpacity={0.25} strokeWidth={1} />
            <text x={50} y={(mapY(v) + 4).toFixed(1)} fontSize={10} fill="#8F8674" textAnchor="end">${v}</text>
          </g>
        ))}

        {revealedTriggers.map((w) => (
          <g key={w.week}>
            <line x1={mapX(w.week).toFixed(1)} y1={16} x2={mapX(w.week).toFixed(1)} y2={220} stroke="#E07B3E" strokeOpacity={0.4} strokeDasharray="3 3" strokeWidth={1} />
            <text x={mapX(w.week).toFixed(1)} y={13} fontSize={9} fill="#E07B3E" textAnchor="middle">HEDGE</text>
          </g>
        ))}

        {revealed.length > 1 && <polyline points={plpPoints} stroke="#C2B8A6" strokeWidth={1.5} fill="none" />}
        {revealed.length > 1 && <polyline points={phPoints} stroke="#E07B3E" strokeWidth={2} fill="none" />}

        {revealed.length > 0 && (
          <g>
            <circle cx={mapX(lastPoint.week).toFixed(1)} cy={mapY(lastPoint.plpValue).toFixed(1)} r={3} fill="#C2B8A6" />
            <circle cx={mapX(lastPoint.week).toFixed(1)} cy={mapY(lastPoint.phValue).toFixed(1)} r={3} fill="#E07B3E" />
          </g>
        )}

        <g>
          <line x1={582} y1={26} x2={600} y2={26} stroke="#E07B3E" strokeWidth={2} />
          <text x={604} y={30} fontSize={10} fill="#E07B3E">PLP+Hedge</text>
          <line x1={582} y1={42} x2={600} y2={42} stroke="#C2B8A6" strokeWidth={1.5} />
          <text x={604} y={46} fontSize={10} fill="#C2B8A6">Raw PLP</text>
        </g>
      </svg>

      <div className="mt-4 flex flex-wrap gap-2">
        {PERIODS.map((p) => {
          const isActive = activePeriod === p.id;
          const btnCls = isActive ? "border-accent text-accent" : "border-border text-ink-muted hover:text-ink-secondary";
          return <button key={p.id} onClick={() => handlePeriodChange(p.id)} className={`font-mono text-xs uppercase tracking-widest px-3 py-1 border transition-colors ${btnCls}`}>{p.label}</button>;
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={handlePlay} className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-accent text-accent transition-colors">{playText}</button>
        {hasStarted && <button onClick={handleReset} className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-border text-ink-muted hover:text-ink-secondary transition-colors">Reset</button>}
        <span className="font-mono text-xs text-ink-muted">Week {currentWeek} / {totalWeeks}</span>
      </div>

      {hasStarted && currentData && (
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-ink-secondary">
          <span>Week {currentData.week} / {totalWeeks}</span>
          <span className="text-ink-muted">|</span>
          <span>{currentData.date}</span>
          <span className="text-ink-muted">|</span>
          <span className={currentData.btcDelta < 0 ? "text-negative" : "text-positive"}>BTC {sign(currentData.btcDelta)}{currentData.btcDelta.toFixed(2)}%</span>
          {currentData.hedgeFired && <span className="text-ink-muted">|</span>}
          {currentData.hedgeFired && <span className="text-accent font-semibold">HEDGE FIRED</span>}
        </div>
      )}

      {finished && (
        <div className="mt-4 font-mono text-sm border-t border-border pt-4 flex flex-wrap gap-x-2 items-baseline">
          <span className="text-ink-muted">Final:</span>
          <span className={period.finalPH >= 0 ? "text-positive" : "text-negative"}>PLP+Hedge {sign(period.finalPH)}{period.finalPH.toFixed(2)}%</span>
          <span className="text-ink-muted">vs</span>
          <span className={period.finalPLP >= 0 ? "text-positive" : "text-negative"}>Raw PLP {sign(period.finalPLP)}{period.finalPLP.toFixed(2)}%</span>
          <span className="text-ink-muted">-- Delta:</span>
          <span className={finalDelta >= 0 ? "text-positive" : "text-negative"}>{sign(finalDelta)}{finalDelta.toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}
