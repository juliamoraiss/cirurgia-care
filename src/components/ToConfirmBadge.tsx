import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Selo para cirurgias com data proposta, ainda aguardando confirmação. */
export function ToConfirmBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 shrink-0 rounded-full border border-dashed border-amber-500 px-1.5 py-px text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10",
        className
      )}
    >
      <HelpCircle className="h-3 w-3" />
      A confirmar
    </span>
  );
}
