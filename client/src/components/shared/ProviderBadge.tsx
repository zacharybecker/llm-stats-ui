import { Badge } from "@/components/ui/badge";
import { getProviderColor } from "@/lib/utils";

export function ProviderBadge({ provider }: { provider: string }) {
  return (
    <Badge variant="secondary" className={getProviderColor(provider)}>
      {provider}
    </Badge>
  );
}

export function CapabilityBadges({ capabilities, size }: {
  capabilities: {
    vision: boolean;
    function_calling: boolean;
    reasoning: boolean;
    prompt_caching: boolean;
  };
  size?: "sm" | "default";
}) {
  const badges = [];
  if (capabilities.vision) badges.push({ label: "Vision", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" });
  if (capabilities.function_calling) badges.push({ label: "Tools", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" });
  if (capabilities.reasoning) badges.push({ label: "Reasoning", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" });
  if (capabilities.prompt_caching) badges.push({ label: "Caching", color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200" });

  if (badges.length === 0) return null;

  const sizeClass = size === "sm" ? "text-[11px] px-1.5 py-0" : "";

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <Badge key={b.label} variant="secondary" className={`${b.color} ${sizeClass}`}>
          {b.label}
        </Badge>
      ))}
    </div>
  );
}
