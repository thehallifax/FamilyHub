# Household deployment (LAN HTTPS and local staging)

The default production stack runs the built FamilyHub PWA and a reverse proxy
in one Caddy container, our owned `family-hub-api` source build in a second
container, and PostgreSQL in a third. Only HTTPS port 443 is published, bound
to one configured LAN IPv4 address. The backend and database have no published
ports. Do not add a router port forward or expose this stack to the Internet.
The two repositories remain separate, normally as sibling directories:
`FamilyHub/` and `family-hub-api/`. Docker builds both images; Java and Maven
are not required on the host.

Obtain the backend from our fork (the `upstream` remote is for reviewing
upstream changes, not for deployment):

```sh
cd /path/containing
git clone https://github.com/thehallifax/family-hub-api.git
git -C family-hub-api remote add upstream https://github.com/joe-bor/family-hub-api.git
```

If the backend checkout already exists, use it; do not clone over it. For
local staging, the backend checkout must be the sibling `../family-hub-api`.
The base Compose file resolves that path from the frontend repository.

## MacBook local staging (HTTP, trusted LAN)

Use this mode to validate the **same three-container stack** without dealing
with LAN certificates. First create `.env` and fill its secrets as described
below. `FAMILYHUB_LAN_IP` must still be set because the base production file
requires it, but the local override does not publish that address. Docker
Compose 2.24.4 or newer is required for the override syntax.

```sh
docker compose -f compose.yaml -f compose.local.yaml config --quiet
docker compose -f compose.yaml -f compose.local.yaml up -d --build --wait
docker compose -f compose.yaml -f compose.local.yaml ps
curl -fsS http://localhost:8080/api/health
```

Open `http://localhost:8080/` on the MacBook or
`http://<MacBook-LAN-IP>:8080/` from a trusted LAN device. Only Caddy is
published, with host `0.0.0.0:8080` mapped to its plain HTTP container port
80; backend and PostgreSQL remain private. `/api` still goes through Caddy.
Do not port-forward this development HTTP endpoint or use it on an untrusted
network. `localhost` is a browser secure context, but plain HTTP at a LAN IP
is not: the iPad can test the web UI, but service workers require a secure
context, so HTTP LAN staging does not validate installed-PWA/offline behavior.
Google Calendar stays disabled unless credentials are deliberately supplied.

The local and production commands use the same Compose project and persistent
database. Switching modes recreates affected containers but does not erase
data. **Always include both `-f` arguments for local `up` commands**; running
`docker compose up` with only the base file switches Caddy back to LAN HTTPS.
Check `docker compose -f compose.yaml -f compose.local.yaml ps` after starting
and confirm it shows `0.0.0.0:8080->80/tcp`, not a published `:443` port.
To return to the LAN HTTPS configuration, use the base file **alone**:

```sh
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --build --wait
docker compose -f compose.yaml ps
```

Do not use `down -v` when switching modes. The local Caddyfile is selected only
by `compose.local.yaml`, and local Caddy uses temporary `/data` and `/config`
storage rather than the production certificate volumes. The production
Caddyfile and LAN-address port 443 binding remain unchanged.

## Version combination

| Component | Pin | Update in |
| --- | --- | --- |
| Frontend source/image | Current FamilyHub checkout; local image `familyhub-frontend:${FAMILYHUB_FRONTEND_IMAGE_TAG:-dev}` | Git checkout and `.env` |
| Backend source/image | Our fork, based on upstream `v1.9.0` (`70efbf4e51fba2d396c41fb1cfaef657d6dc2126`); local image `familyhub-backend:${FAMILYHUB_BACKEND_IMAGE_TAG:-dev}` | Backend Git checkout and `.env` |
| PostgreSQL | `16.15-alpine` (major 16) plus image digest | `compose.yaml` |
| Frontend build | Node `22.23.3-bookworm-slim` plus image digest | `Dockerfile` |
| Static server/proxy | Caddy `2.11.4-alpine` plus image digest | `Dockerfile` |

