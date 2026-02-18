import { useParams } from "react-router-dom";
import { useModelById } from "@/hooks/useModels";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/shared/LoadingState";
import { ProviderBadge, CapabilityBadges } from "@/components/shared/ProviderBadge";
import { formatPrice, formatContextLength } from "@/lib/utils";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

export function ModelDetailPage() {
  const { "*": splat } = useParams();
  const modelId = splat ? decodeURIComponent(splat) : "";
  const { data: model, isLoading, error, refetch } = useModelById(modelId);

  if (isLoading) return <LoadingState />;
  if (error || !model) return <ErrorState message="Model not found" onRetry={() => refetch()} />;

  const radarData = [
    { metric: "MMLU-PRO", value: model.benchmarks.ollm_mmlu_pro || 0, fullMark: 100 },
    { metric: "GPQA", value: model.benchmarks.ollm_gpqa || 0, fullMark: 100 },
    { metric: "MATH", value: model.benchmarks.ollm_math || 0, fullMark: 100 },
    { metric: "BBH", value: model.benchmarks.ollm_bbh || 0, fullMark: 100 },
  ].filter((d) => d.value > 0);

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
                <p className="font-medium text-lg">{formatContextLength(model.context_length)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Max Output</span>
                <p className="font-medium text-lg">{formatContextLength(model.max_output_tokens)}</p>
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

      {/* Benchmarks */}
      <Card>
        <CardHeader>
          <CardTitle>Benchmarks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              {model.benchmarks.arena_elo && (
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                  <span className="font-medium">Arena Elo</span>
                  <span className="text-2xl font-bold">{model.benchmarks.arena_elo}</span>
                </div>
              )}
              {model.benchmarks.ollm_average && (
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                  <span className="font-medium">OLLM Average</span>
                  <span className="text-xl font-bold">{model.benchmarks.ollm_average.toFixed(1)}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {model.benchmarks.ollm_mmlu_pro != null && (
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">MMLU-PRO</span>
                    <p className="font-medium">{model.benchmarks.ollm_mmlu_pro.toFixed(1)}</p>
                  </div>
                )}
                {model.benchmarks.ollm_gpqa != null && (
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">GPQA</span>
                    <p className="font-medium">{model.benchmarks.ollm_gpqa.toFixed(1)}</p>
                  </div>
                )}
                {model.benchmarks.ollm_math != null && (
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">MATH</span>
                    <p className="font-medium">{model.benchmarks.ollm_math.toFixed(1)}</p>
                  </div>
                )}
                {model.benchmarks.ollm_bbh != null && (
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">BBH</span>
                    <p className="font-medium">{model.benchmarks.ollm_bbh.toFixed(1)}</p>
                  </div>
                )}
              </div>

              {model.benchmarks.arena_categories && Object.keys(model.benchmarks.arena_categories).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Arena Categories</h4>
                  {Object.entries(model.benchmarks.arena_categories).map(([cat, elo]) => (
                    <div key={cat} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground capitalize">{cat}</span>
                      <span className="font-mono">{elo}</span>
                    </div>
                  ))}
                </div>
              )}

              {!model.benchmarks.arena_elo && !model.benchmarks.ollm_average && (
                <p className="text-muted-foreground text-sm">No benchmark data available for this model.</p>
              )}
            </div>

            {radarData.length >= 3 && (
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis domain={[0, 100]} />
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
