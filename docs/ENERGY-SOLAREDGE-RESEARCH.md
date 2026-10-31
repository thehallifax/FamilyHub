# SolarEdge ONE V2 implementation research

Verified against SolarEdge's public documentation on 30 October 2026. This is
research for Milestone 2N; it does not describe a working FamilyHub integration.

- [Site Overview](https://api-docs.solaredge.com/docs/basic-monitoring-api/sl8clhypye68r-site-overview): `GET /v2/sites/{id}/overview` accepts optional `from` and `to` date-times. When omitted, SolarEdge specifies midnight today in the site's local time through now. The response itself does not include that period, so a collector should request and persist explicit bounds when it needs a reliable historical interval. A household timezone must not silently be treated as the site timezone unless they are known to match.
- The overview contains production and consumption energy and their available destinations and sources. Each object carries its own unit (`WH`, `KWH`, `MWH`, or `GWH`); several measurements may be null. Null means missing, not zero. See the [Basic Monitoring changelog](https://api-docs.solaredge.com/docs/basic-monitoring-api/5uoeb2xfqt68z-changelog).
- [Tiers and Rate Limits](https://api-docs.solaredge.com/docs/developer-platform/pwh8p4k2wtajh-tiers-and-rate-limits): the Free tier currently provides 2,000 credits per billing cycle and 10 calls per minute. Site overview currently costs one credit. SolarEdge states that costs can change and credits reset on the billing-cycle anniversary, not necessarily on the first of the month. The quota is shared across the developer account, including calls outside FamilyHub. FamilyHub's own counter cannot guarantee the account-wide remaining balance without authoritative account usage data.
- [Authentication](https://api-docs.solaredge.com/docs/developer-platform/g09jmvp5t2cok-authentication): Site Access uses OAuth bearer tokens; the documented refresh request is a backend JSON POST to `/v2/oauth2/token`. Each successful refresh rotates the refresh token, and an unused refresh token expires after 14 days. Treat an ambiguous refresh outcome carefully: retrying an already-consumed refresh token can destroy the usable session.
- The documented authorization callback includes `code`, `site_id`, and optional `external_id`; the page does not describe returning OAuth `state`. A callback must not be accepted without a verifiable session-bound anti-CSRF mechanism. A secure server-side import of already obtained credentials is an alternative until that mechanism is established. Credentials must not be placed in frontend state, logs, URLs, or Git.
- Basic Monitoring is available on the Free tier. SolarEdge lists live power flow and per-destination advanced endpoints as higher-tier features; don't present an overview energy breakdown as live power. Consult the [Basic Monitoring API reference](https://api-docs.solaredge.com/docs/basic-monitoring-api/ubalc8zzxypbr-solar-edge-basic-monitoring-api) for each additional endpoint's schema and cost before implementing it.

Milestone 2N-A adds credential persistence and a server-side token lifecycle;
see [ENERGY-CONNECTION.md](ENERGY-CONNECTION.md). V27, credential locking and
the importer have been exercised against an isolated PostgreSQL 16.15 instance
with synthetic credentials. Collection, household-facing APIs and the
dashboard are not implemented. No live requests or household database
migrations were performed during this work.