The current `dev` backend tag is for staging only: it is **not** a reproducible
production pin while the Milestone 2B changes are uncommitted. Before Mac mini
deployment, commit/review the two repositories in a separate authorized step,
record both exact commits, check out those commits, and set
`FAMILYHUB_BACKEND_IMAGE_TAG` to the approved backend commit's short SHA. Do
not use a mutable branch as the production version. Run the acceptance checks
below before using household data. PostgreSQL major 16 is also used by the backend's PostgreSQL
Testcontainers tests. Never point this frontend checkout at backend 1.6.0: the
frontend uses list categories, meal-plan batch save, and bulk list append added
in backend 1.7.0, 1.8.0, and 1.9.0 respectively.

## Prerequisites and first start

- Docker with the Compose plugin, enough free disk for database growth and
  backups, and a reserved LAN IPv4 address for this host.
- On the 2014 Intel Mac mini, confirm that its macOS and Docker installation can
  run the stack before moving household data. Our backend Dockerfile uses
  Eclipse Temurin Java 21 base images and supports amd64 without emulation.
- Keep development tooling on the MacBook. The Mac mini needs Docker, pinned
  checkouts/build contexts of **both** repositories, `.env`, and restored data.

From this repository:

```sh
cp .env.example .env
chmod 600 .env
```

Edit `FAMILYHUB_LAN_IP` to the host's reserved LAN IPv4 address. Replace each
empty secret using independent values from:

```sh
openssl rand -base64 48  # JWT_SECRET
openssl rand -base64 32  # TOKEN_ENCRYPTION_KEY
openssl rand -hex 32     # POSTGRES_PASSWORD
```

Put the values in `.env`, without putting secrets in `VITE_*` settings. Keep a
secure copy of `.env` outside this repository. `TOKEN_ENCRYPTION_KEY` must be
kept alongside backups if Google Calendar is enabled; a restored database's
Google tokens cannot be decrypted without it. `JWT_SECRET` must be retained to
keep existing sessions valid. The Compose frontend build always sets
`VITE_API_BASE_URL=/api`, so the browser talks to the same origin in either
mode.

For a future production deployment, first verify that **both** checkouts are
clean and at the reviewed commits, then use those commits to tag the locally
built images. Example (after the Milestone 2B changes have been committed by
the owner):

```sh
git -C /path/containing/FamilyHub status --short
git -C /path/containing/family-hub-api status --short
git -C /path/containing/FamilyHub switch --detach APPROVED_FRONTEND_COMMIT
git -C /path/containing/family-hub-api switch --detach APPROVED_BACKEND_COMMIT
cd /path/containing/FamilyHub
FAMILYHUB_FRONTEND_IMAGE_TAG=$(git rev-parse --short=12 HEAD) FAMILYHUB_BACKEND_IMAGE_TAG=$(git -C ../family-hub-api rev-parse --short=12 HEAD) docker compose -f compose.yaml up -d --build --wait
```

The approved commit placeholders must be replaced with actual reviewed SHAs;
there is no Milestone 2B release SHA yet. Never update the backend without a
database backup and restore rehearsal. `FAMILYHUB_BACKEND_CONTEXT` may point
to a different backend checkout path; it must be a trusted, pinned checkout.
The backend Dockerfile pins reviewed multi-architecture Java 21 build/runtime
base-image digests. Record the built image IDs for rollback as well; Maven
dependencies remain fixed by the backend POM, but external repositories and
build tooling should still be treated as supply-chain inputs.

```sh
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --build --wait
docker compose -f compose.yaml ps
```

`db` must become healthy before `backend` starts, and `backend` must become
healthy before `frontend` starts. Flyway migrations run during backend startup.
The first build downloads npm packages and container images, so allow time for
it on the Mac mini. The frontend container serves only Vite's built `dist/`
assets. Neither Node nor Vite runs in the serving container.

