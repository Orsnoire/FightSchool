interface ComboPointsProps {
  current: number;
  max: number;
  className?: string;
}

export function ComboPoints({ current, max, className = "" }: ComboPointsProps) {
  if (max === 0) return null;
  
  return (
    <div className={`flex gap-1 justify-center ${className}`} data-testid="combo-points">
      {Array.from({ length: max }, (_, index) => (
        <div
          key={index}
          className={`w-3 h-3 rounded-full border-2 transition-all ${
            index < current
              ? 'bg-mana border-mana shadow-sm shadow-mana/50'
              : 'bg-transparent border-muted'
          }`}
          data-testid={`combo-point-${index}`}
        />
      ))}
    </div>
  );
}
