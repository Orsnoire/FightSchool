import { useToast } from "@/hooks/use-toast";
import {
KeyboardSensor,
PointerSensor,
useSensor,
useSensors,
type DragEndEvent
} from '@dnd-kit/core';
import {
arrayMove,
sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { enemyImage,GOBLIN_IMAGE } from "@shared/combat/encounters";
import { enemyAISchema,inferEnemyType } from "@shared/combat/enemy-ai";
import { ENEMY_CATALOG } from "@shared/combat/enemy-catalog";
import { enemyTuning } from "@shared/encounter-tiers";
import { type Enemy } from "@shared/schema";
import { useRef,useState } from "react";


import { resizeImage } from "./enemy-image";

/** Keeps enemy drafts and sorting stable when the authoring tabs unmount. */
export function useEnemyAuthoring(enemies: Enemy[], onChange: (enemies: Enemy[]) => void, encounterTier: number | null | undefined) {
  const { toast } = useToast();
  const [currentEnemy, setCurrentEnemy] = useState<Partial<Enemy>>({
    image: ENEMY_CATALOG.zombie.image,
    difficultyMultiplier: 10,
    role:"normal",
  });
  const [editingEnemyIndex, setEditingEnemyIndex] = useState<number | null>(null);
  const [uploadedEnemyImage, setUploadedEnemyImage] = useState<string | null>(null);
  const enemyImageInputRef = useRef<HTMLInputElement>(null);
  const handleEnemyImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    try {
      toast({ title: "Uploading image..." });
      const imageUrl = await resizeImage(file);
      setUploadedEnemyImage(imageUrl);
      setCurrentEnemy({ ...currentEnemy, image: imageUrl, species:"other" });
      toast({ title: "Image uploaded successfully (resized to 120x120px)" });
    } catch (error) {
      toast({ 
        title: "Failed to upload image", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    }
  };

  const addEnemy = () => {
    if (!currentEnemy.name || !currentEnemy.difficultyMultiplier) {
      toast({ title: "Please fill in enemy name and difficulty", variant: "destructive" });
      return;
    }

    const type = currentEnemy.enemyType || inferEnemyType(currentEnemy.image);
    if (type === "basic") { toast({ title: "Choose a supported enemy type", variant: "destructive" }); return; }
    if (enemies.reduce((n, e, i) => n + (i === editingEnemyIndex ? 0 : e.quantity || 1), 0) + Math.max(ENEMY_CATALOG[type].minimumQuantity, currentEnemy.quantity || 1) > 120) {
      toast({ title: "Use at most 120 individual enemies per fight", variant: "destructive" }); return;
    }
    if (editingEnemyIndex !== null) {
      // Update existing enemy
      const updatedEnemies = [...enemies];
      updatedEnemies[editingEnemyIndex] = {
        id: enemies[editingEnemyIndex].id,
        palette: currentEnemy.palette,
        swarm: currentEnemy.swarm,
        quantity:Math.max(ENEMY_CATALOG[type].minimumQuantity,currentEnemy.quantity||1), wave:currentEnemy.wave||1, species:type==="goblin"?"goblin":"other",
        name: currentEnemy.name,
        image: currentEnemy.image || ENEMY_CATALOG.zombie.image,
        enemyType: type,
        ai: enemyAISchema.parse(currentEnemy.ai || {}),
        difficultyMultiplier: encounterTier ? enemyTuning(encounterTier,currentEnemy.role||"normal").difficultyMultiplier : currentEnemy.difficultyMultiplier,
        ...(encounterTier?{role:currentEnemy.role||"normal"}:{}),
      };
      onChange(updatedEnemies);
      setEditingEnemyIndex(null);
    } else {
      // Add new enemy
      const newEnemy: Enemy = {
        id: Date.now().toString(),
        palette: currentEnemy.palette,
        swarm: currentEnemy.swarm,
        quantity:Math.max(ENEMY_CATALOG[type].minimumQuantity,currentEnemy.quantity||1), wave:currentEnemy.wave||1, species:type==="goblin"?"goblin":"other",
        name: currentEnemy.name,
        image: currentEnemy.image || ENEMY_CATALOG.zombie.image,
        enemyType: type,
        ai: enemyAISchema.parse(currentEnemy.ai || {}),
        difficultyMultiplier: encounterTier ? enemyTuning(encounterTier,currentEnemy.role||"normal").difficultyMultiplier : currentEnemy.difficultyMultiplier,
        ...(encounterTier?{role:currentEnemy.role||"normal"}:{}),
      };
      const updatedEnemies = [...enemies, newEnemy];
      onChange(updatedEnemies);
    }
    
    setCurrentEnemy({ image: ENEMY_CATALOG.zombie.image, difficultyMultiplier: 10, role:"normal", quantity:1, wave:currentEnemy.wave||1 });
    setUploadedEnemyImage(null);
  };

  const editEnemy = (index: number) => {
    const enemy = enemies[index];
    const type = enemy.enemyType || inferEnemyType(enemy.image);
    setCurrentEnemy({
      palette: enemy.palette,
      swarm: enemy.swarm,
      quantity:enemy.quantity||1,wave:enemy.wave||index+1,species:enemy.species||(enemyImage(enemy)===GOBLIN_IMAGE?"goblin":"other"),
      name: enemy.name,
      image: enemy.image,
      difficultyMultiplier: enemy.difficultyMultiplier,
      role:enemy.role,
      enemyType: type === "basic" ? undefined : type,
      ai: enemy.ai,
    });
    setEditingEnemyIndex(index);
    // Check if this is an uploaded image (starts with http)
    if (enemy.image.startsWith('http')) {
      setUploadedEnemyImage(enemy.image);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = enemies.findIndex((e) => e.id === active.id);
      const newIndex = enemies.findIndex((e) => e.id === over.id);

      const reorderedEnemies = arrayMove(enemies, oldIndex, newIndex);
      onChange(reorderedEnemies);
    }
  };

  return { currentEnemy, setCurrentEnemy, editingEnemyIndex, setEditingEnemyIndex, uploadedEnemyImage, setUploadedEnemyImage, enemyImageInputRef, handleEnemyImageUpload, addEnemy, editEnemy, sensors, handleDragEnd };
}