## HTTPS and the iPad PWA

Caddy issues an internal TLS certificate for `FAMILYHUB_LAN_IP`; it does not
request a public certificate. Its private CA and certificates persist in the
`familyhub_caddy_data` Docker volume. Each client must trust the CA before
Safari can use the HTTPS site and its service worker. Export **only** the public
root certificate to a safe location outside the repository:

```sh
docker compose cp frontend:/data/caddy/pki/authorities/local/root.crt /path/outside/repo/familyhub-root.crt
```

Transfer that certificate to the iPad using a trusted local method, install
the downloaded profile in Settings, then enable full trust at **Settings →
General → About → Certificate Trust Settings**. Never distribute the private
CA key. Visit `https://LAN_IP/` in Safari after trust is enabled, then use
Safari's Share menu → **Add to Home Screen**. Use the same URL on phones and
desktop browsers. Avoid changing the LAN IP after installation; a new address
requires updating `.env`, rebuilding/restarting the stack, and revisiting the
site on clients.

## Daily operation and checks

```sh
docker compose ps
docker compose logs --tail=100 frontend backend db
docker compose logs -f backend
docker compose stop
docker compose start
docker compose down
```

`docker compose down` leaves the named PostgreSQL and Caddy volumes intact.
**Never use `docker compose down -v` on a household stack.** Replacing a
container or updating an image also leaves those volumes intact.

With the exported CA certificate, check both paths through the one entry point:

```sh
curl --cacert /path/outside/repo/familyhub-root.crt https://LAN_IP/
curl --cacert /path/outside/repo/familyhub-root.crt https://LAN_IP/api/health
docker compose exec -T db pg_isready -U familyhub -d familyhub
docker compose logs backend
```

Replace `LAN_IP` with the value in `.env`. A successful health response does
not itself prove database queries work. Complete registration in the UI, log
out and log in, create a list item, restart the backend container, and confirm
the item remains. Check from another LAN device, including the iPad, when one
is available. The backend uses one shared family login. Registration is not
disabled after setup, so keep the service on a trusted LAN.

## Backups and restore

Store backups outside this repository, ideally also on another physical
device. If a backup directory is created inside the checkout, `backups/` and
`*.dump` are Git-ignored, but off-host storage is still essential. Run:

```sh
mkdir -p /path/outside/repo/familyhub-backups
bash scripts/household-backup.sh /path/outside/repo/familyhub-backups
```

The script writes a PostgreSQL custom-format archive with restrictive file
permissions and checks that `pg_restore` can read its directory. A listing
check is not a restore test. Rehearse restoration using a separate, disposable
Compose project and volume while your main stack stays running:

```sh
docker compose -p familyhub-restore-check up -d db
docker compose -p familyhub-restore-check exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h 127.0.0.1 -U familyhub -d familyhub --no-owner --no-acl --exit-on-error' \
  < /path/outside/repo/familyhub-backups/familyhub-YYYYMMDDTHHMMSSZ.dump
docker compose -p familyhub-restore-check exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U familyhub -d familyhub -c "SELECT version, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1"'
docker compose -p familyhub-restore-check exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U familyhub -d familyhub -c "SELECT count(*) FROM family"'
```

Inspect the counts and start the backend against this disposable project if
you want an application-level restore check. When finished, remove only the
explicitly named disposable project after confirming it contains no needed
data:

```sh
docker compose -p familyhub-restore-check down -v
```

For a **real** restore on the same host, use a **new Compose project** so the
original PostgreSQL volume stays untouched. Do not restore over an existing
household database or start the backend before restoring; Flyway will populate
an empty database on startup. Use the same pinned images and `.env` (especially
the Google encryption key):

```sh
docker compose -p familyhub-recovered up -d db
docker compose -p familyhub-recovered exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h 127.0.0.1 -U familyhub -d familyhub --no-owner --no-acl --exit-on-error' \
  < /path/outside/repo/familyhub-backups/familyhub-YYYYMMDDTHHMMSSZ.dump
docker compose stop
docker compose -p familyhub-recovered up -d --build --wait
```

