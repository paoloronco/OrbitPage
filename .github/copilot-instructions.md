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
   npm install
   # Terminal 1 - Frontend
   npm run dev
   # Terminal 2 - Backend
   cd server
   npm install
   npm run dev
   ```

2. Build for production:
   ```bash
   npm run build
   cd server
   npm install
   npm start
   ```

### Authentication
- JWT tokens with 7-day expiry
- First setup creates the initial admin password. The initial username is `admin`.

## Project Conventions

### State Management
- API calls centralized in `app/src/lib/api-client.ts`
- Authentication state handled via `auth.ts`
- Theme customization through CSS variables in `index.css`

### Security Patterns
- Rate limiting on authentication endpoints
- Parameterized SQLite queries for DB operations
- Secure cookie handling with HttpOnly flags
- Password strength validation in `auth.js`

### Integration Points
1. Theme System
   - Theme variables in `:root` and `.dark` in `index.css`
   - Components consume CSS variables for consistent styling

2. File Uploads
   - Handled in `server.js` via multer
   - Stored in `app/server/uploads/`

## Common Tasks
1. Adding new link types:
   - Extend `LinkCard.tsx` component
   - Update schema in `server.js`
   - Add validation in frontend forms

2. Theme customization:
   - Modify CSS variables in `index.css`
   - Update `ThemeCustomizer.tsx` for new options
