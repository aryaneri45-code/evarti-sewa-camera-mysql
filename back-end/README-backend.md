# Evarti backend

REST API for the Evarti rental MVP. Uses Express and MySQL by default. SQLite
remains available for tests and importing legacy data.

## Requirements and local setup

- Node.js 20 or newer
- npm

```sh
cp back-end/.env.example .env
```

Set unique passwords of at least 12 characters for all three accounts and a
random `SESSION_SECRET` of at least 32 characters in `.env`. Also set the
MySQL host, port, username, password, and existing database name. For example,
use `openssl rand -base64 48` to generate a session secret. Do not commit `.env`.

```sh
npm install
npm run dev
```

`npm run dev` from the project root starts the frontend and API together. The
backend can be run separately with `npm run dev:backend` from the project root.
The default API URL is `http://localhost:3000`. On first launch the API creates
its MySQL tables and seeds the camera catalog plus the three accounts:

| Username | Role | Assigned transaction location |
|---|---|---|
| `owner` | Owner | Cafe or Event, selected per transaction |
| `kasir1` | Kasir 1 | Cafe, enforced by the API |
| `kasir2` | Kasir 2 | Event, enforced by the API |

All initial account passwords come from environment variables. Changing those
variables after the accounts have been seeded does not reset existing password
hashes; use an account-management migration/tool before deployment to rotate
credentials.

## Session and request security

- Login creates a random server-side session with an eight-hour expiry and sets
  an `HttpOnly`, `SameSite=Strict` cookie.
- `POST`, `PUT`, and `PATCH` requests require the `X-CSRF-Token` returned by
  login or `GET /api/auth/me`.
- The frontend origin must be listed in `FRONTEND_ORIGIN` (comma-separated when
  multiple origins are needed).
- Production requires HTTPS and `COOKIE_SECURE=true`.
- The API listens only on `127.0.0.1`; use a same-host reverse proxy for
  external access rather than exposing the API port directly.
- Passwords are stored as bcrypt hashes. Login attempts are rate-limited.
- Upload directories are not publicly exposed. Restrict MySQL network access
  and grant the application account access only to its database.
- Cashiers only list/read their own transactions. Owner-only camera changes,
  voids, reports, and audit-log access are enforced by the API.
- Guarantee images are stored outside the public directory and served only via
  an authorized transaction endpoint. Camera and guarantee uploads are limited
  to JPG/PNG/WebP and checked against the file signature.

## API overview

All responses use JSON unless noted; errors are returned as
`{ "error": { "code": "...", "message": "..." } }`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public, rate-limited | Login; returns user, CSRF token, expiry |
| `POST` | `/api/auth/logout` | Login + CSRF | End current session |
| `GET` | `/api/auth/me` | Login | Current user and CSRF token |
| `GET` | `/api/cameras` | Login | Active catalogue; Owner also sees inactive cameras |
| `POST` | `/api/cameras` | Owner + CSRF | Create camera (`name`, `price1`, `price2`) |
| `PUT` | `/api/cameras/:id` | Owner + CSRF | Update name and catalogue prices |
| `DELETE` | `/api/cameras/:id` | Owner + CSRF | Delete camera; transaction snapshots are retained |
| `PATCH` | `/api/cameras/:id/active` | Owner + CSRF | Enable/disable a camera |
| `POST` | `/api/cameras/:id/image` | Owner + CSRF | Upload multipart field `image` (max. 3 MB) |
| `GET` | `/api/cameras/:id/image` | Login | Read camera image |
| `GET` | `/api/addons` | Login | List active add-ons; Owner also sees inactive options |
| `POST` | `/api/addons` | Owner + CSRF | Create an add-on |
| `PUT` | `/api/addons` | Owner + CSRF | Update add-on labels, prices, and active status |
| `DELETE` | `/api/addons/:id` | Owner + CSRF | Delete an add-on; transaction snapshots are retained |
| `POST` | `/api/transactions` | Login + CSRF | Create transaction; JSON or multipart |
| `GET` | `/api/transactions` | Login | Own transactions, or Owner transactions with filters |
| `GET` | `/api/transactions/:id` | Owner or creator | Transaction detail, including own/authorized guarantee data |
| `GET` | `/api/transactions/:id/guarantee-photo` | Owner or creator | Private guarantee photo |
| `PATCH` | `/api/transactions/:id/verify` | Owner or creator + CSRF | Verify pending QRIS payment |
| `PATCH` | `/api/transactions/:id/void` | Owner + CSRF | Void transaction; requires reason |
| `POST` | `/api/transactions/:id/print` | Owner or creator + CSRF | Record a print/reprint |
| `GET` | `/api/reports/summary` | Login | Summary; Owner can filter cashier/location/date |
| `GET` | `/api/reports/summary/pdf` | Owner | Download summary PDF |
| `GET` | `/api/audit-logs` | Owner | Recent sensitive-action audit logs |

Transaction creation expects `customerName`, `customerWhatsapp`, `startTime`,
`endTime`, `total`, and `paymentMethod`; `location` is required for Owner but
ignored and assigned by the server for cashiers. Send `items` as an array with
one entry per camera: `cameraId`, `durationMinutes`, `price`, and
`isManualPrice`, plus optional `manualNote`. Each item can have its own
duration and price. Catalogue prices are rechecked for one- and two-hour
rentals; manual prices are allowed only for durations above two hours. The
transaction end time must match the longest item duration. The API sums camera
prices and selected add-on prices to validate `total`. Cash payments also require
`amountReceived`. WhatsApp numbers are normalized before saving.
`customerPagerNumber` is optional; when provided, it is saved with the
transaction and included in the receipt.
Optional `addonIds` contains selected add-on catalogue IDs. The server verifies
the current active options and prices, allows multiple property add-ons, and
allows at most one photographer, print, and file-transfer option per
transaction. Add-on names and prices are snapshotted with the transaction, and
their prices are included in the validated total. File-transfer options start
at no charge. Owners can edit labels, prices, and availability from the
Katalog kamera page.

For a guarantee photo, send `multipart/form-data` with a JSON string in the
`payload` field plus an optional `guaranteePhoto` file. The JSON must set
`guaranteeType` to `photo`. The file limit is 2 MB. ID-number guarantees use
`guaranteeType: "id_number"` and `guaranteeIdNumber` in JSON; `none` is allowed.
Sensitive guarantee values are omitted from transaction list responses and are
never included in receipt/print responses.

List filters include `location=cafe|event`, `date=YYYY-MM-DD`, `status`, and
`manual=true|false`. Owner may also use `cashier=kasir1|kasir2`; cashiers cannot
override their own-user scope. `limit` (max 100) and `offset` are supported.
Reports accept `from` and `to` dates, or a single `date`.

## Tests

```sh
npm test
```

Tests use in-memory SQLite databases and temporary upload directories. The
frontend uses the API client in `Front-end/src/services/api.js`, including
session credentials and the CSRF header for state-changing requests.

### Manual transaction add-on

`POST /api/transactions` accepts an optional `manualAddon: { label, price }` in
addition to catalog `addonIds`. The trimmed label must contain 1–100 characters;
price must be an integer from 0 to 100,000,000 IDR. The server adds it to the
validated catalog/rental prices and checks the submitted total. The service is
saved only in `transaction_addons`, never in the reusable catalog. Its generated
`manual-addon-` ID identifies a manual snapshot; API responses expose
`isManual: true`. It uses the existing generic `property` storage category for
compatibility with current SQLite constraints and MySQL schemas. Receipt views
label it as “Add-on”. Creation is recorded as `manual_addon_created`.
