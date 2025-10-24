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
- **Solo Mode**: Students can practice fights alone or with friends. Solo sessions have dynamic HP scaling and host controls for AI and blocking joiners.
- **Ultimate Ability System**: Level 15+ job classes unlock powerful ultimate abilities with unique effects, animations, and a 3-fight cooldown. Abilities pause combat for a 4-second animation.

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
- **Wizard**: Magical DPS (MAT + INT), fireball charge mechanic, MP-based
- **Scout**: Ranged DPS (RTK + AGI), combo point system
- **Herbalist**: Healer/support (MAT + AGI + MND), healing and potion crafting

**Advanced Classes** (Unlockable):
- **Warlock**: Curse specialist (MAT + INT), Siphon self-heal (level 4+), Hex DoT (level 1+), MP-based
  - Siphon: Deals magical damage and heals for (INT/2 + siphonHealBonus) rounded up
  - Hex: Applies (INT-1) curse damage per round for (2 + hexDuration) rounds to first enemy
- **Knight, Paladin, Dark Knight, Sage, Ranger, Druid, Monk**: Defined in schema but not yet implemented in combat system

### Key Files Reference

- **Schema/Types**: `shared/schema.ts` - All type definitions, PlayerState, CharacterClass
- **Job System**: `shared/jobSystem.ts` - Job trees, passive bonuses, mechanic upgrades
- **Combat Logic**: `server/routes.ts` - Damage calculations, combat phases, WebSocket handlers
- **Ultimate Abilities**: `shared/ultimateAbilities.ts` - Level 15+ special abilities
- **Player Initialization**: `server/storage.ts` - PlayerState creation with default values
- **Test Data**: `server/storage.ts` - seedTestStudent() automatically includes all jobs