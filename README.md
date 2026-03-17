# Loft Chat

Loft Chat is a self-hostable, team chat application. It features everything you would expect from Slack, and nothing more.

## Features

- **Real-time Messaging**: Instant delivery via WebSockets + PostgreSQL `LISTEN/NOTIFY` with automatic reconnection and heartbeat monitoring.
- **Channels & DMs**: Public/private channels, direct messages, starred lists, archiving.
- **Threaded Conversations**: Thread replies with a dedicated panel.
- **Unread + Notifications**: Unread badges, browser notifications, per-channel/DM preferences (All, Mentions, Mute).
- **Search**: Find channels, people, and message content across the organization.
- **Message Tools**: Edit/delete, reactions, @mentions, pinning, bookmarks.
- **Uploads & Storage**: File/image uploads with quotas, local or S3-compatible storage backends.
- **Custom Emoji**: Organization-specific emoji with image uploads (admin only).
- **Presence & Typing**: Online/away/offline presence plus typing indicators.
- **User Management**: Profiles, admin tooling, invitation links, password reset.
- **Multi-Organization**: Support for multiple workspaces per deployment.
- **Markdown**: GitHub-flavored Markdown rendering in messages.
- **Responsive UI**: React + TailwindCSS + ShadCN.
- **Self-Hostable**: Simple setup via Docker or local installation.

## Quickstart


### 1. Clone the Repository

```bash
git clone https://github.com/loft/loft-open-source.git
cd loft-open-source
```

### 2. One-Command Start

A single command starts the entire stack: PostgreSQL, the Fastify backend (with automatic migrations), and the Vite frontend.

```bash
docker-compose up --build
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **Database Admin (PgAdmin)**: [http://localhost:5050](http://localhost:5050) (Login: `admin@admin.com` / `admin`)

---

### Railway (I just like them)

Railway deployments are split into **separate services** (backend, frontend, and database). The repository is a monorepo, so each Railway service should target its own root directory.
**1) Backend service (Fastify)**
- Create a new Railway service connected to this repo.
- Set the service **Root Directory** to `/server`.
- Required variables:
  - `DATABASE_URL` (from Railway Postgres)
  - `BETTER_AUTH_SECRET`
  - `BETTER_AUTH_URL` (`https://api.example.com/api/auth`)
  - `FRONTEND_URL` (`https://app.example.com`)
  - `CORS_ALLOWED_ORIGINS` if you need to allow additional browser origins
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` if enabling Google OAuth
  - Storage vars if using S3/MinIO (didn't test this, let me know if it works)

**2) Create a Railway project + Postgres**
- Add a **Postgres** db in Railway
- Add the Postgres `DATABASE_URL` into your backend service variables from the provided prompt under backend variables


**3) Frontend service (Vite)**
- Create a second Railway service connected to this repo.
- Set the service **Root Directory** to `/client`.
- Required variables:
  - `VITE_API_URL` (`https://api.example.com`)

### Environment Variables

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env` before starting any service.

#### Backend Variables (`server/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `BETTER_AUTH_SECRET` | Secret for JWT signing | Required |
| `BETTER_AUTH_URL` | Backend URL for auth callbacks | Required |
| `FRONTEND_URL` | Frontend URL for CORS and links | Required |
| `CORS_ALLOWED_ORIGINS` | Extra allowed browser origins, comma-separated | Optional |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Optional |
| `UPLOAD_DIR` | Local upload directory | `uploads` |
| `STORAGE_BACKEND` | `local`, `s3`, or `minio` | `local` |
| `STORAGE_BUCKET`, `STORAGE_REGION`, etc. | S3 configuration | Optional |
| `MAX_UPLOAD_SIZE_MB` | Maximum file size | `25` |
| `ORG_STORAGE_QUOTA_MB` | Organization storage limit | `0` (unlimited) |
| `USER_STORAGE_QUOTA_MB` | Per-user storage limit | `0` (unlimited) |

#### Frontend Variables (`client/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:4000` |

### Google OAuth Setup

Google OAuth is optional. To enable it:

1. Create a Google OAuth Web application.
2. Set the authorized JavaScript origin to your frontend URL, for example `https://app.loftchat.com`.
3. Set the authorized redirect URI to your backend auth callback:
   - Production example: `https://api.loftchat.com/api/auth/callback/google`
   - Local example: `http://localhost:4000/api/auth/callback/google`
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the backend environment.

The first workspace bootstrap remains email/password only. Google OAuth is available for normal sign-in and invite-based sign-up.

### Frontend on `app.`, API on `api.`

Hosting the frontend on `app.example.com` and the backend on `api.example.com` is a standard deployment model.

- `FRONTEND_URL` should be the exact frontend origin: `https://app.example.com`
- `BETTER_AUTH_URL` should include the auth base path on the API origin: `https://api.example.com/api/auth`
- `VITE_API_URL` should point to the API origin: `https://api.example.com`
- `CORS_ALLOWED_ORIGINS` should usually be empty unless you have additional browser origins that must call the API

Use exact origin allowlists for credentialed requests. Avoid wildcard origins such as `*` or `https://*.example.com`.

---

## Usage

1. **Register**: Go to `/register` once the frontend is up. The first user becomes the workspace admin.
2. **Invite Users**: As admin, go to Workspace Settings to generate invitation links.
3. **Setup Profile**: Personalize your name and bio in Settings.
4. **Chat**: Chat in `#general`, create channels, or start DMs.

---

## Project Structure

```
loft-open-source/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── contexts/       # React contexts (Organization, Presence)
│   │   ├── hooks/          # Custom hooks (useChatSocket, useMarkAsRead)
│   │   ├── lib/            # API client, auth client, utilities
│   │   ├── pages/          # Route pages
│   │   └── types/          # TypeScript types
│   └── ...
├── server/                 # Fastify backend
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── schemas/        # Zod validation schemas
│   │   ├── plugins/        # Fastify plugins
│   │   ├── errors/         # Custom error classes
│   │   ├── utils/          # Utilities (storage, password, etc.)
│   │   ├── config/         # Configuration management
│   │   ├── realtime.ts     # WebSocket + presence handling
│   │   ├── auth.ts         # BetterAuth configuration
│   │   └── app.ts          # Fastify app setup
│   └── prisma/
│       └── schema.prisma   # Database schema
└── docker-compose.yml      # Full-stack Docker setup
```

## License

AGPL-3.0. See `LICENSE`.
