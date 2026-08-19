import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartThemeGradient,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const barConfig = {
  rate: { label: "Calls", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function CallVolumeChart({
  byHour,
  gradientId = "call-volume-fill",
}: {
  byHour: Record<string, number>;
  gradientId?: string;
}) {
  const data = useMemo(
    () =>
      Object.entries(byHour)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([hour, count]) => ({ hour: `${hour}:00`, rate: count })),
    [byHour],
  );

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-sm font-semibold">Call volume by hour of day</p>
      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
          No calls in this period
        </div>
      ) : (
        <ChartContainer config={barConfig} className={`h-[220px] w-full`}>
          <BarChart data={data}>
            <defs>
              <ChartThemeGradient id={gradientId} />
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} width={28} tick={{ fontSize: 11 }} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="rate" fill={`url(#${gradientId})`} radius={[6, 6, 2, 2]} maxBarSize={28} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
