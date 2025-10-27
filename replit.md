# RPG Combat Quiz Platform

## Overview
The RPG Combat Quiz Platform transforms traditional quizzes into engaging, interactive adventures by gamifying learning through an immersive RPG combat experience. Teachers create custom fight templates with questions and enemies, then host unique battle sessions that students join using a 6-character alphanumeric code. Students battle as fantasy characters (Warrior, Wizard, Scout, Herbalist), answering questions to deal damage and defeat enemies. The platform features real-time multiplayer combat, session-based architecture, character customization with equipment, and class-based gameplay mechanics, including a fully implemented guild system and solo mode. The project's ambition is to provide a highly engaging educational tool that leverages gamification to enhance learning outcomes.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Routing**: React with Wouter for a lightweight Single Page Application (SPA) experience, built using Vite.
- **UI Component System**: Shadcn/ui (New York style) with Radix UI primitives, providing accessible and customizable components. The design adheres to a dark fantasy gaming aesthetic, drawing inspiration from Discord, Kahoot, and classic RPGs.
- **State Management**: TanStack Query for server state management and caching, complemented by React hooks for local UI state. WebSocket connections manage real-time combat state synchronization.
- **Styling Approach**: Tailwind CSS with custom design tokens for RPG theming, including a dark fantasy color palette, class-specific colors, and custom RPG-style fonts ('Cinzel'/'Marcellus' for headers, 'Inter'/'DM Sans' for body text).

### Backend Architecture
- **Server Framework**: Express.js with TypeScript on Node.js, managing both REST API endpoints and WebSocket connections for real-time combat.
- **Session Architecture**: Teachers host fight sessions that generate unique 6-character alphanumeric session IDs. Each session is isolated with its own WebSocket connections, timers, and state, allowing multiple sessions for the same fight template.
- **Real-Time Communication**: Utilizes the 'ws' library for live combat sessions, facilitating separate connections for teachers and students, real-time state broadcasting, question delivery, answer validation, and phase transitions. Includes a heartbeat/ping-pong system and automatic reconnection for students.
- **Data Storage Strategy**: PostgreSQL database via Neon with Drizzle ORM. Stores data for students, fights, equipment items, combat sessions, and post-fight statistics.
- **Authentication**: Password-based authentication using Node.js crypto for secure hashing. Student accounts are auto-created on first login.

### API Structure
- **REST Endpoints**: Comprehensive CRUD operations for teachers (fights, equipment, combat stats), students (login, equipment, job levels, guild management), and session validation.
- **WebSocket Protocol**: A custom message-based protocol handles `host`, `session_created`, `join`, `host_solo`, `toggle_ai`, `block_joiners`, `combat_state`, `question`, `answer`, `phase_change`, and `game_over` events, using sessionId as the primary identifier.

### Game Mechanics Architecture
- **Character Classes**: Four base classes (Warrior, Wizard, Scout, Herbalist) with unique stats and abilities. Advanced classes (e.g., Knight, Paladin) are unlockable through a job system.
- **Combat System**: Turn-based question phases where correct answers deal damage and incorrect answers result in player damage. Features include enemy AI, warrior blocking, herbalist healing, and a customizable equipment system.
- **Question Types**: Supports multiple choice, true/false, and short answer questions with configurable time limits and randomization.
- **Guild System**: Teachers create and manage guilds for organizing students and fights. Students can join multiple guilds, view leaderboards, and earn XP.
- **Solo Mode**: Students can practice fights alone or with friends. Host controls allow enabling AI for absent players and blocking new joiners mid-session.
- **Dynamic Enemy HP Scaling**: Enemy HP scales automatically based on class size and player progression. Formula: `Base HP = (# of questions × total player levels + 10) × difficultyMultiplier`. Teachers set a difficulty multiplier (1-100) per enemy, where 1-10 = trash pack (1-2 rounds), 11-30 = elite, 31-60 = boss, and 61-100 = epic boss. This ensures fights remain balanced whether 2 or 20 students participate.
- **XP System**: All fights (both solo and teacher-hosted) award XP using an individual contribution formula: `(damageDealt + healingDone×2 + damageBlocked×2) × questionsCorrect`. XP is awarded to the player's currently active job class.
- **Ultimate Ability System**: Each job class unlocks a cross-class ability at level 15 that can be equipped by any job. Students equip up to 2 cross-class abilities via the Lobby UI, which become their ultimate abilities in combat. Only equipped cross-class abilities show as ultimate buttons during battle. Abilities have unique effects, animations, and a 3-fight cooldown. Abilities pause combat for a 4-second animation.

