interface CooldownCircleProps {
  turnsRemaining: number; // How many turns until ability is ready
  totalCooldown: number; // Total cooldown duration
  className?: string;
}

export function CooldownCircle({ turnsRemaining, totalCooldown, className = "" }: CooldownCircleProps) {
  if (turnsRemaining <= 0 || totalCooldown <= 0) {
    return null; // Don't show if no cooldown
  }

  // Calculate the progress (0-1)
  // When just used, turnsRemaining = totalCooldown, progress = 1 (full circle)
  // As turns pass, turnsRemaining decreases, progress decreases
  const progress = turnsRemaining / totalCooldown;
  
  // SVG circle parameters
  const size = 48;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke dash offset to create the "missing sector" effect
  // When progress = 1 (full cooldown), offset = 0 (full circle)
  // When progress = 0 (ready), offset = circumference (empty circle, but we don't show this)
  const offset = circumference * (1 - progress);

  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle (faint) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted opacity-20"
        />
        
        {/* Progress circle (shows remaining cooldown) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-muted-foreground"
        />
      </svg>
      
      {/* Turns remaining text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-muted-foreground">{turnsRemaining}</span>
      </div>
    </div>
  );
}
