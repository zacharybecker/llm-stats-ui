import { useState, useMemo } from "react";
import { useBenchmarks } from "@/hooks/useModels";
import { useShowAllModels } from "@/hooks/useSettings";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState, ErrorState, WarningBanner } from "@/components/shared/LoadingState";
import { Link } from "react-router-dom";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { MergedModel, ArenaScore } from "@/types/models";
import { getModelColor } from "@/lib/utils";

type CategoryKey = "text" | "code" | "vision";

const CATEGORY_OPTIONS: { value: CategoryKey; label: string }[] = [
  { value: "text", label: "Text Arena" },
  { value: "code", label: "Code Arena" },
  { value: "vision", label: "Vision Arena" },
];

interface ScatterPoint {
  id: string;
  name: string;
  provider: string;
  blendedPrice: number;
  rating: number;
  rank: number;
  votes: number;
  ci_upper: number;
  ci_lower: number;
  color: string;
}

function getArenaScore(model: MergedModel, category: CategoryKey): ArenaScore | null {
  const key = `arena_${category}` as keyof typeof model.benchmarks;
  return model.benchmarks[key];
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover p-3 text-popover-foreground shadow-md text-sm space-y-1">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground text-xs">by {d.provider}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
        <span className="text-muted-foreground">Rating</span>
        <span className="font-mono text-right">{Math.round(d.rating)}</span>
        <span className="text-muted-foreground">CI</span>
        <span className="font-mono text-right text-xs">
          +{Math.round(d.ci_upper - d.rating)}/−{Math.round(d.rating - d.ci_lower)}
        </span>
        <span className="text-muted-foreground">Price</span>
        <span className="font-mono text-right">${d.blendedPrice.toFixed(2)}/M</span>
        <span className="text-muted-foreground">Votes</span>
        <span className="font-mono text-right">{d.votes.toLocaleString()}</span>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const [category, setCategory] = useState<CategoryKey>("text");
  const [showAllModels] = useShowAllModels();
  const { data, isLoading, error, refetch } = useBenchmarks({
    category,
    include_unconfigured: showAllModels,
  });

  const models = data?.data || [];
  const warnings = data?.warnings || [];

  const { scatterData, rankedList } = useMemo(() => {
    const points: ScatterPoint[] = [];

    for (const m of models) {
      const score = getArenaScore(m, category);
      if (!score) continue;

      const input = m.pricing.input_per_million;
      const output = m.pricing.output_per_million;
      if (input == null || output == null) continue;

      const blendedPrice = (input + output) / 2;

      points.push({
        id: m.id,
        name: m.name,
        provider: m.provider,
        blendedPrice,
        rating: score.rating,
        rank: score.rank,
        votes: score.votes,
        ci_upper: score.rating_upper,
        ci_lower: score.rating_lower,
        color: "", // assigned after sorting
      });
    }

    // Sort by rating descending for ranked list
    const sorted = [...points].sort((a, b) => b.rating - a.rating);

    // Assign each model a unique color by its rank position
    sorted.forEach((p, i) => {
      p.color = getModelColor(i);
    });

    // Scatter data: exclude $0 (free) models
    const scatter = sorted.filter((p) => p.blendedPrice > 0);

    return { scatterData: scatter, rankedList: sorted.slice(0, 20) };
  }, [models, category]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load arena data" onRetry={() => refetch()} />;

  const leftColumn = rankedList.slice(0, 10);
  const rightColumn = rankedList.slice(10, 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rankings</h1>
          <p className="text-muted-foreground">LMArena benchmark scores vs. model pricing</p>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryKey)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <WarningBanner warnings={warnings} />

      <Card>
        <CardContent className="pt-6">
          {/* Scatter Chart */}
          {scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  type="number"
                  dataKey="blendedPrice"
                  name="Price"
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  label={{ value: "Avg Price ($/M tokens)", position: "bottom", offset: 0, style: { fontSize: 12 } }}
                />
                <YAxis
                  type="number"
                  dataKey="rating"
                  name="Rating"
                  domain={["auto", "auto"]}
                  label={{ value: "Arena Rating", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 12 } }}
                />
                <ZAxis type="number" dataKey="votes" range={[60, 400]} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Scatter data={scatterData}>
                  {scatterData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No models with both arena scores and pricing data
            </div>
          )}

          {/* Ranked List */}
          {rankedList.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">
                Top {rankedList.length} — {CATEGORY_OPTIONS.find((o) => o.value === category)?.label}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                {[leftColumn, rightColumn].map((column, colIdx) => (
                  <div key={colIdx} className="space-y-0.5">
                    {column.map((entry, i) => {
                      const rank = colIdx * 10 + i + 1;
                      return (
                        <Link
                          key={entry.id}
                          to={`/models/${encodeURIComponent(entry.id)}`}
                          className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent transition-colors"
                        >
                          <span className="w-6 text-right text-sm font-mono text-muted-foreground">
                            {rank}
                          </span>
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="flex-1 min-w-0 truncate">
                            <span className="font-medium">{entry.name}</span>
                            <span className="text-muted-foreground text-xs ml-1.5">
                              by {entry.provider}
                            </span>
                          </span>
                          <span className="font-mono text-sm tabular-nums">
                            {Math.round(entry.rating)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