## External Dependencies

### Core Infrastructure
- **Neon (Serverless Postgres)**: Database hosting.
- **Drizzle ORM**: Database schema definition and type-safe queries.

### UI Component Libraries
- **Radix UI**: Accessible component primitives.
- **Shadcn/ui**: Pre-configured component library.
- **Lucide React**: Icon system.

### Development Tools
- **TypeScript**: Type safety.
- **Vite**: Frontend build tool.
- **ESBuild**: Server-side bundling.
- **Tailwind CSS**: Utility-first styling.

### Real-Time & Forms
- **ws (WebSocket)**: Real-time communication.
- **React Hook Form**: Form state management.
- **Zod**: Schema validation.
- **@hookform/resolvers**: Integration for form validation.

### Utilities
- **date-fns**: Date manipulation.
- **clsx + tailwind-merge**: Conditional className utilities.
- **class-variance-authority**: Type-safe variant styling.
- **nanoid**: Unique ID generation.

## Developer Documentation

### Adding a New Character Class/Job

When adding a new character class to the game, follow this comprehensive checklist to ensure the class is fully integrated into all systems:

#### 1. Schema & Type Definitions (`shared/schema.ts`)
- [ ] Add the new class to the `CharacterClass` type union
- [ ] Add the new class to the `ALL_CHARACTER_CLASSES` constant array
- [ ] Define base stats in `CLASS_STATS` (baseHP, str, int, agi, mnd, vit, role)
- [ ] Add starting equipment in `EQUIPMENT_ITEMS` (ensure classRestriction includes the new class)
- [ ] If the class uses new stat mechanics, add fields to `PlayerState` interface
- [ ] Update `getStartingEquipment()` to provide default equipment for the class

#### 2. Job System (`shared/jobSystem.ts`)
- [ ] Add job definition to `JOB_TREE` with:
  - Unlock requirements (which jobs/levels required)
  - Level rewards (passives, abilities, mechanic upgrades)
  - Max level (typically 15)
- [ ] If the class has unique mechanic upgrades, add to `MechanicUpgrade` interface
- [ ] Add mechanic upgrade accumulation in `getTotalMechanicUpgrades()`

#### 3. Combat Implementation (`server/routes.ts`)
- [ ] Add damage calculation logic in `combatPhase()` function
  - Determine damage type: physical, magical, ranged, or hybrid
  - Handle class-specific abilities (similar to wizard fireball, herbalist healing, warlock siphon/hex)
  - Implement MP costs if applicable
- [ ] If the class has special combat phases, add logic to appropriate phase functions:
  - `tankBlockingPhase()` for defensive abilities
  - `enemyAIPhase()` for counter-attacks or passive effects
  - DoT/buff tracking in combat phase loop
- [ ] Add class-specific state resets on wrong answers (similar to scout combo points, wizard cooldowns)
- [ ] Update aggro system if the class is a tank variant

#### 4. Ultimate Abilities (`shared/ultimateAbilities.ts`)
- [ ] Add ultimate ability definition to `ULTIMATE_ABILITIES` record:
  - Unique ID and name
  - Job class association
  - Animation type (fire, ice, holy, dark, nature, lightning, spirit)
  - Cooldown (typically 3 fights)
  - Effect type and formula
- [ ] Add damage/heal calculation in `calculateUltimateEffect()` function
- [ ] Ensure animation type has corresponding visual assets

#### 5. UI Components
- [ ] Verify class appears in character selection UI
- [ ] Add class-specific colors/styling if needed
- [ ] Update combat UI to display class-specific abilities/states
- [ ] Test that equipment filtering works for the new class

