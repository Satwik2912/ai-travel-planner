# AI Travel Planner

AI Travel Planner turns a destination, dates, budget, and travel preferences into a practical, map-aware itinerary. It uses Gemini to draft the plan, Google Maps data to ground recommendations in real places, and a local optimization layer to check routing, time, and budget constraints.

The application also provides Clerk authentication, saved trips backed by PostgreSQL and Prisma, trip history and detail pages, and a chat assistant that can revise an existing itinerary.

## Highlights

- Generate a multi-day itinerary from destination, dates, budget, travelers, interests, food preferences, travel style, and transportation mode.
- Validate destinations and enrich itineraries with Google Places, coordinates, ratings, opening hours, and cost information when available.
- Optimize activities for route efficiency and daily budget constraints.
- Ask the itinerary assistant to change the plan and re-optimize the result.
- Save trips for authenticated users and browse them from the dashboard and trips pages.

## Technology Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Application framework | Next.js 16 App Router | Server-rendered pages, API route handlers, routing, and production builds |
| Language | TypeScript 5 | Static typing across UI, services, API contracts, and database access |
| UI library | React 19 | Interactive planner, itinerary, dashboard, trips, and chat interfaces |
| Styling | Tailwind CSS 3 | Responsive utility-first styling and layout |
| Icons | Lucide React | Consistent interface icons |
| Authentication | Clerk | Sign-up, sign-in, session handling, and authenticated server requests |
| Generative AI | Google Gemini via `@google/generative-ai` | Itinerary generation, itinerary repair, and travel assistant responses |
| Maps | Google Maps JavaScript API | Browser map rendering and map interactions |
| Places | Google Places API and Geocoding API | Destination validation, coordinates, attractions, restaurants, hotels, ratings, and photos |
| Routing | Google Routes services | Route and travel-time support for itinerary optimization |
| Validation | Zod | Runtime validation of trip-generation request payloads |
| State management | Zustand | Client-side trip and itinerary state where needed |
| Database | PostgreSQL on Neon | Persistent users, trips, activities, saved places, profiles, and budgets |
| ORM | Prisma 5 | Typed database client, schema management, and relational queries |
| Package manager | npm | Dependency installation and project scripts |
| Deployment target | Vercel-compatible Next.js deployment | Production hosting for the web application and API routes |

## Prerequisites

- Node.js 20 or newer
- npm
- A PostgreSQL database. Neon is a good fit because Prisma is configured with both pooled and direct connection URLs.
- A Clerk application
- A Google AI Studio API key with Gemini access
- A Google Cloud project with the APIs used by the project enabled and billing configured as required by Google

## Getting Started

### 1. Install dependencies

From this directory:

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root. Keep secret values server-side and never commit this file.

```dotenv
# Google Gemini. Server-only.
GEMINI_API_KEY=your_gemini_api_key

# Google Maps. The NEXT_PUBLIC key is used by the browser map loader.
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_maps_key
GOOGLE_MAPS_SERVER_KEY=your_server_maps_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# PostgreSQL / Neon
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require&channel_binding=require
DIRECT_URL=postgresql://user:password@host/neondb?sslmode=require&channel_binding=require
```

Configure the Clerk sign-in and sign-up URLs to match the paths above. Restrict the browser Google Maps key by HTTP referrer and restrict the server key to the APIs and environments that need it.

### 3. Create the database schema

Apply the Prisma schema to the configured database:

```bash
npx prisma db push
```

The schema stores users, travel profiles, trips, day-by-day activities, saved places, and budget breakdowns. Prisma Client is generated as part of the normal Prisma workflow.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and select **Start Planning**. The planner redirects unauthenticated users to `/sign-in`.

## Application Flow

1. A signed-in traveler submits the planner form at `/planner`.
2. `POST /api/generate-trip` validates the request with Zod.
3. Google Places services validate the destination and collect candidate attractions, restaurants, activities, and hotels.
4. The trip-generation service builds a Gemini prompt and parses, repairs, and validates the generated itinerary.
5. The optimization service adjusts the itinerary for timing, transportation, route efficiency, and budget constraints.
6. Authenticated requests persist the trip and its activities in PostgreSQL.
7. The results page displays the generated plan; saved trips are available from `/trips` and `/dashboard`.

If the generation provider or a downstream service fails, the generation route contains a mock-itinerary fallback for development and testing. Treat fallback output as non-production data.

## Architecture

The application follows a server-first pipeline with a thin interactive client layer:

```text
Planner form
  |
  v
POST /api/generate-trip
  |
  +--> Zod request validation
  +--> Google Geocoding and Places data
  +--> Gemini itinerary generation
  +--> JSON parsing and itinerary repair
  +--> Route, timing, and budget optimization
  +--> Prisma transaction-style nested persistence
  |
  v
Results page and saved trip ID
  |
  +--> GET /api/trips
  +--> GET /api/trips/[tripId]
  +--> Chat assistant for itinerary changes
```

The main business logic is separated into focused services:

- `places-service.ts` handles destination lookup and place search.
- `trip-generation-service.ts` builds prompts, filters candidate places, and repairs generated data.
- `optimization-service.ts` checks time, travel style, route efficiency, and budget constraints.
- `routes-service.ts` provides route-related integrations.
- `chat-service.ts` supports itinerary assistant interactions.
- `prisma.ts` exposes a development-safe Prisma client singleton.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Landing page and authentication entry points |
| `/planner` | Authenticated trip-planning form |
| `/trips/results` | Generated itinerary results |
| `/trips` | Saved trips for the current user |
| `/dashboard` | Authenticated travel dashboard |
| `/sign-in` | Clerk sign-in page |
| `/sign-up` | Clerk sign-up page |

