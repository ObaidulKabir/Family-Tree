# Person Explore Technical Specification

## Scope

This feature extends person data management with:

- living history on the `Person` model
- rich album metadata on the `Photo` model
- protected REST APIs for profile and album access
- a dedicated person explore page under `/dashboard/person/[id]`

## Data Model

### Person

- `educationHistory` JSON
- `professionalHistory` JSON
- `livingHistory` JSON

### Photo

- `albumCategory`
- `ageLabel`
- `locationLabel`
- `isGroupPhoto`
- `peopleTags`
- existing binary image storage via `data` and `mimeType`

## APIs

### `GET /api/person/[id]/profile`

Returns normalized person profile history data for authorized viewers.

### `PATCH /api/person/[id]/profile`

Updates normalized history modules for authorized editors.

### `GET /api/person/[id]/album`

Returns filtered album metadata for authorized viewers.

### `POST /api/person/[id]/album`

Uploads a protected life-history photo with metadata for authorized editors.

### `DELETE /api/person/[id]/album/[photoId]`

Removes an album photo for authorized editors.

## Access Control

All APIs rely on graph membership permission checks through `requireGraphPermissionForPerson`.

- `view` for reads
- `edit` for writes

Photo streaming through `/api/photo/[id]` is also permission-protected.

## Validation

Validation is enforced with Zod-based normalizers in:

- `personHistory.ts`
- `personExplore.ts`

## Search And Filtering

Client-side filters are provided for:

- residence query filtering
- album query filtering
- album category filtering

API-level album filtering also supports query and category parameters.

## Privacy And Data Protection

- access is restricted to authenticated graph members
- write operations require editor permissions
- photo binaries remain behind protected application routes

## Notes

- life-stage labeling is automatically suggested from photo date and date of birth when possible
- external map integration uses generated map-search links from residence data
- cloud object storage and biometric facial recognition are not implemented in this version

