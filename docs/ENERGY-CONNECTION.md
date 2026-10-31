# SolarEdge credential import (Milestone 2N-A)

This is an administrator-only server operation. FamilyHub has a shared family
login and no separate administrator role, so there is intentionally no browser
credential-import endpoint. Operating-system access to the Docker host and
permission to run commands against its backend/database are the security
boundary. Never put credentials in command-line arguments, shell history,
environment files, application logs, or Git.

The following is a future procedure, **not an instruction to deploy now**.
V27 and credential concurrency were tested against disposable PostgreSQL;
review the release, and take and verify the database backup described in
[HOUSEHOLD-DEPLOYMENT.md](HOUSEHOLD-DEPLOYMENT.md). Apply the reviewed migration
through the normal release process before importing. Keep a secure backup of
`TOKEN_ENCRYPTION_KEY` separately from the database; without the same key,
restored SolarEdge and Google credentials cannot be decrypted.

Obtain the SolarEdge client ID, client secret, site ID and a fresh Site Access
refresh token through your separately secured authorization process. This
importer never reads the existing OAuth test directory and does not contact
SolarEdge. There is no weakened OAuth callback. The site timezone must match
the SolarEdge site, for example `Australia/Perth`.

From the frontend deployment directory, with the database already healthy and
the reviewed backend image available, identify the intended household UUID
without exposing credentials. Set `COMPOSE_FILE` for the selected mode as
shown in the deployment section below before running these commands:

```sh
docker compose exec -T db \
  psql -U familyhub -d familyhub -c 'SELECT id, name FROM family ORDER BY name;'
```

Stop **all** backend instances that could refresh these credentials before
import or recovery. The example assumes one local staging instance:

```sh
docker compose stop backend
```

On a trusted interactive terminal, substitute the household UUID, numeric site
ID, and site timezone (these arguments are not credentials). The command uses
the already-built backend image, does not start dependent services, and prompts
for each secret without echoing it. Do not run it via a terminal recorder or
paste secrets into chat.

```sh
docker compose run --rm --no-deps -i \
  --entrypoint java backend \
  -Dloader.main=com.familyhub.demo.energy.EnergyImportMain \
  -cp /app/app.jar org.springframework.boot.loader.launch.PropertiesLauncher \
  FAMILY_UUID SITE_ID Australia/Perth
```

For a connection left in `REFRESHING` by an interrupted refresh, first ensure
that every backend instance is stopped and obtain a newly authorized refresh
token. Only then add `--recover-interrupted-refresh` after the timezone. A
lost refresh response may mean the old token was already consumed; do not
retry it. Restart the reviewed backend normally after import. The importer
does not start the application, run Flyway, trigger scheduling, or return the
credentials. Once the application is started, its Energy scheduler may make
provider requests after its initial delay if the connection is eligible.

The service refreshes on demand when an access token has five minutes or less
remaining. Token maintenance also runs independently of collection after seven
days without maintenance or a credential update, including while collection is
paused. An ambiguous refresh requires administrative recovery, not a retry.
FamilyHub's own credit records are estimates and cannot account for other
clients on the SolarEdge developer account.

Collection defaults to every 30 minutes per connection. Set
`ENERGY_POLL_INTERVAL_MINUTES` (30–1440) before importing a new connection;
reimporting an existing connection preserves its existing interval. The site
timezone is the importer's required timezone argument, not a global setting.
The scheduler checks
eligibility every 60 seconds after a 60-second initial delay; these checks can
be configured with `energy.scheduler-delay-ms` and
`energy.scheduler-initial-delay-ms`. The polling interval and per-household
budget are stored on the connection. Set `energy.global-safety-budget`
(default 1500), `energy.billing-day` (default 1) and
`energy.billing-timezone` (default UTC) to match the developer account's
billing anniversary. The separate conservative rolling limit also applies.
Compose passes the `ENERGY_*` values in `.env.example` to the backend;
the defaults do not establish the actual provider billing cycle or balance.
The site timezone must match the SolarEdge site. Observations are cumulative
snapshots from site-local midnight, not independent intervals or live power.
An overview 403 blocks collection for that household until an administrator
resolves permissions and clears the flag. A 429 pauses collection across
FamilyHub connections until a valid `Retry-After` time; absent or malformed
headers use exponential delays from one minute to one hour. The normal polling
interval still applies. SolarEdge's documented quota-exhaustion response could
not be verified, so neither status alone is treated as confirmed exhaustion.
Refresh-token credit cost is also not verified: FamilyHub estimates one credit
for each reserved overview, not an authoritative account balance.

Successful credential replacement clears that connection's old permission flag,
retry time, error outcome and last-attempt time. Its collection-enabled choice,
existing interval, historical observations, credit attempts and shared provider
backoff are retained. A same-site last-success timestamp is retained; changing
site clears it. Shared backoff requires the separate administrator action below.

