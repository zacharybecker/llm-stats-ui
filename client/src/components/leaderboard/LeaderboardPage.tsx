import { useState, useMemo } from "react";
import { useBenchmarks } from "@/hooks/useModels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState, ErrorState } from "@/components/shared/LoadingState";
import { ProviderBadge } from "@/components/shared/ProviderBadge";
import { Link } from "react-router-dom";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { MergedModel } from "@/types/models";
import { Button } from "@/components/ui/button";

const CHART_COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#eab308",
  "#ec4899",
];

function ArenaTab() {
  const { data, isLoading, error, refetch } = useBenchmarks({ source: "arena" });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load arena data" onRetry={() => refetch()} />;

  const models = data?.data || [];

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Elo Rating</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.slice(0, 50).map((m, i) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Link to={`/models/${encodeURIComponent(m.id)}`} className="font-medium text-primary hover:underline">
                    {m.name}
                  </Link>
                </TableCell>
                <TableCell><ProviderBadge provider={m.provider} /></TableCell>
                <TableCell className="text-right font-mono">{m.benchmarks.arena_elo ?? "N/A"}</TableCell>
                <TableCell>
                  {m.is_configured ? (
                    <span className="text-green-600 dark:text-green-400 text-sm">Configured</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Available</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {models.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No arena data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function OpenLLMTab() {
  const { data, isLoading, error, refetch } = useBenchmarks({ source: "openllm" });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load benchmark data" onRetry={() => refetch()} />;

  const models = data?.data || [];

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead className="text-right">Average</TableHead>
            <TableHead className="text-right">MMLU-PRO</TableHead>
            <TableHead className="text-right">GPQA</TableHead>
            <TableHead className="text-right">MATH</TableHead>
            <TableHead className="text-right">BBH</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.slice(0, 50).map((m, i) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <Link to={`/models/${encodeURIComponent(m.id)}`} className="font-medium text-primary hover:underline">
                  {m.name}
                </Link>
              </TableCell>
              <TableCell><ProviderBadge provider={m.provider} /></TableCell>
              <TableCell className="text-right font-mono">{m.benchmarks.ollm_average?.toFixed(1) ?? "N/A"}</TableCell>
              <TableCell className="text-right font-mono">{m.benchmarks.ollm_mmlu_pro?.toFixed(1) ?? "-"}</TableCell>
              <TableCell className="text-right font-mono">{m.benchmarks.ollm_gpqa?.toFixed(1) ?? "-"}</TableCell>
              <TableCell className="text-right font-mono">{m.benchmarks.ollm_math?.toFixed(1) ?? "-"}</TableCell>
              <TableCell className="text-right font-mono">{m.benchmarks.ollm_bbh?.toFixed(1) ?? "-"}</TableCell>
            </TableRow>
          ))}
          {models.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                No benchmark data available
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CompareTab() {
  const { data, isLoading, error, refetch } = useBenchmarks({ source: "all" });
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
    const metrics = [
      { key: "ollm_mmlu_pro", label: "MMLU-PRO" },
      { key: "ollm_gpqa", label: "GPQA" },
      { key: "ollm_math", label: "MATH" },
      { key: "ollm_bbh", label: "BBH" },
    ];
    return metrics.map((metric) => {
      const point: Record<string, string | number> = { metric: metric.label };
      for (const m of selected) {
        const val = m.benchmarks[metric.key as keyof typeof m.benchmarks];
        point[m.name] = typeof val === "number" ? val : 0;
      }
      return point;
    });
  }, [selected]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load benchmark data" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Select Models to Compare (max 5)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {models
              .filter((m) => m.benchmarks.ollm_average !== null || m.benchmarks.arena_elo !== null)
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
            <CardTitle>Benchmark Comparison</CardTitle>
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
                  <TableRow>
                    <TableCell className="font-medium">Arena Elo</TableCell>
                    {selected.map((m) => (
                      <TableCell key={m.id} className="text-center font-mono">{m.benchmarks.arena_elo ?? "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">OLLM Average</TableCell>
                    {selected.map((m) => (
                      <TableCell key={m.id} className="text-center font-mono">{m.benchmarks.ollm_average?.toFixed(1) ?? "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">MMLU-PRO</TableCell>
                    {selected.map((m) => (
                      <TableCell key={m.id} className="text-center font-mono">{m.benchmarks.ollm_mmlu_pro?.toFixed(1) ?? "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">GPQA</TableCell>
                    {selected.map((m) => (
                      <TableCell key={m.id} className="text-center font-mono">{m.benchmarks.ollm_gpqa?.toFixed(1) ?? "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">MATH</TableCell>
                    {selected.map((m) => (
                      <TableCell key={m.id} className="text-center font-mono">{m.benchmarks.ollm_math?.toFixed(1) ?? "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Input $/1M</TableCell>
                    {selected.map((m) => (
                      <TableCell key={m.id} className="text-center font-mono">{m.pricing.input_per_million != null ? `$${m.pricing.input_per_million.toFixed(2)}` : "-"}</TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Output $/1M</TableCell>
                    {selected.map((m) => (
                      <TableCell key={m.id} className="text-center font-mono">{m.pricing.output_per_million != null ? `$${m.pricing.output_per_million.toFixed(2)}` : "-"}</TableCell>
                    ))}
                  </TableRow>
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
        <p className="text-muted-foreground">Model rankings from Arena and academic benchmarks</p>
      </div>

      <Tabs defaultValue="arena">
        <TabsList>
          <TabsTrigger value="arena">Chatbot Arena</TabsTrigger>
          <TabsTrigger value="openllm">Open LLM Leaderboard</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>
        <TabsContent value="arena"><ArenaTab /></TabsContent>
        <TabsContent value="openllm"><OpenLLMTab /></TabsContent>
        <TabsContent value="compare"><CompareTab /></TabsContent>
      </Tabs>
    </div>
  );
}
