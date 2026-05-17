import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { UoMSelector } from "./UoMSelector";
import { ThrustArea, UoMType } from "@/types/goal.types";
import { formatThrustArea } from "@/utils/format.util";
import { cn } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const goalFormSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be at most 200 characters"),
    description: z.string().max(500, "Description must be at most 500 characters").optional(),
    thrustArea: z.string().min(1, "Please select a thrust area"),
    uomType: z.string().min(1, "Please select a measurement type"),
    targetValue: z.coerce.number().positive("Target value must be positive").optional(),
    targetDate: z.string().optional(),
    weightage: z.coerce
      .number()
      .int("Weightage must be a whole number")
      .min(5, "Minimum weightage is 5%")
      .max(100, "Maximum weightage is 100%"),
  })
  .superRefine((data, ctx) => {
    if (data.uomType === UoMType.TIMELINE) {
      if (!data.targetDate) {
        ctx.addIssue({
          code: "custom",
          message: "Please select a target date",
          path: ["targetDate"],
        });
      }
    } else if (data.uomType !== UoMType.ZERO) {
      if (data.targetValue === undefined || data.targetValue === null) {
        ctx.addIssue({
          code: "custom",
          message: "Please enter a target value",
          path: ["targetValue"],
        });
      }
    }
  });

export type GoalFormData = z.infer<typeof goalFormSchema>;

// ─── Thrust area options ──────────────────────────────────────────────────────

const THRUST_AREA_OPTIONS = Object.values(ThrustArea).map((value) => ({
  value,
  label: formatThrustArea(value),
}));

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  readonly mode: "create" | "edit";
  readonly defaultValues?: Partial<GoalFormData>;
  readonly remainingWeightage: number;
  readonly onSubmit: (data: GoalFormData) => void;
  readonly onCancel: () => void;
  readonly isLoading?: boolean;
}

// ─── ThrustArea combobox ──────────────────────────────────────────────────────

interface ThrustAreaFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}

function ThrustAreaField({ value, onChange, disabled }: ThrustAreaFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = THRUST_AREA_OPTIONS.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-9 text-sm",
            !selected && "text-muted-foreground"
          )}
        >
          {selected ? selected.label : "Select thrust area…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search thrust area…" className="h-9" />
          <CommandList>
            <CommandEmpty>No thrust area found.</CommandEmpty>
            <CommandGroup>
              {THRUST_AREA_OPTIONS.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Date picker ──────────────────────────────────────────────────────────────

interface DateFieldProps {
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
}

function DateField({ value, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start font-normal h-9 text-sm",
            !selectedDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "dd MMM yyyy") : "Pick a date…"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) {
              onChange(date.toISOString().split("T")[0]);
              setOpen(false);
            }
          }}
          disabled={(date) => date < new Date()}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Weightage hint ───────────────────────────────────────────────────────────

interface WeightageHintProps {
  readonly remainingWeightage: number;
  readonly currentWeightage: number | undefined;
  readonly mode: "create" | "edit";
}

function WeightageHint({ remainingWeightage, currentWeightage, mode }: WeightageHintProps) {
  const effectiveRemaining =
    mode === "edit" && currentWeightage !== undefined
      ? remainingWeightage + currentWeightage
      : remainingWeightage;

  if (effectiveRemaining <= 0) {
    return (
      <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" />
        No weightage remaining — free up space first.
      </p>
    );
  }

  let colorClass = "text-emerald-600";
  if (effectiveRemaining < 10) colorClass = "text-amber-600";

  return (
    <p className={cn("text-xs mt-1", colorClass)}>
      {effectiveRemaining}% remaining to allocate
    </p>
  );
}

// ─── GoalForm ─────────────────────────────────────────────────────────────────

export function GoalForm({
  mode,
  defaultValues,
  remainingWeightage,
  onSubmit,
  onCancel,
  isLoading = false,
}: Props) {
  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema) as Resolver<GoalFormData>,
    defaultValues: {
      title: "",
      description: "",
      thrustArea: "",
      uomType: UoMType.MIN,
      targetValue: undefined,
      targetDate: undefined,
      weightage: Math.min(20, Math.max(5, remainingWeightage)),
      ...defaultValues,
    },
  });

  const watchedUomType = form.watch("uomType");
  const watchedTitle = form.watch("title") ?? "";
  const watchedDescription = form.watch("description") ?? "";
  const editBuffer = mode === "edit" ? (defaultValues?.weightage ?? 0) : 0;
  const isOverWeightage = (form.watch("weightage") ?? 0) > remainingWeightage + editBuffer;

  const showTargetValue =
    watchedUomType !== UoMType.TIMELINE && watchedUomType !== UoMType.ZERO;
  const showTargetDate = watchedUomType === UoMType.TIMELINE;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Section 1: Identity ─────────────────────────────────────── */}

        {/* Thrust area */}
        <FormField
          control={form.control}
          name="thrustArea"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Thrust Area</FormLabel>
              <FormControl>
                <ThrustAreaField
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Goal Title</FormLabel>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    watchedTitle.length > 180
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  )}
                >
                  {watchedTitle.length}/200
                </span>
              </div>
              <FormControl>
                <Input
                  placeholder="e.g. Achieve ₹50L in Q1 sales revenue"
                  maxLength={200}
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="text-muted-foreground font-normal">
                  Description{" "}
                  <span className="text-[10px]">(optional)</span>
                </FormLabel>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    watchedDescription.length > 450
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  )}
                >
                  {watchedDescription.length}/500
                </span>
              </div>
              <FormControl>
                <Textarea
                  placeholder="Brief context or success criteria…"
                  rows={2}
                  maxLength={500}
                  className="resize-none text-sm"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Section 2: Measurement ──────────────────────────────────── */}

        {/* UoM type selector */}
        <FormField
          control={form.control}
          name="uomType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Measurement Type</FormLabel>
              <FormControl>
                <UoMSelector
                  value={field.value as UoMType}
                  onChange={field.onChange}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Target value — hidden for TIMELINE and ZERO */}
        {showTargetValue && (
          <FormField
            control={form.control}
            name="targetValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Value</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    placeholder={
                      watchedUomType === UoMType.MIN
                        ? "e.g. 50 (for ₹50 Lakhs)"
                        : "e.g. 2 (for 2 days)"
                    }
                    disabled={isLoading}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : e.target.value
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Target date — only for TIMELINE */}
        {showTargetDate && (
          <FormField
            control={form.control}
            name="targetDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Date</FormLabel>
                <FormControl>
                  <DateField
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Weightage */}
        <FormField
          control={form.control}
          name="weightage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Weightage (%)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={5}
                  max={100}
                  step={5}
                  placeholder="e.g. 20"
                  disabled={isLoading}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <WeightageHint
                remainingWeightage={remainingWeightage}
                currentWeightage={mode === "edit" ? defaultValues?.weightage : undefined}
                mode={mode}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Actions ─────────────────────────────────────────────────── */}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={isLoading || isOverWeightage}
          >
            {isLoading ? "Saving…" : mode === "create" ? "Add Goal" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
