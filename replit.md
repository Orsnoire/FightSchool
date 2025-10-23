# RPG Combat Quiz Platform

## Overview
An educational platform that gamifies quiz-based learning through an immersive RPG combat experience. Teachers create fight templates with questions and enemies, then host unique battle sessions identified by 6-character alphanumeric codes (sessionId) that students use to join. Students battle as fantasy characters (Warrior, Wizard, Scout, Herbalist), answering questions to deal damage and defeat enemies. The system features real-time multiplayer combat with session-based architecture, character customization with equipment, and class-based gameplay mechanics. The platform uses guildCode (nullable, renamed from classCode) to prepare for future guild system integration. Platform aims to transform traditional quizzes into engaging, interactive adventures.

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
**Session Architecture**: Teachers host fight sessions that generate unique 6-character alphanumeric sessionIds. Students join sessions using these codes. Each session is isolated with its own WebSocket connections, timers, and state. Multiple sessions can exist for the same fight template simultaneously.
**Real-Time Communication**: Utilizes the 'ws' library for live combat sessions, facilitating separate connections for teachers (hosts) and students, real-time combat state broadcasting, question delivery, answer validation, and phase transitions. WebSocket handler exclusively accepts /ws path to prevent Vite HMR conflicts.
  - **Connection Resilience (B6/B7 fixes)**: Implemented heartbeat/ping-pong system with 30-second intervals on server to detect dead connections. Students have automatic reconnection with exponential backoff (1s to 10s max). Hosts have manual "Refresh Connection" button. Connection status indicators show green (connected), yellow (reconnecting), or red (disconnected). Fixed critical bug where WebSocket was recreated on every combat phase change by using stable useCallback hook.
**Data Storage Strategy**: PostgreSQL database via Neon with Drizzle ORM. Stores data for students (including character class, gender, equipment, and inventory), fights (quiz templates with guildCode for future guild system), equipment items (teacher-created custom items with stats), combat sessions (sessionId as primary key), and post-fight statistics.
**Authentication**: Password-based authentication using Node.js crypto for secure hashing. Student accounts are auto-created on first login, prompting character selection.

### API Structure
**REST Endpoints**:
- **Teacher**: `/api/fights` (CRUD for fight templates with guildCode field), `/api/combat-stats` (guild statistics), `/api/teacher/:teacherId/equipment-items` (manage custom equipment).
- **Equipment Items**: `/api/equipment-items` (create), `/api/equipment-items/:id` (retrieve/update/delete).
- **Student**: `/api/student/login` (account creation/login), `/api/student/:id/equipment` (equip/unequip items), `/api/student/:id/job-levels` (job progression).
- **Session Validation**: `/api/sessions/:sessionId` (validates sessionId and returns session info for students to join).
- **Stats**: `/api/combat-stats/student/:id` (personal stats), `/api/combat-stats/guild/:code` (guild stats).
**WebSocket Protocol**: A custom message-based protocol handles `host` (teacher creates session, receives sessionId), `session_created` (server confirms session creation), `join` (student joins with sessionId), `combat_state`, `question`, `answer`, `phase_change`, and `game_over` events. All operations use sessionId as the primary identifier.

### Game Mechanics Architecture
**Character Classes**: Four base classes (Warrior, Wizard, Scout, Herbalist) with unique stats and abilities. Advanced classes (e.g., Knight, Paladin) are unlockable through a job system.
**Combat System**: Turn-based question phases where correct answers deal damage and incorrect answers result in player damage scaled by `fight.baseEnemyDamage`. Features include:
- **Enemy AI**: After players answer questions, each alive enemy attacks the player with the highest threat value (defaults to 1 for all players) for `baseEnemyDamage + 1` damage. Future support for custom enemy scripts via `fight.enemyScript` field.
- **Combat Flow**: Question Phase → Tank Blocking & Healing → Combat (players attack) → Enemy AI (enemies attack) → State Check → loop.
- **Warrior Blocking**: Warriors reduce incoming damage.
- **Herbalist Healing**: Herbalists can heal allies.
- **Equipment System**: Nullable equipment system allowing students to collect and equip items from loot tables, plus teacher-created custom equipment with quality tiers and stat bonuses.
- **Visual Feedback**: Health bars display remaining health in green/yellow/red (based on percentage) against a muted red background showing lost health.
**Question Types**: Supports multiple choice, true/false, and short answer questions with configurable time limits. Questions can be randomized per fight via teacher preference, using Fisher-Yates shuffle at combat start.

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

## Deployment & Database Management

### Database Schema Synchronization
**CRITICAL**: Before deploying or publishing the application, ensure the database schema is synchronized with the code:

1. **Push Schema to Database**: Run `npm run db:push` to synchronize the Drizzle schema with the production database
   - If data-loss warnings occur, use `npm run db:push --force` to force the push
   - This command updates the database structure to match `shared/schema.ts`

2. **Required Teacher Fields**: The teachers table requires all of the following fields:
   - `firstName`, `lastName`: Basic teacher information
   - `email`, `password`: Authentication credentials
   - `guildCode`: Auto-generated unique code for organizing students
   - `billingAddress`, `schoolDistrict`, `school`, `subject`, `gradeLevel`: School information
   
3. **Seed Data**: The application automatically seeds default data on startup:
   - Default equipment items (teacherId: 'SYSTEM')
   - Default teacher account (email: teacher@test.com, password: password123)
   - Both seed functions include error handling to prevent crash loops if seeding fails

### Deployment Checklist
Before publishing the application:
1. ✅ Run `npm run db:push` to sync database schema
2. ✅ Verify all environment variables are set (DATABASE_URL, etc.)
3. ✅ Test the application locally with production database
4. ✅ Ensure seed functions complete successfully (check logs for "Default equipment items and teacher account seeded")
5. ✅ Verify the default teacher account can log in

### Common Deployment Issues
**Issue**: "Application trying to insert null values for required fields"
- **Cause**: Database schema not synchronized with code
- **Fix**: Run `npm run db:push --force` to update the production database schema

**Issue**: Application crash loop during startup
- **Cause**: Seed functions failing due to schema mismatch
- **Fix**: The seed functions now have error handling and won't crash the app. Check logs for specific error messages and sync the database schema.