Confirm the restored data through the UI before deciding whether to retire the
original project. From then on, include `-p familyhub-recovered` in operational
commands; for backups, use `COMPOSE_PROJECT_NAME=familyhub-recovered bash
scripts/household-backup.sh /path/outside/repo/familyhub-backups`. The new Caddy
volume has a new CA, so clients must trust its root certificate. On a new host
with no existing FamilyHub volume, the default project name can be used instead.

The archive includes family data, password hashes, Google token ciphertext,
and Flyway migration history. Protect it accordingly. There is no image/file
upload store in this milestone; recipe and avatar images are external URLs.

## Updates, rollback, and host migration

Before an update, take a backup and run a restore rehearsal. Record the old
frontend commit, backend commit/image tag, PG/Caddy/Node image pins, `.env`, and
current Flyway version. Review upstream migrations, test both checkouts on the
MacBook, then build the approved pinned versions and repeat the acceptance
checks. A PostgreSQL **major** upgrade needs
`pg_upgrade` or dump/restore into a new volume; changing the image tag alone
is unsafe.

Backend Flyway V18 replaces the global Google event-ID index with a
synced-calendar-scoped unique index. It preserves all existing rows and leaves
legacy Google rows without a synced-calendar ID unassigned; their source
calendar cannot be inferred safely. If such rows exist, review them after a
backup before enabling Google sync, since a later import could show duplicates.

If an update fails after a migration, reverting just the backend image may
not work. Restore the pre-update backup into a fresh volume and run the prior
pinned versions. Keep the original volume intact until recovery succeeds.

To move to the Mac mini, verify Docker and its LAN IP first, copy the selected
frontend checkout/deployment files and `.env` securely, take a fresh database
backup, restore it into a new volume there, and run the same acceptance checks.
Preserve the Caddy data volume if you want existing iPads to trust the same CA;
otherwise export and trust the new host's root certificate on each client.
Never copy the live PostgreSQL data directory between running hosts.

## Optional Google Calendar

Leave `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` empty in `.env` until you
choose to enable Google Calendar. The UI then displays "not configured" and
the backend rejects direct OAuth-start requests with a structured 400. The
encryption key remains mandatory for backend startup, including while Google
is disabled; keep it with backups if Google tokens are ever stored.

For **local-only** OAuth testing, register a Google *web application* OAuth
client with authorized redirect URI exactly
`http://localhost:8080/api/google/callback`, set its client ID/secret in the
local `.env`, and use the local override. `GOOGLE_FRONTEND_REDIRECT` remains the
plain `http://localhost:8080` origin; the backend adds the outcome query once.
This Milestone did not verify an actual Google consent/token exchange.

For eventual LAN production, the current raw private-IP callback
`https://LAN_IP/api/google/callback` should **not** be treated as a usable Google
web OAuth redirect. A Google-accepted hostname and matching callback design
must be chosen and registered later. Google can remain disabled until then;
this milestone does not add remote-access infrastructure. See [Google's web
OAuth redirect URI validation rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)
for the localhost exception and raw-IP restriction.

## Current limits

- The stack has no scheduled backup job. Run the backup script regularly and
  keep copies off-host.
- Caddy's internal CA requires manual client trust. The Caddy data volume
  contains its private key and should be protected if copied.
- The backend build uses multi-architecture Java 21 images; performance on the
  2014 Mac mini is not yet measured.
- `/api/health` is a liveness endpoint, not a database-readiness probe.
- The frontend and backend use an existing shared-family JWT login; no auth
  redesign is included here.
- Frontend CI E2E still uses the latest published **upstream** backend image
  as a compatibility check. It does not validate this uncommitted backend fork;
  migrate CI to a pinned fork release/commit before relying on it for fork
  regression coverage.
