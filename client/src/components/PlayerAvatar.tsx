import type { CharacterClass, Gender } from "@shared/schema";
import { Crown } from "lucide-react";
import warriorMale from "@assets/generated_images/Knight_male_character_sprite_732b2fa0.png";
import warriorFemale from "@assets/generated_images/Knight_female_character_sprite_3ca497a8.png";
import wizardMale from "@assets/generated_images/Wizard_male_character_sprite_003e142c.png";
import wizardFemale from "@assets/generated_images/Wizard_female_character_sprite_99a1f772.png";
import scoutMale from "@assets/generated_images/Scout_male_character_sprite_975fe8de.png";
import scoutFemale from "@assets/generated_images/Scout_female_character_sprite_c6a16a9f.png";
import herbalistMale from "@assets/generated_images/Herbalist_male_character_sprite_d60326a7.png";
import herbalistFemale from "@assets/generated_images/Herbalist_female_character_sprite_52050434.png";
import priestMale from "@assets/generated_images/Priest_male_character_sprite_9cc60718.png";
import priestFemale from "@assets/generated_images/Priest_female_character_sprite_e00ecde1.png";
import paladinMale from "@assets/generated_images/Paladin_male_character_sprite_c511acf1.png";
import paladinFemale from "@assets/generated_images/Paladin_female_character_sprite_4287e7fa.png";
import darkKnightMale from "@assets/generated_images/Dark_Knight_male_character_sprite_8b1cda20.png";
import darkKnightFemale from "@assets/generated_images/Dark_Knight_female_character_sprite_503fb2e3.png";
import bloodKnightMale from "@assets/generated_images/Blood_Knight_male_character_sprite_a7914e5c.png";
import bloodKnightFemale from "@assets/generated_images/Blood_Knight_female_character_sprite_7d98ecae.png";
import monkMale from "@assets/generated_images/Monk_male_character_sprite_2ec8e856.png";
import monkFemale from "@assets/generated_images/Monk_female_character_sprite_2813bcc4.png";
import warlockMale from "@assets/generated_images/Warlock_male_character_sprite_2481c4c6.png";
import warlockFemale from "@assets/generated_images/Warlock_female_character_sprite_baea7862.png";
import rangerMale from "@assets/generated_images/Ranger_male_character_sprite_83d84a5a.png";
import rangerFemale from "@assets/generated_images/Ranger_female_character_sprite_e862ef10.png";
import bardMale from "@assets/generated_images/Bard_male_character_sprite_eb6469bc.png";
import bardFemale from "@assets/generated_images/Bard_female_character_sprite_14b09f07.png";

interface PlayerAvatarProps {
  characterClass: CharacterClass;
  gender?: Gender;
  size?: "xs" | "sm" | "md" | "lg";
  showBorder?: boolean;
  isThreatLeader?: boolean;
  className?: string;
}

const CHARACTER_IMAGES: Record<CharacterClass, Record<Gender, string>> = {
  warrior: { A: warriorMale, B: warriorFemale },
  wizard: { A: wizardMale, B: wizardFemale },
  scout: { A: scoutMale, B: scoutFemale },
  herbalist: { A: herbalistMale, B: herbalistFemale },
  warlock: { A: warlockMale, B: warlockFemale },
  priest: { A: priestMale, B: priestFemale },
  paladin: { A: paladinMale, B: paladinFemale },
  dark_knight: { A: darkKnightMale, B: darkKnightFemale },
  blood_knight: { A: bloodKnightMale, B: bloodKnightFemale },
  monk: { A: monkMale, B: monkFemale },
  ranger: { A: rangerMale, B: rangerFemale },
};

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
  characterClass,
  gender,
  size = "md",
  showBorder = true,
  isThreatLeader = false,
  className = "",
}: PlayerAvatarProps) {
  const safeGender = gender || "A";
  const image = CHARACTER_IMAGES[characterClass][safeGender];
  const borderColor = `border-${characterClass}`;

  return (
    <div
      className={`${SIZE_CLASSES[size]} ${showBorder ? `border-2 ${borderColor} rounded-md` : ""} overflow-visible bg-card ${className} relative`}
      data-testid={`avatar-${characterClass}-${gender}`}
    >
      <img src={image} alt={`${characterClass} ${gender}`} className="w-full h-full object-cover" />
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