#### 6. Testing
- [ ] The tester account (`tester`/`test`) automatically includes ALL jobs at level 15
  - This is handled by `ALL_CHARACTER_CLASSES` constant - no manual updates needed
- [ ] Create fights to test class abilities at various levels
- [ ] Verify damage formulas are balanced with other classes
- [ ] Test class-specific UI elements and animations
- [ ] Confirm equipment restrictions work correctly

#### 7. Documentation
- [ ] Update `CLASS_STATS` role descriptions
- [ ] Document any new combat mechanics in code comments
- [ ] Add ability descriptions to job tree rewards

### Implemented Classes

**Base Classes** (Level 1, available immediately):
- **Warrior**: Tank with physical damage (ATK + STR), can block for allies
  - Cross-Class Ability (Lv15): Unbreakable - Negate all damage for one round
- **Wizard**: Magical DPS (MAT + INT), fireball charge mechanic, MP-based
  - Cross-Class Ability (Lv15): Manabomb - Massive magical AoE damage to all enemies
- **Scout**: Ranged DPS (RTK + AGI), combo point system
  - Cross-Class Ability (Lv15): Killshot - Spend all combo points for massive damage
- **Herbalist**: Healer/support (MAT + AGI + MND), healing and potion crafting
  - Cross-Class Ability (Lv15): Life Potion - Heal all allies over time

**Advanced Classes** (Unlockable):
- **Warlock** (Wizard 2): Curse specialist (MAT + INT), Siphon self-heal (level 4+), Hex DoT (level 1+), MP-based
  - Unlock: Wizard level 2
  - Siphon: Deals magical damage and heals for (INT/2 + siphonHealBonus) rounded up
  - Hex: Applies (INT-1) curse damage per round for (2 + hexDuration) rounds to first enemy
  - Cross-Class Ability (Lv15): Soul Echo - Next spell hits twice (heal 2×INT, must have Hex active)
- **Priest** (Herbalist 2): Advanced healer (MAT + INT), holy magic specialist, MP-based healing
  - Unlock: Herbalist level 2
  - Mend: Heals target for MND HP (1 MP cost)
  - Cross-Class Ability (Lv15): Divine Grace - Full heal all allies, revive KO'ed players
- **Paladin** (Warrior 2 + Priest 2): Holy defender (ATK + STR), tank/healer hybrid
  - Unlock: Warrior level 2 AND Priest level 2
  - Healing Guard: Blocks and heals target simultaneously
  - Cross-Class Ability (Lv15): Holy Judgment - Heal all for (VIT+MND), damage enemies for (STR+VIT+MND)/3
- **Dark Knight** (Warrior 3 + Wizard 3): Dark warrior (ATK*(STR+VIT+INT)), tank/DPS with shadow magic
  - Unlock: Warrior level 3 AND Wizard level 3
  - Ruin Strike: Deals ATK*(STR+VIT+INT) melee damage (1 MP cost)
  - Blood Sword: Self-heal for damage dealt (1 MP cost)
  - Cross-Class Ability (Lv15): Shadow Requiem - Massive damage to all enemies, heal for all damage dealt
- **Blood Knight** (Warrior 2 + Warlock 5): Vampiric warrior (ATK*(VIT+STR)/2), lifesteal specialist
  - Unlock: Warrior level 2 AND Warlock level 5
  - Crimson Slash: Deals ATK*(VIT+STR)/2 damage with 50% lifesteal (1 MP cost)
  - Dark Vigor: Passive 25% lifesteal on all damage
  - Cross-Class Ability (Lv15): Raining Blood - Damage all enemies, heal all allies for 50% damage dealt

### Key Files Reference

- **Schema/Types**: `shared/schema.ts` - All type definitions, PlayerState, CharacterClass
- **Job System**: `shared/jobSystem.ts` - Job trees, passive bonuses, mechanic upgrades
- **Combat Logic**: `server/routes.ts` - Damage calculations, combat phases, WebSocket handlers
- **Ultimate Abilities**: `shared/ultimateAbilities.ts` - Level 15+ special abilities
- **Player Initialization**: `server/storage.ts` - PlayerState creation with default values
- **Test Data**: `server/storage.ts` - seedTestStudent() automatically includes all jobs