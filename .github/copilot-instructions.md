# OrbitPage AI Agent Instructions

## Project Overview
OrbitPage is a self-hosted public page manager built with React, Express, and SQLite. The application lets people, brands, venues, events, and teams publish one customizable page for links, content, social destinations, and public information.

## Architecture

### Frontend (`app/src`)
- React + Vite application using TypeScript
- Tailwind CSS for styling with a custom design system (`app/src/index.css`)
- Component structure:
  - `app/src/components` - UI components including admin and public views
  - `app/src/hooks` - Custom React hooks
  - `app/src/lib` - Core utilities and API client
  - `app/src/pages` - Main route components (Admin, Index, NotFound)
  - `app/packages/page-schema` - Shared page and block schemas

### Backend (`app/server`)
- Express.js server with SQLite database
- Key modules:
  - `app/server/server.js` - Main Express application
  - `app/server/auth.js` - Authentication logic (JWT + bcrypt)
  - `app/server/database.js` - SQLite operations
  - `app/server/uploads/` - User uploaded assets

## Critical Workflows

### Development
1. Start development:
   ```bash
   cd app
   npm ci
   npm run install:server
   # Terminal 1 - Frontend
   npm run dev
   # Terminal 2 - Backend
   npm run server:dev
   ```

2. Build for production:
   ```bash
   npm run build
   npm run install:server
   npm run start
   ```

### Authentication
- JWT tokens with 12-hour expiry
- Secure contexts keep the AES-GCM-encrypted token in session-scoped `sessionStorage`; non-secure contexts keep it in memory only
- First setup creates the initial admin password. The initial username is `admin`.

## Project Conventions

### State Management
- API calls centralized in `app/src/lib/api-client.ts`
- Authentication state handled via `auth.ts`
- Theme customization through CSS variables in `index.css`

### Security Patterns
- Rate limiting on authentication endpoints
- Parameterized SQLite queries for DB operations
- Bearer-token handling through the centralized API client
- Password strength validation in `auth.js`

### Integration Points
1. Theme System
   - Theme variables in `:root` and `.dark` in `index.css`
   - Components consume CSS variables for consistent styling

2. File Uploads
   - Handled in `server.js` via multer
   - Stored in `DATA_DIR/uploads/` (`app/server/uploads/` is only the local fallback)

## Common Tasks
1. Adding new link types:
   - Extend `LinkCard.tsx` component
   - Update schema in `server.js`
   - Add validation in frontend forms

2. Theme customization:
   - Modify CSS variables in `index.css`
   - Update `ThemeCustomizer.tsx` for new options
