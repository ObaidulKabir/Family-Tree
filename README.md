# Family Tree Application

A collaborative family tree manager built with Next.js, Prisma, and NextAuth.js.

## Features

- **Multi-user Support**: Users can register and manage their own family trees.
- **Family Tree Visualization**: Interactive tree view to browse relatives node-by-node.
- **Relationship Management**: Add parents, spouses, and children. Relationships are derived from core events (Birth, Marriage).
- **Flexible Data Entry**: Support for incomplete data (e.g., unknown birth dates) and ancestor data.
- **Invitation System**: Invite other users to claim a person in your tree, linking their account to that profile.
- **Photos**: Add photos to person profiles (via URL).

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Setup Database**:
    The project uses Prisma. For local development you can use any Postgres database, or SQLite if you keep `DATABASE_URL` pointed to a local file.
    ```bash
    npx prisma migrate dev
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

4.  **Open Browser**:
    Visit `http://localhost:3000` to start using the app.

## Environment Variables

Create a `.env` file (or `.env.local`) based on [.env.example](./.env.example).

Required:

- `DATABASE_URL` (Postgres connection string)
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`) for NextAuth/Auth.js sessions (required in production)

Optional:

- `NEXT_PUBLIC_APP_URL` (used to generate invite links; set to your deployed URL in production)

## Usage

-   **Register/Login**: Create an account to start your tree. A root person representing you is created automatically.
-   **Dashboard**: View your family tree.
-   **Add Relatives**: Click "Add Parent/Spouse/Child" buttons to expand the tree.
-   **Edit Person**: Click "Edit" on a person's card to update details or add a photo.
-   **Invite**: Click "Invite" on a person's card to generate a link. Send this link to a family member. When they accept (while logged in), they will "become" that person in the tree.

## Invitations

Invitations let you generate a link so someone can claim a person profile in your tree.

### Create an Invite Link

1. Open the dashboard and navigate to the person you want to invite.
2. Click the Invite button to open the invite modal.
3. Optionally enter an email (stored for tracking; this demo does not send email automatically).
4. Click Generate Invite Link and copy the link.

Implementation:

- UI modal: [InviteModal.tsx](file:///c:/Users/HP/Documents/trae_projects/FamilyTree/family-tree/src/components/family/InviteModal.tsx)
- Server action: [inviteUser](file:///c:/Users/HP/Documents/trae_projects/FamilyTree/family-tree/src/actions/invitation.ts#L8-L42)
- DB table: `Invitation` model in [schema.prisma](file:///c:/Users/HP/Documents/trae_projects/FamilyTree/family-tree/prisma/schema.prisma#L182-L194)

### Accept an Invite (Claim a Profile)

1. Open the invite link (format: `/invite/:token`).
2. If you are not logged in, you will be redirected to login and then back to the invite page.
3. Click Accept Invitation.

Implementation:

- Page: [invite/[token]/page.tsx](file:///c:/Users/HP/Documents/trae_projects/FamilyTree/family-tree/src/app/invite/[token]/page.tsx)
- Server action: [acceptInvitation](file:///c:/Users/HP/Documents/trae_projects/FamilyTree/family-tree/src/actions/invitation.ts#L44-L185)

Behavior:

- The invitation record is looked up by `token` and must be `PENDING`.
- The invited person (`Invitation.personId`) is linked to the logged-in user (`Person.linkedUserId`), and the user’s `rootPersonId` is updated.
- If the user already has a different root person, the code merges/moves relationships (families, events, photos) from the source person to the invited target person and then deletes the old source person.

## Deploying to Vercel (Postgres)

1. Create a Postgres database (Neon, Supabase, or Vercel Postgres).
2. In Vercel → Project → Settings → Environment Variables, set:
   - `DATABASE_URL`
   - `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
   - `NEXT_PUBLIC_APP_URL` (recommended)
3. Deploy/redeploy. The project uses a Vercel build command defined in [vercel.json](./vercel.json).

## Exporting Data

You can export your data to JSON:

- CLI:
  ```bash
  npm run export:json
  ```
- API (requires login):
  - `GET /api/export`

## Technologies

-   Next.js 16 (App Router)
-   Prisma
-   NextAuth.js v5
-   Tailwind CSS
