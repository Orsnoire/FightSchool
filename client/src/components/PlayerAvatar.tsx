import type { AvatarLoadout } from '@shared/avatar/equipment-visuals';
import type { CharacterClass, Gender } from "@shared/schema";
import { initialAppearance, type AvatarAppearance } from '@shared/avatar/appearance';
import { StaticAvatar } from './StaticAvatar';
import { Crown } from "lucide-react";

interface PlayerAvatarProps {
  loadout?: AvatarLoadout;
  appearance?: AvatarAppearance | null;
  characterClass: CharacterClass;
  gender?: Gender;
  size?: "xs" | "sm" | "md" | "lg";
  showBorder?: boolean;
  isThreatLeader?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  xs: "w-8 h-8",
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
};

const CROWN_SIZE_CLASSES = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export function PlayerAvatar({
  appearance,
  loadout,
  characterClass,
  gender,
  size = "md",
  showBorder = true,
  isThreatLeader = false,
  className = "",
}: PlayerAvatarProps) {
  const safeGender = gender || "A";
  const currentAppearance = appearance || initialAppearance(null,safeGender==='B'?'human-female-v1':'human-male-v1',()=>0.35);
  const borderColor = `border-${characterClass}`;

  return (
    <div
      className={`${SIZE_CLASSES[size]} ${showBorder ? `border-2 ${borderColor} rounded-md` : ""} overflow-visible bg-card ${className} relative`}
      data-testid={`avatar-${characterClass}-${gender}`}
    >
      <StaticAvatar appearance={currentAppearance} job={characterClass} loadout={loadout} className="w-full h-full" />
      {isThreatLeader && (
        <div 
          className="absolute -top-1 -right-1 bg-warning rounded-full p-0.5 border border-warning-foreground shadow-lg"
          data-testid="crown-threat-leader"
          title="Threat Leader"
        >
          <Crown className={`${CROWN_SIZE_CLASSES[size]} text-warning-foreground fill-current`} />
        </div>
      )}
    </div>
  );
}
