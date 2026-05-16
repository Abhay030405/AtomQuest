import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VERSIONS_BY_GOAL_ID } from "@/mocks/mockGoalVersions";
import { getRoleDisplayName, getRoleColor } from "@/utils/permission.util";
import { formatDateTime } from "@/utils/date.util";
import { UserRole } from "@/types/user.types";
import { cn } from "@/lib/utils";
import type { GoalVersion } from "@/types/goal.types";
import type { UserRole as UserRoleType } from "@/types/user.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferRole(changedBy: string): UserRoleType {
  if (changedBy === "u-vikram-nair") return UserRole.MANAGER;
  if (changedBy === "u-priya-sharma") return UserRole.ADMIN;
  return UserRole.EMPLOYEE;
}

// ─── Diff view between two consecutive versions ───────────────────────────────

interface DiffProps {
  prev: GoalVersion;
  curr: GoalVersion;
}

function VersionDiff({ prev, curr }: Readonly<DiffProps>) {
  const diffs: Array<{ field: string; from: string; to: string }> = [];

  if (prev.targetValue !== curr.targetValue)
    diffs.push({
      field: "Target",
      from: String(prev.targetValue ?? "—"),
      to: String(curr.targetValue ?? "—"),
    });
  if (prev.weightage !== curr.weightage)
    diffs.push({
      field: "Weightage",
      from: `${prev.weightage}%`,
      to: `${curr.weightage}%`,
    });
  if (prev.title !== curr.title)
    diffs.push({ field: "Title", from: prev.title, to: curr.title });
  if (prev.uomType !== curr.uomType)
    diffs.push({ field: "UoM", from: prev.uomType, to: curr.uomType });
  if (prev.status !== curr.status)
    diffs.push({ field: "Status", from: prev.status, to: curr.status });

  if (diffs.length === 0) return null;

  return (
    <div className="mt-2.5 space-y-1.5 rounded-md bg-muted/40 px-3 py-2.5">
      {diffs.map((d) => (
        <div key={d.field} className="flex items-baseline gap-2 text-xs">
          <span className="w-16 shrink-0 font-medium text-muted-foreground">
            {d.field}:
          </span>
          <span className="line-through text-muted-foreground/70">{d.from}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-semibold text-foreground">{d.to}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  goalId: string;
  goalTitle: string;
}

export function GoalVersionDrawer({
  open,
  onClose,
  goalId,
  goalTitle,
}: Readonly<Props>) {
  // Newest first so the timeline reads top-to-bottom = latest
  const versions = (VERSIONS_BY_GOAL_ID[goalId] ?? []).slice().reverse();

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col gap-0">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <SheetTitle className="text-sm font-semibold leading-snug line-clamp-2">
            {goalTitle}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Version History</p>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No version history available.
              </p>
            ) : (
              <ol className="relative border-l-2 border-muted ml-2.5 space-y-8">
                {versions.map((v, i) => {
                  const prevVersion = versions[i + 1]; // one version older
                  const role = inferRole(v.changedBy);
                  const isLatest = i === 0;

                  return (
                    <li key={v.id} className="relative ml-6">
                      {/* Timeline dot */}
                      <span
                        className={cn(
                          "absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-background",
                          isLatest
                            ? "bg-indigo-600 ring-2 ring-indigo-200"
                            : "bg-muted ring-1 ring-muted-foreground/20"
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            isLatest ? "bg-white" : "bg-muted-foreground/50"
                          )}
                        />
                      </span>

                      {/* Header row */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono h-4 px-1.5"
                        >
                          v{v.versionNumber}
                        </Badge>
                        <span className="text-xs font-semibold">
                          {v.changedByName}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-4",
                            getRoleColor(role)
                          )}
                        >
                          {getRoleDisplayName(role)}
                        </Badge>
                      </div>

                      {/* Timestamp */}
                      <time className="text-[11px] text-muted-foreground">
                        {formatDateTime(v.snapshotAt)}
                      </time>

                      {/* Change reason */}
                      {v.changeReason && (
                        <blockquote className="mt-2 border-l-2 border-indigo-300 pl-3 text-xs text-muted-foreground italic leading-snug">
                          "{v.changeReason}"
                        </blockquote>
                      )}

                      {/* Diff vs previous version */}
                      {prevVersion ? (
                        <VersionDiff prev={prevVersion} curr={v} />
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Initial version — created by {v.changedByName}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
