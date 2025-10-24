import type { CharacterClass, Gender } from "@shared/schema";
import warriorMale from "@assets/generated_images/Knight_male_character_sprite_732b2fa0.png";
import warriorFemale from "@assets/generated_images/Knight_female_character_sprite_3ca497a8.png";
import wizardMale from "@assets/generated_images/Wizard_male_character_sprite_003e142c.png";
import wizardFemale from "@assets/generated_images/Wizard_female_character_sprite_99a1f772.png";
import scoutMale from "@assets/generated_images/Scout_male_character_sprite_975fe8de.png";
import scoutFemale from "@assets/generated_images/Scout_female_character_sprite_c6a16a9f.png";
import herbalistMale from "@assets/generated_images/Herbalist_male_character_sprite_d60326a7.png";
import herbalistFemale from "@assets/generated_images/Herbalist_female_character_sprite_52050434.png";
import priestA from "@assets/generated_images/Priest_Gender_A_avatar_771dd977.png";
import priestB from "@assets/generated_images/Priest_Gender_B_avatar_492dcacc.png";
import paladinA from "@assets/generated_images/Paladin_Gender_A_avatar_04b554c4.png";
import paladinB from "@assets/generated_images/Paladin_Gender_B_avatar_a3053a19.png";
import darkKnightA from "@assets/generated_images/Dark_Knight_Gender_A_avatar_1f84f0ee.png";
import darkKnightB from "@assets/generated_images/Dark_Knight_Gender_B_avatar_ec1efa4e.png";
import bloodKnightA from "@assets/generated_images/Blood_Knight_Gender_A_avatar_155aaba8.png";
import bloodKnightB from "@assets/generated_images/Blood_Knight_Gender_B_avatar_4681c094.png";

interface PlayerAvatarProps {
  characterClass: CharacterClass;
  gender?: Gender;
  size?: "xs" | "sm" | "md" | "lg";
  showBorder?: boolean;
  className?: string;
}

const CHARACTER_IMAGES: Record<CharacterClass, Record<Gender, string>> = {
  warrior: { A: warriorMale, B: warriorFemale },
  wizard: { A: wizardMale, B: wizardFemale },
  scout: { A: scoutMale, B: scoutFemale },
  herbalist: { A: herbalistMale, B: herbalistFemale },
  warlock: { A: wizardMale, B: wizardFemale },
  priest: { A: priestA, B: priestB },
  paladin: { A: paladinA, B: paladinB },
  dark_knight: { A: darkKnightA, B: darkKnightB },
  blood_knight: { A: bloodKnightA, B: bloodKnightB },
};

const SIZE_CLASSES = {
  xs: "w-8 h-8",
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
};

export function PlayerAvatar({
  characterClass,
  gender,
  size = "md",
  showBorder = true,
  className = "",
}: PlayerAvatarProps) {
  const safeGender = gender || "A";
  const image = CHARACTER_IMAGES[characterClass][safeGender];
  const borderColor = `border-${characterClass}`;

  return (
    <div
      className={`${SIZE_CLASSES[size]} ${showBorder ? `border-2 ${borderColor} rounded-md` : ""} overflow-hidden bg-card ${className}`}
      data-testid={`avatar-${characterClass}-${gender}`}
    >
      <img src={image} alt={`${characterClass} ${gender}`} className="w-full h-full object-cover" />
    </div>
  );
}
