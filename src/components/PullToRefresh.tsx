import { useState, useRef, useCallback, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export const PullToRefresh = ({ onRefresh, children, className }: PullToRefreshProps) => {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const threshold = 80;
  const maxPull = 120;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container || refreshing) return;
    
    // Only enable pull-to-refresh when scrolled to top
    if (container.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    setPulling(true);
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      setPulling(false);
      setPullDistance(0);
      return;
    }

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) {
      // Apply resistance to make pull feel natural
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, maxPull);
      setPullDistance(distance);
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    
    setPullDistance(0);
  }, [pulling, pullDistance, refreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-all duration-200 z-10 pointer-events-none",
          (pullDistance > 0 || refreshing) ? "opacity-100" : "opacity-0"
        )}
        style={{
          top: 0,
          height: refreshing ? 48 : pullDistance,
          transform: refreshing ? "translateY(0)" : undefined,
        }}
      >
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 backdrop-blur-sm transition-transform",
            refreshing && "animate-pulse"
          )}
          style={{
            transform: `rotate(${progress * 360}deg) scale(${0.5 + progress * 0.5})`,
          }}
        >
          <Loader2 
            className={cn(
              "h-5 w-5 text-primary",
              refreshing && "animate-spin"
            )} 
          />
        </div>
      </div>

      {/* Content with pull transform */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: pullDistance > 0 || refreshing 
            ? `translateY(${refreshing ? 48 : pullDistance}px)` 
            : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};
