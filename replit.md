# RPG Combat Quiz Platform

## Overview

An educational platform that transforms quiz-based learning into an immersive RPG combat experience. Teachers create quiz "fights" with questions and enemies, while students join battles as fantasy characters (Warrior, Wizard, Scout, Herbalist), answering questions to deal damage and defeat enemies. The system features real-time multiplayer combat, character customization with equipment, and class-based gameplay mechanics.

## Recent Changes (October 17, 2025)

**Shared Equipment System & Database Migration**:
- Implemented shared default equipment: 18 system items (teacherId='SYSTEM') seeded at server startup for all teachers to access
- Refactored equipment architecture to be fully database-driven: removed hardcoded EQUIPMENT_ITEMS constant from student flows (Lobby, StudentEquipment)
- Fixed equipment query performance: replaced N+1 pattern with batched `inArray` queries, implemented structured query keys `['equipment-items', { ids: sortedIds }]` to prevent stale cache bugs
- Updated ItemType schema to include "herbs" and "armor" types for equipment diversity
- Teachers now see both their custom equipment items AND shared SYSTEM items when creating fights in loot tables
- Equipment queries use GET `/api/equipment-items?ids=id1,id2` with single batched SELECT for performance
- Students display inventory items in Lobby with quality-based border colors (common/rare/epic/legendary) and stat bonuses

**Equipment & Combat Systems Update**:
- Added `equipment_items` database table for teacher-created custom equipment with fields: teacherId, name, iconUrl, itemType (expandable enum), quality (common/rare/epic/legendary), slot (weapon/headgear/armor), stat bonuses (HP/ATK/DEF)
- Created ItemManagement page (`/teacher/items`) allowing teachers to create, edit, delete custom equipment with quality-based visual indicators (common/rare/epic/legendary border colors)
- Added `inventory` field to students table (nullable string array, starts null on character creation) to track equipment items collected from loot
- Implemented `baseEnemyDamage` fight configuration field (1-10 slider, default 1) enabling teachers to scale encounter difficulty independently of XP rewards
- Combat system now uses `fight.baseEnemyDamage` for damage calculation when students answer incorrectly
- Added defense stats to `CLASS_STATS` for all character classes (Warrior: 3, Wizard: 0, Scout: 0, Herbalist: 1, Knight: 4, etc.)
- Created `getWarriorBlockAmount()` helper function calculating Warrior blocking power: base defense + equipment defense + job passive defense bonuses
- API routes for equipment items: GET/POST `/api/equipment-items`, GET `/api/teacher/:teacherId/equipment-items`, PATCH/DELETE `/api/equipment-items/:id`

