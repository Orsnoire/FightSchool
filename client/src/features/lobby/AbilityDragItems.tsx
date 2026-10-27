import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ABILITY_DISPLAYS } from "@shared/abilityUI";
import { type Ability } from "@shared/jobSystem";
import { Heart, Lock, Shield, Sparkles, X } from "lucide-react";


// Ability icon components for drag-and-drop
export function AbilityIcon({ ability, isDragging = false }: { ability: Ability; isDragging?: boolean }) {
  const abilityDisplay = ABILITY_DISPLAYS[ability.id];
  if (!abilityDisplay) return null;

  const Icon = abilityDisplay.icon === "Sparkles" ? Sparkles :
    abilityDisplay.icon === "Shield" ? Shield :
      abilityDisplay.icon === "Heart" ? Heart :
        abilityDisplay.icon === "Flame" ? Sparkles : // Placeholder
          Sparkles; // Default

  return (
    <div className={`p-2 rounded-md bg-primary/20 flex items-center justify-center ${isDragging ? "opacity-50" : ""}`}>
      <Icon className="h-8 w-8 text-primary" />
    </div>
  );
}

export function DraggableAbility({ ability }: { ability: Ability }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ability-${ability.id}`,
    data: { ability },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                ref={setNodeRef}
                style={style}
                {...listeners}
                {...attributes}
                className="cursor-grab active:cursor-grabbing"
                data-testid={`draggable-ability-${ability.id}`}
              >
                <AbilityIcon ability={ability} isDragging={isDragging} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-semibold">{ability.name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => { }} disabled>
          <div className="max-w-xs">
            <p className="font-semibold">{ability.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{ability.description}</p>
          </div>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function AbilitySlot({
  slotNumber,
  equippedAbility,
  isLocked,
  onRemove,
}: {
  slotNumber: number;
  equippedAbility?: Ability;
  isLocked: boolean;
  onRemove: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotNumber}`,
  });

  const abilityDisplay = equippedAbility ? ABILITY_DISPLAYS[equippedAbility.id] : null;

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 border-2 rounded-md p-3 min-h-[120px] transition-all ${isOver ? "border-primary bg-primary/10 shadow-lg" : "border-border bg-card"
        }`}
      data-testid={`ability-slot-${slotNumber}`}
    >
      {isLocked ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Lock className="h-8 w-8 mb-2" />
          <p className="text-xs text-center">Locked</p>
        </div>
      ) : equippedAbility && abilityDisplay ? (
        <div className="relative h-full flex flex-col">
          <button
            onClick={onRemove}
            aria-label={`Remove ability from slot ${slotNumber}`}
            className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover-elevate active-elevate-2 z-10"
            data-testid={`button-remove-ability-${slotNumber}`}
          >
            <X className="h-3 w-3" />
          </button>
          <div className="flex items-start gap-2">
            <AbilityIcon ability={equippedAbility} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{equippedAbility.name}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {equippedAbility.description}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <div className="p-2 rounded-md border-2 border-dashed border-muted-foreground/30 mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-xs text-center">Drag ability here</p>
        </div>
      )}
    </div>
  );
}

