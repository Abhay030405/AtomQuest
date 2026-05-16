import { Check, TrendingUp, TrendingDown, Calendar, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UoMType } from "@/types/goal.types";
import type { UoMType as UoMTypeType } from "@/types/goal.types";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { cn } from "@/lib/utils";

const UOM_ICONS: Record<UoMTypeType, LucideIcon> = {
  [UoMType.MIN]: TrendingUp,
  [UoMType.MAX]: TrendingDown,
  [UoMType.TIMELINE]: Calendar,
  [UoMType.ZERO]: ShieldCheck,
};

interface Props {
  value?: UoMTypeType;
  onChange: (uomType: UoMTypeType) => void;
  disabled?: boolean;
}

export function UoMSelector({ value, onChange, disabled = false }: Readonly<Props>) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(Object.keys(UOM_TYPE_META) as UoMTypeType[]).map((key) => {
        const meta = UOM_TYPE_META[key];
        const Icon = UOM_ICONS[key];
        const isSelected = value === key;

        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(key)}
            className={cn(
              "relative flex flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40",
              isSelected
                ? "border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500 shadow-sm"
                : "border-border bg-card"
            )}
          >
            {/* Selected checkmark */}
            {isSelected && (
              <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500">
                <Check className="h-2.5 w-2.5 text-white" />
              </span>
            )}

            {/* Icon */}
            <Icon
              className={cn(
                "h-5 w-5 shrink-0",
                isSelected ? "text-indigo-600" : "text-muted-foreground"
              )}
            />

            {/* Label */}
            <p
              className={cn(
                "text-xs font-semibold leading-tight pr-5",
                isSelected ? "text-indigo-700" : "text-foreground"
              )}
            >
              {meta.label}
            </p>

            {/* Description */}
            <p className="text-[11px] text-muted-foreground leading-snug">
              {meta.description.split("(")[0].trim()}
            </p>

            {/* Example */}
            <p
              className={cn(
                "text-[10px] italic leading-snug",
                isSelected ? "text-indigo-500/80" : "text-muted-foreground/60"
              )}
            >
              e.g. {meta.example.split(",")[0].trim()}
            </p>
          </button>
        );
      })}
    </div>
  );
}
