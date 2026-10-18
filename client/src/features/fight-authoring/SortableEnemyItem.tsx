import { RecoloredSprite } from "@/components/RecoloredSprite";
import { Button } from "@/components/ui/button";
import {
useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { enemyImage } from "@shared/combat/encounters";
import { ENEMY_ROLE_LABELS } from "@shared/encounter-tiers";
import { type Enemy } from "@shared/schema";
import { Edit,GripVertical,Trash2 } from "lucide-react";



interface SortableEnemyItemProps {
  enemy: Enemy;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function SortableEnemyItem({ enemy, index, onEdit, onDelete }: SortableEnemyItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: enemy.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 border border-border rounded-md bg-card"
      data-testid={`enemy-item-${index}`}
    >
      <div className="flex items-center gap-3 flex-1">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          data-testid={`button-drag-enemy-${index}`}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <RecoloredSprite src={enemyImage(enemy)} palette={enemy.palette} alt={enemy.name} className="w-12 h-12 object-cover rounded" />
        <div>
          <p className="font-medium">{enemy.name} × {enemy.quantity||1} · Wave {enemy.wave||index+1}</p>
          {enemy.swarm && <p className="text-xs text-muted-foreground">Swarm: +{enemy.swarm.enemiesPerFourPlayers} at 8 players and every 4 after</p>}
          <p className="text-sm text-muted-foreground">
            {enemy.role ? ENEMY_ROLE_LABELS[enemy.role] : `Legacy difficulty ${enemy.difficultyMultiplier}`}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onEdit}
          data-testid={`button-edit-enemy-${index}`}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          data-testid={`button-delete-enemy-${index}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

