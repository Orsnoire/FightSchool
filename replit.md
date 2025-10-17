# RPG Combat Quiz Platform

## Overview
An educational platform that gamifies quiz-based learning through an immersive RPG combat experience. Teachers create quiz "fights" with questions and enemies. Students join these battles as fantasy characters (Warrior, Wizard, Scout, Herbalist), answering questions to deal damage and defeat enemies. The system features real-time multiplayer combat, character customization with equipment, and class-based gameplay mechanics. The platform aims to transform traditional quizzes into engaging, interactive adventures.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
**Framework & Routing**: React with Wouter for a lightweight Single Page Application (SPA) experience, built using Vite.
**UI Component System**: Shadcn/ui (New York style) with Radix UI primitives, providing accessible and customizable components. The design adheres to a dark fantasy gaming aesthetic, drawing inspiration from Discord, Kahoot, and classic RPGs.
**State Management**: TanStack Query for server state management and caching, complemented by React hooks for local UI state. WebSocket connections manage real-time combat state synchronization.
**Styling Approach**: Tailwind CSS with custom design tokens for RPG theming, including a dark fantasy color palette, class-specific colors, and custom RPG-style fonts ('Cinzel'/'Marcellus' for headers, 'Inter'/'DM Sans' for body text).

### Backend Architecture
**Server Framework**: Express.js with TypeScript on Node.js, managing both REST API endpoints and WebSocket connections for real-time combat.
**Real-Time Communication**: Utilizes the 'ws' library for live combat sessions, facilitating separate connections for teachers (hosts) and students, real-time combat state broadcasting, question delivery, answer validation, and phase transitions.
**Data Storage Strategy**: PostgreSQL database via Neon with Drizzle ORM. Stores data for students (including character class, gender, equipment, and inventory), fights (quiz configurations, enemies, loot tables), equipment items (teacher-created custom items with stats), combat sessions, and post-fight statistics.
**Authentication**: Password-based authentication using Node.js crypto for secure hashing. Student accounts are auto-created on first login, prompting character selection.

### API Structure
**REST Endpoints**:
- **Teacher**: `/api/fights` (CRUD for quiz battles), `/api/combat-stats` (class statistics), `/api/teacher/:teacherId/equipment-items` (manage custom equipment).
- **Equipment Items**: `/api/equipment-items` (create), `/api/equipment-items/:id` (retrieve/update/delete).
- **Student**: `/api/student/login` (account creation/login), `/api/student/:id/equipment` (equip/unequip items), `/api/student/:id/job-levels` (job progression).
- **Fight Access**: `/api/fights/active/:classCode` (students join active fights).
- **Stats**: `/api/combat-stats/student/:id` (personal stats), `/api/combat-stats/class/:code` (class stats).
**WebSocket Protocol**: A custom message-based protocol handles `join`, `host`, `combat_state`, `question`, `answer`, `phase_change`, and `game_over` events.

### Game Mechanics Architecture
**Character Classes**: Four base classes (Warrior, Wizard, Scout, Herbalist) with unique stats and abilities. Advanced classes (e.g., Knight, Paladin) are unlockable through a job system.
**Combat System**: Turn-based question phases where correct answers deal damage and incorrect answers result in player damage scaled by `fight.baseEnemyDamage`. Features include Warrior blocking, Herbalist healing mechanics, a nullable equipment system allowing students to collect and equip items from loot tables, and teacher-created custom equipment with quality tiers and stat bonuses.
**Question Types**: Supports multiple choice, true/false, and short answer questions with configurable time limits.

## External Dependencies

### Core Infrastructure
- **Neon (Serverless Postgres)**: For database hosting.
- **Drizzle ORM**: For database schema definition and type-safe queries.

### UI Component Libraries
- **Radix UI**: Accessible component primitives.
- **Shadcn/ui**: Pre-configured component library with New York style.
- **Lucide React**: Icon system.

### Development Tools
- **TypeScript**: For type safety.
- **Vite**: Frontend build tool.
- **ESBuild**: Server-side bundling.
- **Tailwind CSS**: Utility-first styling.

### Real-Time & Forms
- **ws (WebSocket)**: For real-time communication.
- **React Hook Form**: For form state management.
- **Zod**: For schema validation.
- **@hookform/resolvers**: Integration for form validation.

### Utilities
- **date-fns**: Date manipulation.
- **clsx + tailwind-merge**: Conditional className utilities.
- **class-variance-authority**: Type-safe variant styling.
- **nanoid**: Unique ID generation.

### Asset Management
- Pre-generated character sprites are located in `/attached_assets/generated_images/` for different classes and genders.