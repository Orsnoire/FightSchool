interface MPBarProps {
  current: number;
  max: number;
  className?: string;
  showText?: boolean;
}

export function MPBar({ current, max, className = "", showText = true }: MPBarProps) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      <div className="relative h-4 bg-destructive/20 border border-card-border rounded-md overflow-hidden">
        <div
          className="h-full bg-mana transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
        {showText && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-white drop-shadow-lg" data-testid="text-mp">
              {current} / {max}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
