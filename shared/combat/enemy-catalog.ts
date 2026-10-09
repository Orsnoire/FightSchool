import type { ENEMY_TYPES } from "./enemy-ai";

/** Only registered, fully defined species appear in teacher authoring. */
export const ENEMY_CATALOG: Record<typeof ENEMY_TYPES[number], { name: string; image: string; minimumQuantity: number }> = {
  zombie: { name: "Zombie", image: "/enemies/zombie-v2.png", minimumQuantity: 1 },
  ghost: { name: "Ghost", image: "/enemies/ghost-v2.png", minimumQuantity: 1 },
  spider: { name: "Giant Spider", image: "/enemies/spider-v2.png", minimumQuantity: 1 },
  vampire: { name: "Vampire", image: "/enemies/vampire-v2.png", minimumQuantity: 1 },
  slime: { name: "Slime", image: "/enemies/slime-v2.png", minimumQuantity: 1 },
  samhain: { name: "Samhain", image: "/enemies/samhain-v2.png", minimumQuantity: 1 },
  goblin: { name: "Goblin", image: "/enemies/goblin-v1.png", minimumQuantity: 5 },
};
