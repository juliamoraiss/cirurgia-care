import { useState, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface CollapsibleCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleCard({
  icon: Icon,
  iconClassName = "text-primary",
  title,
  headerRight,
  children,
  defaultOpen = false,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="px-4 py-3 cursor-pointer select-none"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 shrink-0 ${iconClassName}`} />
          <CardTitle className="text-sm font-semibold flex-1 min-w-0">
            {title}
          </CardTitle>
          {headerRight && (
            <div className="shrink-0">{headerRight}</div>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </CardHeader>
      <div
        className={`grid transition-all duration-200 ease-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
        </div>
      </div>
    </Card>
  );
}
