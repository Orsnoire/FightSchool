# RPG Combat Quiz Platform

## Overview
The RPG Combat Quiz Platform gamifies learning by transforming quizzes into an immersive RPG combat experience. Teachers create custom fight templates, and students join unique battle sessions using a 6-character alphanumeric code. Students play as fantasy characters (Warrior, Wizard, Scout, Herbalist), answering questions to deal damage and defeat enemies in real-time multiplayer combat. The platform features session-based architecture, character customization, class-based gameplay, a guild system, and a solo mode. Its primary purpose is to provide an engaging educational tool that uses gamification to enhance learning.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with Wouter (SPA, built using Vite).
- **UI**: Shadcn/ui (New York style) with Radix UI, adhering to a dark fantasy gaming aesthetic (inspired by Discord, Kahoot, classic RPGs).
- **State Management**: TanStack Query for server state, React hooks for local UI state, and WebSockets for real-time combat synchronization.
- **Styling**: Tailwind CSS with custom RPG theming, including a dark fantasy color palette, class-specific colors, and RPG-style fonts ('Cinzel'/'Marcellus' for headers, 'Inter'/'DM Sans' for body).

### Backend
- **Server**: Express.js with TypeScript on Node.js, handling REST APIs and WebSockets.
- **Session Architecture**: Teachers host isolated fight sessions with unique 6-character alphanumeric IDs, each having its own WebSocket connections, timers, and state.
- **Real-Time Communication**: Uses the 'ws' library for live combat, managing separate connections for teachers and students, state broadcasting, question delivery, answer validation, and phase transitions. Includes heartbeat/ping-pong and auto-reconnection.
- **Data Storage**: PostgreSQL database via Neon with Drizzle ORM, storing data for students, fights, equipment, combat sessions, and statistics.
- **Authentication**: Password-based authentication using Node.js crypto. Student accounts are auto-created on first login.

### API Structure
- **REST Endpoints**: CRUD operations for teachers (fights, equipment, combat stats), students (login, equipment, job levels, guild management), and session validation.
- **WebSocket Protocol**: Custom message-based protocol (`host`, `join`, `combat_state`, `question`, `answer`, `phase_change`, `game_over`, etc.) using `sessionId` for identification.

### Game Mechanics
- **Character Classes**: Four base classes (Warrior, Wizard, Scout, Herbalist) with unique stats and abilities. Advanced classes (e.g., Warlock, Priest, Paladin) are unlockable through a job system.
- **Combat System**: Turn-based question phases where correct answers deal damage and incorrect answers result in player damage. Features include enemy AI, warrior blocking, herbalist healing, and a customizable equipment system.
  - **Block & Healing Phase**: A 10-second phase after each question for strategic selections (e.g., tanks blocking, healers healing). Uses modal-based UI with intelligent filtering/sorting.
- **Question Types**: Supports multiple choice, true/false, and short answer with configurable time limits and randomization.
- **Guild System**: Teachers create and manage guilds; students can join, view leaderboards, and earn XP.
  - **Guild Shop**: Students can purchase equipment using gold currency. Shop items are scoped to guild's teacher and filtered by unlocked tiers from completed guild quests. Features tier-based progression gates (Tier 1-3) and secure server-side validation.
  - **Gold Currency**: Students earn gold from victories (logistic reward scaling) and can spend it in the Guild Shop. Gold balance is tracked per-student.
- **Solo Mode**: Students can practice alone or with friends, with options to enable AI for absent players and block new joiners.
- **Dynamic Enemy HP Scaling**: Enemy HP scales based on party size, player progression, and a teacher-set difficulty multiplier, ensuring balanced fights for 2-30 players.
- **XP System**: Awards XP based on individual contribution (damage dealt, healing, damage blocked, questions correct) to the active job class.
- **Ultimate Ability System**: Each job class unlocks a cross-class ability at level 15, equipable by any job, with unique effects, animations, and a 3-fight cooldown.
  - **Cross-Class Ability Interface**: Drag-and-drop UI using @dnd-kit library with two equipment slots (slot 2 unlocks at level 30), filterable ability grid (Healing, Spell, Physical, Ultimate), tooltips, context menus, and remove buttons.

## External Dependencies

### Core Infrastructure
- **Neon**: Serverless PostgreSQL database hosting.
- **Drizzle ORM**: Database schema definition and type-safe queries.

### UI Component Libraries
- **Radix UI**: Accessible component primitives.
- **Shadcn/ui**: Pre-configured component library.
- **Lucide React**: Icon system.
- **@dnd-kit**: Drag-and-drop library for cross-class ability management.

### Real-Time & Forms
- **ws**: WebSocket library for real-time communication.
- **React Hook Form**: Form state management.
- **Zod**: Schema validation.
- **@hookform/resolvers**: Integration for form validation.

### Utilities
- **date-fns**: Date manipulation.
- **clsx + tailwind-merge**: Conditional className utilities.
- **class-variance-authority**: Type-safe variant styling.
- **nanoid**: Unique ID generation.