import { useParams } from "react-router-dom";
import { useModelById } from "@/hooks/useModels";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/shared/LoadingState";
import { ProviderBadge, CapabilityBadges } from "@/components/shared/ProviderBadge";
import { formatPrice, formatNumber } from "@/lib/utils";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { ArenaScore } from "@/types/models";

function ArenaCard({ label, score }: { label: string; score: ArenaScore | null }) {
  if (!score) return null;
  return (
    <div className="p-3 rounded-lg bg-muted space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-medium text-sm">{label}</span>
        <span className="text-xs text-muted-foreground">#{score.rank}</span>
      </div>
      <div className="text-2xl font-bold">{Math.round(score.rating)}</div>
      <div className="text-xs text-muted-foreground">
        CI: {Math.round(score.rating_lower)} - {Math.round(score.rating_upper)} | {score.votes.toLocaleString()} votes
      </div>
    </div>
  );
}

export function ModelDetailPage() {
  const { "*": splat } = useParams();
  const modelId = splat ? decodeURIComponent(splat) : "";
  const { data: model, isLoading, error, refetch } = useModelById(modelId);

  if (isLoading) return <LoadingState />;
  if (error || !model) return <ErrorState message="Model not found" onRetry={() => refetch()} />;

  const arenaCategories = [
    { key: "arena_text" as const, label: "Text", score: model.benchmarks.arena_text },
    { key: "arena_code" as const, label: "Code", score: model.benchmarks.arena_code },
    { key: "arena_vision" as const, label: "Vision", score: model.benchmarks.arena_vision },

  ];

  const radarData = arenaCategories
    .filter((c) => c.score !== null)
    .map((c) => ({
      metric: c.label,
      value: c.score!.rating,
    }));

  const hasAnyArena = arenaCategories.some((c) => c.score !== null);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
          <ProviderBadge provider={model.provider} />
          {model.is_configured && (
            <Badge variant="outline" className="text-green-700 border-green-300">Configured</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-mono">{model.id}</p>
        {model.description && (
          <p className="text-muted-foreground">{model.description}</p>
        )}
        <div className="flex gap-2 text-xs text-muted-foreground">
          Sources: {model.data_sources.join(", ")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle>Capabilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Context Length</span>
                <p className="font-medium text-lg">{formatNumber(model.context_length)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Max Output</span>
                <p className="font-medium text-lg">{formatNumber(model.max_output_tokens)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Modality</span>
                <p className="font-medium">{model.modality || "N/A"}</p>
              </div>
              {model.litellm_model_name && (
                <div>
                  <span className="text-muted-foreground">LiteLLM Name</span>
                  <p className="font-medium">{model.litellm_model_name}</p>
                </div>
              )}
            </div>
            <CapabilityBadges capabilities={model.capabilities} />
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Per 1 million tokens</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Input</span>
                <span className="text-xl font-bold">{formatPrice(model.pricing.input_per_million)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Output</span>
                <span className="text-xl font-bold">{formatPrice(model.pricing.output_per_million)}</span>
              </div>
              {model.pricing.cache_read_per_token && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cache Read</span>
                  <span className="font-medium">${model.pricing.cache_read_per_token.toFixed(8)}/token</span>
                </div>
              )}
              {model.pricing.image_input && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Image Input</span>
                  <span className="font-medium">${model.pricing.image_input.toFixed(6)}</span>
                </div>
              )}
              {model.pricing.price_source && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Price source: {model.pricing.price_source}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Arena Scores */}
      <Card>
        <CardHeader>
          <CardTitle>Arena Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              {arenaCategories.map((c) => (
                <ArenaCard key={c.key} label={c.label} score={c.score} />
              ))}

              {!hasAnyArena && (
                <p className="text-muted-foreground text-sm">No arena data available for this model.</p>
              )}
            </div>

            {radarData.length >= 2 && (
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis />
                    <Tooltip />
                    <Radar
                      name={model.name}
                      dataKey="value"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
