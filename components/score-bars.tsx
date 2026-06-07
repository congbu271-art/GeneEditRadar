import { cn } from "@/lib/utils";

type ScoreBarsProps = {
  scores: { label: string; value: number }[];
  compact?: boolean;
};

export function ScoreBars({ scores, compact = false }: ScoreBarsProps) {
  return (
    <div className="grid gap-3">
      {scores.map((score) => (
        <div key={score.label} className="grid gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{score.label}</span>
            <span className="text-slate-950">{score.value}</span>
          </div>
          <div className={cn("h-2 rounded-full bg-slate-200", compact && "h-1.5")}>
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(52,211,153,0.92))]"
              style={{ width: `${score.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
