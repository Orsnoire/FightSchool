# RPG Combat Quiz Platform

## Overview

An educational platform that transforms quiz-based learning into an immersive RPG combat experience. Teachers create quiz "fights" with questions and enemies, while students join battles as fantasy characters (Knight, Wizard, Scout, Herbalist), answering questions to deal damage and defeat enemies. The system features real-time multiplayer combat, character customization with equipment, and class-based gameplay mechanics.

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
- Class-specific colors (Knight/blue, Wizard/purple, Scout/DPS, Herbalist/green)
- Custom fonts: 'Cinzel' or 'Marcellus' for headers, 'Inter' or 'DM Sans' for body text

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js. The server handles both REST API endpoints and WebSocket connections for real-time combat.

**Real-Time Communication**: WebSocket implementation using the 'ws' library for live combat sessions:
- Separate connections for hosts (teachers) and students
- Real-time combat state broadcasting
- Question delivery and answer validation
- Phase transitions and game over events

**Data Storage Strategy**: In-memory storage (MemStorage class) implementing the IStorage interface:
- Students: nickname, password hash, class code, character class, gender, equipment
- Fights: quiz configuration with questions, enemies, and class code
- Combat Sessions: active game state with players, enemies, current phase, and question

**Authentication**: Password-based authentication using Node.js crypto (scrypt) for secure password hashing. Student sessions tracked via localStorage on client and WebSocket connections on server.

### API Structure

**REST Endpoints**:
- Teacher: `/api/fights` (CRUD operations for quiz battles)
- Student: `/api/student/register`, `/api/student/login`, character/equipment updates
- Fight discovery: Students can query available fights by class code

**WebSocket Protocol**: Custom message-based protocol with types:
- `join`: Student joins combat session
- `host`: Teacher starts hosting a fight
- `combat_state`: Broadcast current game state
- `question`: Deliver questions to students
- `answer`: Student answer submission
- `phase_change`: Combat phase transitions
- `game_over`: Victory/defeat resolution

### Game Mechanics Architecture

**Character Classes**: Four distinct classes with unique stats (health, attack, defense):
- Knight (Tank): High health, moderate attack/defense
- Wizard/Scout (DPS): High attack, lower health/defense
- Herbalist (Healer): Balanced stats with healing abilities

**Combat System**:
- Turn-based question phases
- Correct answers deal damage to enemies
- Incorrect answers result in player damage
- Healing mechanics for Herbalist class
- Equipment system with weapons, headgear, and armor affecting stats

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
The application uses pre-generated character sprites stored in `/attached_assets/generated_images/` for each class and gender combination (Knight, Wizard, Scout, Herbalist × Male/Female).