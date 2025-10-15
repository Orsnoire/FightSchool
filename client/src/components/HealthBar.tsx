interface HealthBarProps {
  current: number;
  max: number;
  className?: string;
  showText?: boolean;
}

export function HealthBar({ current, max, className = "", showText = true }: HealthBarProps) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  
  const getColorClass = () => {
    if (percentage > 60) return "bg-health";
    if (percentage > 30) return "bg-warning";
    return "bg-damage";
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative h-6 bg-card border border-card-border rounded-md overflow-hidden">
        <div
          className={`h-full ${getColorClass()} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
        {showText && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-white drop-shadow-lg" data-testid="text-health">
              {current} / {max}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
