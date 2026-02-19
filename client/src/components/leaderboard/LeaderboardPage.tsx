import { useState, useMemo } from "react";
import { useBenchmarks } from "@/hooks/useModels";
import { useShowAllModels } from "@/hooks/useSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState, ErrorState, WarningBanner } from "@/components/shared/LoadingState";
import { ProviderBadge } from "@/components/shared/ProviderBadge";
import { Link } from "react-router-dom";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { MergedModel, ArenaScore } from "@/types/models";
import { Button } from "@/components/ui/button";

const CHART_COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#eab308",
  "#ec4899",
];

type CategoryKey = 'text' | 'code' | 'vision';

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  text: 'Text',
  code: 'Code',
  vision: 'Vision',
};

function getArenaScore(model: MergedModel, category: CategoryKey): ArenaScore | null {
  const key = `arena_${category.replace('-', '_')}` as keyof typeof model.benchmarks;
  return model.benchmarks[key];
}

function CategoryTab({ category }: { category: CategoryKey }) {
  const [showAllModels] = useShowAllModels();
  const { data, isLoading, error, refetch } = useBenchmarks({ category, include_unconfigured: showAllModels });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={`Failed to load ${CATEGORY_LABELS[category]} arena data`} onRetry={() => refetch()} />;

  const models = data?.data || [];
  const warnings = data?.warnings || [];

  return (
    <div className="space-y-4">
      <WarningBanner warnings={warnings} />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right">CI</TableHead>
              <TableHead className="text-right">Votes</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.slice(0, 50).map((m) => {
              const score = getArenaScore(m, category);
              if (!score) return null;
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-muted-foreground">{score.rank}</TableCell>
                  <TableCell>
                    <Link to={`/models/${encodeURIComponent(m.id)}`} className="font-medium text-primary hover:underline">
                      {m.name}
                    </Link>
                  </TableCell>
                  <TableCell><ProviderBadge provider={m.provider} /></TableCell>
                  <TableCell className="text-right font-mono">{Math.round(score.rating)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground text-xs">
                    +{Math.round(score.rating_upper - score.rating)}/-{Math.round(score.rating - score.rating_lower)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{score.votes.toLocaleString()}</TableCell>
                  <TableCell>
                    {m.is_configured ? (
                      <span className="text-green-600 dark:text-green-400 text-sm">Configured</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Available</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {models.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No {CATEGORY_LABELS[category]} arena data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CompareTab() {
  const [showAllModels] = useShowAllModels();
  const { data, isLoading, error, refetch } = useBenchmarks({ category: "all", include_unconfigured: showAllModels });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const models = data?.data || [];

  const toggleModel = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const selected = models.filter((m) => selectedIds.includes(m.id));

  const radarData = useMemo(() => {
    if (selected.length === 0) return [];
    const categories: { key: CategoryKey; label: string }[] = [
      { key: "text", label: "Text" },
      { key: "code", label: "Code" },
      { key: "vision", label: "Vision" },
    ];
    return categories.map((cat) => {
      const point: Record<string, string | number> = { metric: cat.label };
      for (const m of selected) {
        const score = getArenaScore(m, cat.key);
        point[m.name] = score?.rating ?? 0;
      }
      return point;
    });
  }, [selected]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load arena data" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Select Models to Compare (max 5)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {models
              .filter((m) =>
                m.benchmarks.arena_text !== null ||
                m.benchmarks.arena_code !== null ||
                m.benchmarks.arena_vision !== null
              )
              .slice(0, 30)
              .map((m) => (
                <Button
                  key={m.id}
                  variant={selectedIds.includes(m.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleModel(m.id)}
                >
                  {m.name}
                </Button>
              ))}
          </div>
        </CardContent>
      </Card>

      {selected.length >= 2 && radarData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arena Rating Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis />
                <Tooltip />
                <Legend />
                {selected.map((m, i) => (
                  <Radar
                    key={m.id}
                    name={m.name}
                    dataKey={m.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={0.15}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {selected.length >= 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Model Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    {selected.map((m) => (
                      <TableHead key={m.id} className="text-center">{m.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {([
                    ["Text Rating", (m: MergedModel) => m.benchmarks.arena_text?.rating ? Math.round(m.benchmarks.arena_text.rating) : "-"],
                    ["Code Rating", (m: MergedModel) => m.benchmarks.arena_code?.rating ? Math.round(m.benchmarks.arena_code.rating) : "-"],
                    ["Vision Rating", (m: MergedModel) => m.benchmarks.arena_vision?.rating ? Math.round(m.benchmarks.arena_vision.rating) : "-"],

                    ["Input $/1M", (m: MergedModel) => m.pricing.input_per_million != null ? `$${m.pricing.input_per_million.toFixed(2)}` : "-"],
                    ["Output $/1M", (m: MergedModel) => m.pricing.output_per_million != null ? `$${m.pricing.output_per_million.toFixed(2)}` : "-"],
                  ] as [string, (m: MergedModel) => string | number][]).map(([label, getValue]) => (
                    <TableRow key={label}>
                      <TableCell className="font-medium">{label}</TableCell>
                      {selected.map((m) => (
                        <TableCell key={m.id} className="text-center font-mono">{getValue(m)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground">LMArena rankings across task categories</p>
      </div>

      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="vision">Vision</TabsTrigger>

          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>
        <TabsContent value="text"><CategoryTab category="text" /></TabsContent>
        <TabsContent value="code"><CategoryTab category="code" /></TabsContent>
        <TabsContent value="vision"><CategoryTab category="vision" /></TabsContent>

        <TabsContent value="compare"><CompareTab /></TabsContent>
      </Tabs>
    </div>
  );
}
