# Branching Strategy

## Goals

- Keep `main` stable and always deployable.
- Isolate all day-to-day development on feature branches.
- Use small, descriptive commits to make changes easy to review and revert.
- Avoid committing secrets (use `.env.example`; keep `.env` local-only).

## Branch Types

### `main`

- Protected branch.
- Only updated via Pull Requests.
- No direct pushes.

### Feature branches

- Used for all development work.
- Created from the latest `origin/main`.
- One feature branch can contain multiple related commits.

Recommended name format:

- `feat/<short-topic>` for new features
- `fix/<short-topic>` for bug fixes
- `chore/<short-topic>` for tooling/maintenance
- `docs/<short-topic>` for documentation changes

Examples:

- `feat/local-dev-isolation`
- `feat/invitations-user-picker`
- `fix/dashboard-root-person`

## Commit Message Standards

Use short, descriptive messages. Recommended format:

- `feat(scope): description`
- `fix(scope): description`
- `docs(scope): description`
- `chore(scope): description`

Rules:

- Use present tense: “add”, “fix”, “update”.
- Keep the first line under 72 characters when possible.
- Prefer multiple small commits over one large commit.

Examples:

- `feat(invite): add user picker for sending invites`
- `fix(ui): show share/edit actions and remove duplicate edit button`

## Daily Workflow

### 1) Sync local `main` with `origin/main`

```bash
git switch main
git fetch origin
git reset --hard origin/main
```

### 2) Create a new feature branch

```bash
git switch -c feat/<short-topic>
```

### 3) Develop with regular commits

```bash
git status
git add <files>
git commit -m "feat(scope): description"
```

### 4) Keep your feature branch up to date

Preferred (rebased feature branch):

```bash
git fetch origin
git rebase origin/main
```

If rebase is not desired, merge instead:

```bash
git fetch origin
git merge origin/main
```

### 5) Push the feature branch

```bash
git push -u origin feat/<short-topic>
```

### 6) Merge into `main` via Pull Request

Recommended PR checks:

- `npm run build`
- `npm run lint`

Merge method:

- Use squash merge when the feature has many small commits and you want one clean commit on `main`.
- Use regular merge when preserving commit history is important.

## Protecting `main` (Local Safety)

To avoid accidentally committing to `main`:

- Always confirm your branch before coding:
  - `git branch --show-current`
- Before committing, verify you are not on `main`.

## Environment / Secrets

- Do not commit `.env` or real credentials.
- Use `.env.example` for documentation.
- Keep local settings in `.env` or `.env.local` (already ignored by `.gitignore`).

## Rollback Plan

### Undo local changes on a feature branch

- Discard uncommitted changes:
  ```bash
  git restore .
  ```
- Undo the last commit but keep changes staged:
  ```bash
  git reset --soft HEAD~1
  ```
- Undo the last commit and discard changes:
  ```bash
  git reset --hard HEAD~1
  ```

### Restore local `main` to match remote

```bash
git switch main
git fetch origin
git reset --hard origin/main
```

### Remove a feature branch

- Delete locally:
  ```bash
  git branch -D feat/<short-topic>
  ```
- Delete remotely:
  ```bash
  git push origin --delete feat/<short-topic>
  ```

