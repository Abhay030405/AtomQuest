import { cn } from "@/lib/utils";
import { getScoreLevel } from "@/utils/scoring";

interface Cell {
  label: string;
  value: number;
}

interface Props {
  cells: Cell[];
  className?: string;
}

const colorMap = {
  high: "bg-score-high",
  medium: "bg-score-medium",
  low: "bg-score-low",
};

export function CompletionHeatmap({ cells, className }: Props) {
  return (
    <div className={cn("grid grid-cols-7 gap-1", className)}>
      {cells.map((cell, i) => {
        const level = getScoreLevel(cell.value);
        return (
          <div
            key={i}
            title={`${cell.label}: ${cell.value}%`}
            className={cn("h-6 w-6 rounded-sm opacity-80", colorMap[level])}
          />
        );
      })}
    </div>
  );
}
