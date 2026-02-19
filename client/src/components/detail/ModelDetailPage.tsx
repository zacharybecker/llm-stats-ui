import { useParams } from "react-router-dom";
import { useModelById } from "@/hooks/useModels";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/shared/LoadingState";
import { ProviderBadge, CapabilityBadges } from "@/components/shared/ProviderBadge";
import { formatPrice, formatNumber } from "@/lib/utils";

export function ModelDetailPage() {
  const { "*": splat } = useParams();
  const modelId = splat ? decodeURIComponent(splat) : "";
  const { data: model, isLoading, error, refetch } = useModelById(modelId);

  if (isLoading) return <LoadingState />;
  if (error || !model) return <ErrorState message="Model not found" onRetry={() => refetch()} />;

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
              {model.pricing.image_input && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Image Input</span>
                  <span className="font-medium">${model.pricing.image_input.toFixed(6)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