**Herbalist Level Progression System**:
- Implemented full Herbalist job tree with 15 levels: passive bonuses (HP +1 at Lv2/7/14) and potion/crafting abilities
- Created helper functions (`getHealingPower`, `getHealingPotionCapacity`, `getShieldPotionCapacity`, `getCraftEfficiency`, `getPoisonPotionUses`) for dynamic mechanics
- Healing Power: 1→2 at Lv3, 2→3 at Lv13 (affects how much each healing potion restores)
- Healing Potion capacity: 5→6 at Lv5 (max charges that can be carried)
- Shield Potion capacity: unlocks at Lv8 (3 charges), 3→4 at Lv9
- Craft Efficiency: +1 at Lv6, +2 at Lv11 (stacking bonus - extra charges when crafting Healing/Shield potions)
- Herbalist abilities: Healing Potion (Lv1), Craft Healing Potion (Lv4), Craft Shield Potion (Lv8), Potion Diffuser (Lv10 - makes next potion affect full raid), Poison Potion (Lv12 - 3 uses/fight), Life Potion (Lv15 cross-class - revive all KO'd allies)
- Cross-class unlocks: Healing Potion (Lv8), Life Potion (Lv15)

**Scout Level Progression System**:
- Implemented full Scout job tree with 15 levels: passive bonuses (HP +1 at Lv3/6/11, ATK +1 at Lv2/5/9/13) and ability unlocks
- Created helper functions (`getHeadshotCooldown`, `getHeadshotMaxComboPoints`) for dynamic Scout ability scaling
- Headshot mechanics: cooldown 5→4 rounds at Lv7, max combo points 3→6 at Lv14
- Combat system uses dynamic max combo points for Headshot trigger (auto-fires when combo points = max)
- Scout abilities include: Headshot (Lv1), Aim (Lv4), Mark (Lv10), Dodge (Lv12), Killshot (Lv15 cross-class)
- Schema updated: characterClass and gender now nullable to support new student creation flow

**Job Level Integration into Combat** (October 16):
- PlayerState now includes jobLevels map enabling access to wizard/scout levels during combat
- Combat join (`addPlayerToCombat`) fetches student job levels and calculates passive bonuses (HP/ATK/DEF) from all classes
- Passive bonuses applied to maxHealth when players join combat
- Lobby page displays Class Progression card showing current class level, passive bonuses, and other job levels

**Fireball Dynamic Upgrades** (October 16):
- Created helper functions (`getFireballCooldown`, `getFireballDamageBonus`, `getFireballMaxChargeRounds`) to calculate Fireball stats from wizard level
- Fireball mechanics now scale dynamically: cooldown 5→4→3→2 at Lv2/7/11, damage +1 at Lv5/13, max charge 2→3 at Lv14
- Combat UI displays Fireball charge/cooldown indicators for wizards and streak counter for scouts

**Login Flow Fix** (October 16):
- Fixed critical bug: `/api/student/login` now creates new accounts with null characterClass/gender (was incorrectly defaulting to "warrior"/"A")
- Login routing: existing students (with characterClass) → lobby, new students (null characterClass) → character select
- Ensures proper first-time character setup flow

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Routing**: React with Wouter for client-side routing, providing a lightweight SPA experience. The application uses Vite as the build tool with hot module replacement for development.

**UI Component System**: Shadcn/ui (New York style) with Radix UI primitives, providing accessible, customizable components. The design system implements a dark fantasy gaming aesthetic inspired by Discord, Kahoot, and classic RPG interfaces (Final Fantasy, WoW).

**State Management**: 
- TanStack Query (React Query) for server state management and caching
- Local state with React hooks for UI interactions
- WebSocket connections for real-time combat state synchronization

**Styling Approach**: Tailwind CSS with custom design tokens for RPG theming:
- Dark fantasy color palette (deep slate backgrounds, vibrant purple accents)
- Class-specific colors (Warrior/blue, Wizard/purple, Scout/DPS, Herbalist/green)
- Custom fonts: 'Cinzel' or 'Marcellus' for headers, 'Inter' or 'DM Sans' for body text

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js. The server handles both REST API endpoints and WebSocket connections for real-time combat.

**Real-Time Communication**: WebSocket implementation using the 'ws' library for live combat sessions:
- Separate connections for hosts (teachers) and students
- Real-time combat state broadcasting
- Question delivery and answer validation
- Phase transitions and game over events

**Data Storage Strategy**: PostgreSQL database via Neon with Drizzle ORM implementing the IStorage interface:
- Students: nickname, password hash, optional class code, character class, gender, nullable equipment (weapon/headgear/armor start as null), inventory (nullable string array for item IDs)
- Fights: quiz configuration with questions, enemies, class code, baseXP (1-100), baseEnemyDamage (1-10 difficulty scaling), loot tables (references equipment items)
- Equipment Items: teacher-created custom items with name, iconUrl, itemType, quality, slot, stat bonuses (HP/ATK/DEF)
- Combat Sessions: active game state with players, enemies, current phase, and question
- Combat Stats: post-fight performance tracking (questions answered, damage dealt, healing, deaths)

**Authentication**: Password-based authentication using Node.js crypto (scrypt) for secure password hashing. Auto-creates student accounts on first login with null characterClass/gender (forcing character selection). Student sessions tracked via localStorage on client and WebSocket connections on server.

### API Structure

**REST Endpoints**:
- Teacher: `/api/fights` (CRUD operations for quiz battles), `/api/combat-stats` (view class statistics), `/api/teacher/:teacherId/equipment-items` (manage custom equipment)
- Equipment Items: `/api/equipment-items` (POST create), `/api/equipment-items/:id` (GET/PATCH/DELETE)
- Student: `/api/student/login` (auto-creates account with null characterClass/gender/equipment/inventory), `/api/student/:id/equipment` (equip/unequip items), `/api/student/:id/job-levels` (fetch job progression)
- Fight access: `/api/fights/active/:classCode` (students join fights using class code, returns only actively hosted fights)
- Stats: `/api/combat-stats/student/:id` (personal stats), `/api/combat-stats/class/:code` (class stats)

**WebSocket Protocol**: Custom message-based protocol with types:
- `join`: Student joins combat session
- `host`: Teacher starts hosting a fight
- `combat_state`: Broadcast current game state
- `question`: Deliver questions to students
- `answer`: Student answer submission
- `phase_change`: Combat phase transitions
- `game_over`: Victory/defeat resolution

### Game Mechanics Architecture

**Character Classes**: Four base classes available at character creation (advanced classes unlockable via job system):
- Base Classes: Warrior (Tank), Wizard (DPS), Scout (DPS), Herbalist (Healer)
- Advanced Classes (unlockable): Knight, Paladin, Dark Knight, Sage, Ranger, Druid, Monk
- Each class has unique stats (health, attack, defense) and abilities
- Note: Knight is now an advanced unlockable class (requires Warrior Lv10), while Warrior is the starting tank class

**Combat System**:
- Turn-based question phases
- Correct answers deal damage to enemies
- Incorrect answers result in player damage scaled by `fight.baseEnemyDamage` (1-10 difficulty setting)
- Warrior blocking: Uses `getWarriorBlockAmount(level, equipmentDefense)` combining base defense + equipment defense + job passive defense bonuses
- Healing mechanics for Herbalist class
- Nullable equipment system: students start with no equipment (null), making first loot drops more exciting
- Equipment (weapon/headgear/armor) can be equipped/unequipped freely to customize stats
- Inventory system: students collect equipment item IDs (string array) from loot tables, starts null on account creation
- Teacher-created custom equipment with quality tiers (common/rare/epic/legendary) and stat bonuses

**Question Types**: Multiple choice, true/false, and short answer with configurable time limits (5-300 seconds).

## External Dependencies

### Core Infrastructure
- **Neon (Serverless Postgres)**: `@neondatabase/serverless` - Configured via Drizzle but currently using in-memory storage (database provisioning ready)
- **Drizzle ORM**: Database schema definition and type-safe queries (PostgreSQL dialect configured)

### UI Component Libraries
- **Radix UI**: Complete set of accessible component primitives (@radix-ui/* packages)
- **Shadcn/ui**: Pre-configured component library with New York style preset
- **Lucide React**: Icon system for UI elements

### Development Tools
- **TypeScript**: Full type safety across client/server/shared code
- **Vite**: Frontend build tool with React plugin and custom Replit integration plugins
- **ESBuild**: Server-side bundling for production builds
- **Tailwind CSS**: Utility-first styling with custom configuration

### Real-Time & Forms
- **ws (WebSocket)**: Real-time bidirectional communication for combat sessions
- **React Hook Form**: Form state management with Zod validation
- **@hookform/resolvers**: Integration between React Hook Form and Zod schemas

### Utilities
- **date-fns**: Date manipulation and formatting
- **clsx + tailwind-merge**: Conditional className utilities
- **class-variance-authority**: Type-safe variant-based component styling
- **nanoid**: Unique ID generation

### Asset Management
The application uses pre-generated character sprites stored in `/attached_assets/generated_images/` for each class and gender combination (Warrior, Wizard, Scout, Herbalist × Male/Female). Note: The Knight sprite filenames are reused for the Warrior class, with Knight reserved as an unlockable advanced class.