## API Reference

### `POST /api/generate-trip`

Accepts JSON with the following fields:

```json
{
  "destination": "Tokyo",
  "startDate": "2026-10-01",
  "endDate": "2026-10-05",
  "budget": 1800,
  "currency": "USD",
  "travelers": 2,
  "travelStyle": "balanced",
  "transportation": "public_transport",
  "interests": ["food", "history"],
  "foodPreferences": ["local_cuisine"]
}
```

Returns an optimized itinerary, destination coordinates, summary, real-place data, and optimization status. When the request is authenticated, it also returns the persisted trip ID.

### `POST /api/chat`

Accepts a message, the current itinerary context, and optional conversation history. It returns a Gemini-generated response. Requests that imply itinerary changes also return a re-optimized itinerary, a change summary, and validation results.

### `GET /api/trips`

Returns saved trips belonging to the current Clerk user.

### `GET /api/trips/[tripId]`

Returns one saved trip and its mapped day/activity data. Access is scoped to the authenticated user.

## Project Structure

```text
src/
  app/                 Pages and App Router API routes
  components/          Shared React components
  lib/                 Gemini, Maps, Prisma, generation, and optimization services
  types/               Shared TypeScript types
prisma/
  schema.prisma        PostgreSQL data model
```

The main server-side pipeline lives in `src/lib/trip-generation-service.ts`, `src/lib/places-service.ts`, `src/lib/optimization-service.ts`, and `src/app/api/generate-trip/route.ts`.

## Database Model

Prisma defines the following relational entities:

| Model | Responsibility |
| --- | --- |
| `User` | Maps a Clerk user to application data and owns trips and saved places |
| `TravelProfile` | Stores reusable travel preferences such as interests, budget level, hotel rating, and travel modes |
| `Trip` | Stores destination, date range, budget, travelers, preferences, and estimated cost |
| `TripDay` | Represents one calendar day within a trip |
| `Activity` | Stores an itinerary activity, schedule, place details, rating, website, and estimated cost |
| `SavedPlace` | Stores places saved by a user for future planning |
| `BudgetBreakdown` | Stores accommodation, transportation, food, activities, shopping, miscellaneous, and emergency budgets |

Trips are scoped to the authenticated Clerk user. Trip detail queries verify both the trip ID and the owning application user before returning records.

## Development Commands

```bash
npm run dev       # Start the local development server
npm run build     # Create a production build
npm run start     # Serve the production build
npx eslint .       # Run ESLint directly
npx prisma studio # Inspect database records locally
```

Run `npx prisma db push` again whenever the schema changes during local development. For a production migration workflow, replace schema pushes with reviewed Prisma migrations.

## Troubleshooting

- **Clerk configuration errors:** confirm both Clerk keys are present and that the sign-in/sign-up URLs point to `/sign-in` and `/sign-up`.
- **Gemini errors:** verify `GEMINI_API_KEY` is present in the server environment and that the account can access the configured Gemini model.
- **Maps or places errors:** check API enablement, billing, key restrictions, and whether the browser and server keys are assigned to the correct variables.
- **Prisma `P1001`:** verify the database host is reachable and the Neon branch is active.
- **Prisma `P1010`:** verify the database role can access the configured database and schema.
- **Unexpected database values:** `.env` and `.env.local` are both ignored by Git, but conflicting local values can still affect development. Keep one intentional set of connection values.
- **Invalid date range:** the end date must be after the start date.

## Security Notes

- Do not commit `.env`, `.env.local`, API keys, or database connection strings.
- `GEMINI_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, and `DIRECT_URL` are server credentials.
- Apply least-privilege restrictions to Google Cloud keys and rotate any credential that is exposed.
- Trip persistence and trip reads are tied to the authenticated Clerk user; do not bypass those checks when adding new endpoints.

## Resume / CV Description

### AI Travel Planner | Full-Stack Web Application

Built a full-stack AI travel-planning platform that converts destination, date, budget, traveler, food, interest, and transportation preferences into optimized multi-day itineraries. Integrated Google Gemini for itinerary generation and conversational trip updates, Google Maps Platform for geocoding, real-place discovery, ratings, coordinates, and mapping, and implemented validation and optimization services to improve schedule feasibility, route efficiency, and budget adherence. Added Clerk authentication and Prisma/PostgreSQL persistence on Neon for user profiles, saved trips, day-by-day activities, saved places, and budget breakdowns.

### Resume Bullet Points

- Developed a full-stack AI travel planner with Next.js App Router, React, TypeScript, Tailwind CSS, Google Gemini, Google Maps Platform, Clerk, Prisma, and PostgreSQL.
- Designed an itinerary-generation pipeline that validates user input with Zod, enriches recommendations with real Google Places data, repairs AI-generated JSON, and optimizes schedules against timing, transportation, and budget constraints.
- Implemented authenticated persistence using Clerk and Prisma, including relational storage for users, travel profiles, trips, trip days, activities, saved places, and budget breakdowns on Neon PostgreSQL.
- Built REST API routes for trip generation, saved-trip listing, saved-trip detail retrieval, and Gemini-powered itinerary assistance.
- Created responsive planner, dashboard, itinerary-results, saved-trips, map, and chat experiences using React, Tailwind CSS, Zustand, and Lucide React.

### Technologies for CV

`Next.js`, `React`, `TypeScript`, `Tailwind CSS`, `Google Gemini API`, `Google Maps Platform`, `Google Places API`, `Geocoding API`, `Clerk`, `Prisma`, `PostgreSQL`, `Neon`, `Zod`, `Zustand`, `REST APIs`, `Vercel`
