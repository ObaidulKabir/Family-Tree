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
    The project uses SQLite by default.
    ```bash
    npx prisma db push
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

4.  **Open Browser**:
    Visit `http://localhost:3000` to start using the app.

## Usage

-   **Register/Login**: Create an account to start your tree. A root person representing you is created automatically.
-   **Dashboard**: View your family tree.
-   **Add Relatives**: Click "Add Parent/Spouse/Child" buttons to expand the tree.
-   **Edit Person**: Click "Edit" on a person's card to update details or add a photo.
-   **Invite**: Click "Invite" on a person's card to generate a link. Send this link to a family member. When they accept (while logged in), they will "become" that person in the tree.

## Technologies

-   Next.js 16 (App Router)
-   Prisma (SQLite)
-   NextAuth.js v5
-   Tailwind CSS
