import { useState, useMemo } from "react";
import { usePricing } from "@/hooks/useModels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState, ErrorState } from "@/components/shared/LoadingState";
import { ProviderBadge } from "@/components/shared/ProviderBadge";
import { formatPrice } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Link } from "react-router-dom";
import { MergedModel } from "@/types/models";

function CostCalculator({ models }: { models: MergedModel[] }) {
  const [inputTokens, setInputTokens] = useState(1000);
  const [outputTokens, setOutputTokens] = useState(500);
  const [requests, setRequests] = useState(1000);

  const costs = useMemo(() => {
    return models
      .filter((m) => m.pricing.input_per_million !== null && m.pricing.output_per_million !== null)
      .map((m) => {
        const inputCost = ((inputTokens * requests) / 1_000_000) * (m.pricing.input_per_million || 0);
        const outputCost = ((outputTokens * requests) / 1_000_000) * (m.pricing.output_per_million || 0);
        return { model: m, inputCost, outputCost, totalCost: inputCost + outputCost };
      })
      .sort((a, b) => a.totalCost - b.totalCost)
      .slice(0, 20);
  }, [models, inputTokens, outputTokens, requests]);

  const chartData = costs.slice(0, 10).map((c) => ({
    name: c.model.name.length > 18 ? c.model.name.slice(0, 18) + "..." : c.model.name,
    input: parseFloat(c.inputCost.toFixed(4)),
    output: parseFloat(c.outputCost.toFixed(4)),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cost Calculator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Input tokens per request</label>
              <Input
                type="number"
                value={inputTokens}
                onChange={(e) => setInputTokens(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Output tokens per request</label>
              <Input
                type="number"
                value={outputTokens}
                onChange={(e) => setOutputTokens(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Number of requests</label>
              <Input
                type="number"
                value={requests}
                onChange={(e) => setRequests(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cost Comparison (Top 10 Cheapest)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
                <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
                <Legend />
                <Bar dataKey="input" stackId="a" fill="#6366f1" name="Input Cost" />
                <Bar dataKey="output" stackId="a" fill="#14b8a6" name="Output Cost" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {costs.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Input Cost</TableHead>
                <TableHead className="text-right">Output Cost</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((c) => (
                <TableRow key={c.model.id}>
                  <TableCell>
                    <Link to={`/models/${encodeURIComponent(c.model.id)}`} className="font-medium text-primary hover:underline">
                      {c.model.name}
                    </Link>
                  </TableCell>
                  <TableCell><ProviderBadge provider={c.model.provider} /></TableCell>
                  <TableCell className="text-right">${c.inputCost.toFixed(4)}</TableCell>
                  <TableCell className="text-right">${c.outputCost.toFixed(4)}</TableCell>
                  <TableCell className="text-right font-medium">${c.totalCost.toFixed(4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function PricingPage() {
  const [sortField, setSortField] = useState<"input" | "output">("input");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { data, isLoading, error, refetch } = usePricing({ sort: `${sortField}:${sortDir}` });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load pricing" onRetry={() => refetch()} />;

  const models = data?.data || [];

  const toggleSort = (field: "input" | "output") => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground">Compare model pricing and estimate costs</p>
      </div>

      <CostCalculator models={models} />

      <Card>
        <CardHeader>
          <CardTitle>All Pricing (per 1M tokens)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("input")}
                  >
                    Input $/1M {sortField === "input" && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("output")}
                  >
                    Output $/1M {sortField === "output" && (sortDir === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.slice(0, 100).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link to={`/models/${encodeURIComponent(m.id)}`} className="font-medium text-primary hover:underline">
                        {m.name}
                      </Link>
                    </TableCell>
                    <TableCell><ProviderBadge provider={m.provider} /></TableCell>
                    <TableCell className="text-right">{formatPrice(m.pricing.input_per_million)}</TableCell>
                    <TableCell className="text-right">{formatPrice(m.pricing.output_per_million)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">{m.pricing.price_source || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
