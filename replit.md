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