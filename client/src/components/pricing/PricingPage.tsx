import { useState } from "react";
import { usePricing } from "@/hooks/useModels";
import { useShowAllModels } from "@/hooks/useSettings";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LoadingState, ErrorState, WarningBanner } from "@/components/shared/LoadingState";
import { ProviderBadge } from "@/components/shared/ProviderBadge";
import { formatPrice } from "@/lib/utils";
import { Link } from "react-router-dom";

export function PricingPage() {
  const [showAllModels] = useShowAllModels();
  const [sortField, setSortField] = useState<"input" | "output">("input");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const { data, isLoading, error, refetch } = usePricing({ sort: `${sortField}:${sortDir}`, include_unconfigured: showAllModels });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load pricing" onRetry={() => refetch()} />;

  const models = data?.data || [];
  const warnings = data?.warnings || [];

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
      <WarningBanner warnings={warnings} />

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
    </div>
  );
}