## Reviewed deployment and first connection

This is a manual procedure, not an action performed by the validation run. Do
not proceed until the full test limitations are accepted, both reviewed images
are built from recorded approved commits, and the backup/restore rehearsal in
`HOUSEHOLD-DEPLOYMENT.md` has succeeded. Never change the encryption key for an
existing database. Securely preserve the matching `.env` separately from the
backup bundle, including `TOKEN_ENCRYPTION_KEY`.

From the frontend repository on the target host, choose **one** Compose mode:

```sh
# Trusted-LAN HTTP MacBook staging:
export COMPOSE_FILE=compose.yaml:compose.local.yaml
# Or LAN HTTPS production, instead:
# export COMPOSE_FILE=compose.yaml
```

Pause household writes and photo uploads, verify the current stack is healthy,
then back up both PostgreSQL and media. The script validates that both archives
are readable; a separate restore rehearsal is still required. Store the bundle
off-host and verify that the key backup corresponds to this database.

```sh
docker compose ps
mkdir -p /path/outside/repository/familyhub-backups
bash scripts/household-backup-bundle.sh /path/outside/repository/familyhub-backups
```

Record the previous frontend/backend image tags and Flyway version for rollback.
Set the six documented `ENERGY_*` settings in the private `.env` as appropriate;
the account billing timezone and the site timezone are distinct. To avoid an
unexpected request during initial checks, temporarily set
`ENERGY_SCHEDULER_INITIAL_DELAY_MS=3600000` (one hour) before startup. If checks
take longer than an hour, stop the backend before that delay expires. The
collector can run automatically after the delay if credentials exist.

```sh
docker compose exec -T db psql -U familyhub -d familyhub -c \
  'SELECT version, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 10;'
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
docker compose exec -T db psql -U familyhub -d familyhub -c \
  "SELECT version, success FROM flyway_schema_history WHERE version IN ('27','28','29','30') ORDER BY installed_rank;"
```

All four migrations must report success. For local staging check
`curl -fsS http://localhost:8080/api/health`; for production use the configured
HTTPS origin and trusted local CA. Confirm only Caddy is host-published. Never
delete or recreate the household PostgreSQL volume.

If this is a new connection, obtain a fresh authorization using the separately
secured process described above. Use the interactive importer above with the
same selected `COMPOSE_FILE`; stop all backend instances before importing. Have
the Energy dashboard and sanitized backend logs ready, then restore the intended
initial delay (default `60000`) in the private `.env` and recreate the backend:

```sh
docker compose up -d --no-build --wait backend
docker compose logs --tail=100 backend
```

The first eligible provider request can occur after that initial delay. Observe
one collection and compare the reporting period, units and cumulative values
with SolarEdge. Do not repeatedly restart or retry on an ambiguous token
refresh; follow the recovery procedure instead.

For rollback after Flyway has run, stop the backend and restore the verified
pre-update database **and media** into new volumes using the documented restore
procedure and previous pinned images. Merely reverting the backend image is not
a database rollback. Preserve the original volumes until recovery is verified;
do not use `down -v` on the household project.

For administrative recovery, stop **all** backend instances first and use a
trusted database administrator session. After resolving the underlying problem,
the following transaction clears provider pauses and the named household's
permission error without touching credentials, observations or the credit ledger.
Replace the UUID and verify it identifies the intended household. Local budget
and polling checks still apply. The legacy outcome handles the earlier 31-day
classification as well.

```sql
BEGIN;
UPDATE energy_credit_guard SET provider_retry_after=NULL, quota_blocked=FALSE, rate_limit_streak=0 WHERE id=1;
UPDATE energy_collection_state SET permission_blocked=FALSE, retry_after=NULL, last_outcome=NULL
 WHERE family_id='REPLACE-WITH-HOUSEHOLD-UUID'::uuid
   AND last_outcome IN ('PERMISSION_DENIED','PROVIDER_THROTTLED','PROVIDER_QUOTA_OR_FORBIDDEN','PROVIDER_QUOTA_CONFIRMED');
UPDATE energy_connection SET last_error_code=NULL
 WHERE family_id='REPLACE-WITH-HOUSEHOLD-UUID'::uuid
   AND last_error_code IN ('PERMISSION_DENIED','PROVIDER_THROTTLED','PROVIDER_QUOTA_OR_FORBIDDEN');
COMMIT;
```

If an administrator independently confirms account-wide quota exhaustion,
they can set `quota_blocked=TRUE` on the guard row while all backends are
stopped, then clear it after the provider confirms recovery. No billing-reset
date is inferred. The web API does not grant this administrative capability.
