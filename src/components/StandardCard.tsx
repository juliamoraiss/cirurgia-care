import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export interface CardInfo {
  icon: LucideIcon;
  label: string;
  value: string;
  highlighted?: boolean;
}

interface StandardCardProps {
  title: string;
  subtitle?: string;
  infos: CardInfo[];
  badge?: ReactNode;
  statusIcon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onClick?: () => void;
  className?: string;
  highlighted?: boolean;
}

export function StandardCard({
  title,
  subtitle,
  infos,
  badge,
  statusIcon,
  actionLabel = "Ver detalhes",
  onAction,
  onClick,
  className = "",
  highlighted = false,
}: StandardCardProps) {
  return (
    <Card 
      className={`cursor-pointer hover:bg-muted/50 transition-colors border shadow-none ${
        highlighted ? 'bg-success/5 border-success/30' : 'bg-card'
      } ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-3">
        {/* Header com título e badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            {statusIcon && (
              <div className="mt-0.5 shrink-0">
                {statusIcon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate">{title}</h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground/80 capitalize mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {badge && (
            <div className="shrink-0">
              {badge}
            </div>
          )}
        </div>

        {/* Informações em linhas fixas com ícones */}
        {infos.length > 0 && (
          <div className="space-y-2">
            {infos.map((info, index) => {
              const Icon = info.icon;
              return (
                <div 
                  key={index} 
                  className={`flex items-center gap-1.5 text-xs ${
                    info.highlighted ? 'font-semibold text-destructive' : 'text-muted-foreground/80'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    <span className="text-muted-foreground/60">{info.label}:</span> {info.value}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Botão de ação padrão no canto inferior direito */}
        {onAction && (
          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-3"
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
            >
              {actionLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
