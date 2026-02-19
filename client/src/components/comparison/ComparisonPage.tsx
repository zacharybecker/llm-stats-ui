import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useModels } from "@/hooks/useModels";
import { useShowAllModels } from "@/hooks/useSettings";
import { MergedModel } from "@/types/models";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, WarningBanner } from "@/components/shared/LoadingState";
import { ProviderBadge, CapabilityBadges } from "@/components/shared/ProviderBadge";
import { formatPrice, formatNumber } from "@/lib/utils";
import { Link } from "react-router-dom";

const columnHelper = createColumnHelper<MergedModel>();

const columns = [
  columnHelper.accessor("name", {
    header: "Model",
    cell: (info) => (
      <Link
        to={`/models/${encodeURIComponent(info.row.original.id)}`}
        className="font-medium text-primary hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("provider", {
    header: "Provider",
    cell: (info) => <ProviderBadge provider={info.getValue()} />,
  }),
  columnHelper.accessor("context_length", {
    header: "Context",
    cell: (info) => formatNumber(info.getValue()),
  }),
  columnHelper.accessor("pricing.input_per_million", {
    header: "Input $/1M",
    cell: (info) => formatPrice(info.getValue()),
    sortingFn: "basic",
  }),
  columnHelper.accessor("pricing.output_per_million", {
    header: "Output $/1M",
    cell: (info) => formatPrice(info.getValue()),
    sortingFn: "basic",
  }),
  columnHelper.accessor("is_configured", {
    header: "Status",
    cell: (info) =>
      info.getValue() ? (
        <Badge variant="outline" className="text-green-700 border-green-300 dark:text-green-400 dark:border-green-700">Configured</Badge>
      ) : (
        <Badge variant="secondary">Available</Badge>
      ),
  }),
  columnHelper.display({
    id: "capabilities",
    header: "Capabilities",
    cell: (info) => (
      <CapabilityBadges capabilities={info.row.original.capabilities} size="sm" />
    ),
  }),
];

export function ComparisonPage() {
  const [showAllModels] = useShowAllModels();
  const { data, isLoading, error, refetch } = useModels({ include_unconfigured: showAllModels });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showConfiguredOnly, setShowConfiguredOnly] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");

  const models = useMemo(() => {
    let m = data?.data || [];
    if (showConfiguredOnly) m = m.filter((model) => model.is_configured);
    if (selectedProvider) m = m.filter((model) => model.provider === selectedProvider);
    return m;
  }, [data, showConfiguredOnly, selectedProvider]);

  const providers = useMemo(() => {
    const all = data?.data || [];
    return [...new Set(all.map((m) => m.provider))].sort();
  }, [data]);

  const table = useReactTable({
    data: models,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load models" onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Model Comparison</h1>
        <p className="text-muted-foreground">Compare models across all dimensions</p>
      </div>

      <WarningBanner warnings={data?.warnings || []} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search models..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <Button
          variant={showConfiguredOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowConfiguredOnly(!showConfiguredOnly)}
        >
          Configured Only
        </Button>
        <span className="flex items-center text-sm text-muted-foreground">
          {table.getRowModel().rows.length} models
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " ↑"}
                      {header.column.getIsSorted() === "desc" && " ↓"}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No models found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
