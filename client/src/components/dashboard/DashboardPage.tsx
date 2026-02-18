import { useModels } from "@/hooks/useModels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/shared/LoadingState";
import { ProviderBadge, CapabilityBadges } from "@/components/shared/ProviderBadge";
import { formatPrice, formatContextLength } from "@/lib/utils";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MergedModel } from "@/types/models";

function StatsOverview({ models }: { models: MergedModel[] }) {
  const configured = models.filter((m) => m.is_configured);
  const withPricing = models.filter((m) => m.pricing.input_per_million !== null);
  const avgInput = withPricing.length > 0
    ? withPricing.reduce((s, m) => s + (m.pricing.input_per_million || 0), 0) / withPricing.length
    : 0;
  const maxContext = Math.max(...models.map((m) => m.context_length || 0));
  const providers = new Set(models.map((m) => m.provider));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Models</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{models.length}</div>
          <p className="text-xs text-muted-foreground">{configured.length} configured in LiteLLM</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Input Price</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPrice(avgInput)}</div>
          <p className="text-xs text-muted-foreground">per 1M tokens</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Largest Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatContextLength(maxContext)}</div>
          <p className="text-xs text-muted-foreground">tokens</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{providers.size}</div>
          <p className="text-xs text-muted-foreground">unique providers</p>
        </CardContent>
      </Card>
    </div>
  );
}

function TopModelsChart({ models }: { models: MergedModel[] }) {
  const topModels = models
    .filter((m) => m.benchmarks.arena_elo !== null)
    .sort((a, b) => (b.benchmarks.arena_elo || 0) - (a.benchmarks.arena_elo || 0))
    .slice(0, 15)
    .map((m) => ({
      name: m.name.length > 20 ? m.name.slice(0, 20) + "..." : m.name,
      elo: m.benchmarks.arena_elo,
    }));

  if (topModels.length === 0) return null;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Top Models by Arena Elo</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={topModels} layout="vertical" margin={{ left: 120 }}>
            <XAxis type="number" domain={['dataMin - 50', 'dataMax + 10']} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="elo" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ModelCard({ model }: { model: MergedModel }) {
  return (
    <Link to={`/models/${encodeURIComponent(model.id)}`}>
      <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{model.name}</CardTitle>
            <ProviderBadge provider={model.provider} />
          </div>
          {model.is_configured && (
            <Badge variant="outline" className="w-fit text-xs">Configured</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Context:</span>{" "}
              <span className="font-medium">{formatContextLength(model.context_length)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Input:</span>{" "}
              <span className="font-medium">{formatPrice(model.pricing.input_per_million)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Output:</span>{" "}
              <span className="font-medium">{formatPrice(model.pricing.output_per_million)}</span>
            </div>
            {model.benchmarks.arena_elo && (
              <div>
                <span className="text-muted-foreground">Elo:</span>{" "}
                <span className="font-medium">{model.benchmarks.arena_elo}</span>
              </div>
            )}
          </div>
          <CapabilityBadges capabilities={model.capabilities} />
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useModels();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load models" onRetry={() => refetch()} />;

  const models = data?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of all available LLM models</p>
      </div>

      <StatsOverview models={models} />
      <TopModelsChart models={models} />

      <div>
        <h2 className="text-xl font-semibold mb-4">
          Configured Models ({models.filter((m) => m.is_configured).length})
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {models
            .filter((m) => m.is_configured)
            .slice(0, 20)
            .map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
        </div>
      </div>

      {models.filter((m) => !m.is_configured).length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">All Available Models</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {models
              .filter((m) => !m.is_configured)
              .sort((a, b) => (b.benchmarks.arena_elo || 0) - (a.benchmarks.arena_elo || 0))
              .slice(0, 20)
              .map((model) => (
                <ModelCard key={model.id} model={model} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
