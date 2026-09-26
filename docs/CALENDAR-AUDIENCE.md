# Calendar event audiences (Milestone 2D)

The owned backend accepts and returns an explicit audience for calendar events:

```json
{ "audienceType": "FAMILY", "memberIds": [] }
```

```json
{ "audienceType": "MEMBERS", "memberIds": ["member-uuid-1", "member-uuid-2"] }
```

`FAMILY` is durable: a person added later is included automatically. It is not a snapshot of today's members. `MEMBERS` requires at least one unique member in the authenticated family. The backend rejects empty, duplicate, nonexistent and foreign-family assignments. Responses include both fields. A deprecated `memberId` response alias is present only for one-person events; shared and family events return `null` for it. Clients must use the explicit audience fields.

The frontend's “Who is this for?” pills select Everyone or one or more people. One-person events retain that member's colour; shared and family events use neutral slate. A member filter shows events assigned to that person and all FAMILY events. The default filter selects all current members; the existing explicit “None” filter still hides all events. The large daily lane layout renders a shared event in each applicable member lane, while Home and other views keep one event record/card.

Native recurrence series store an audience once. Virtual occurrences inherit it. An independently edited occurrence is a persisted exception with its own audience snapshot; editing the series does not rewrite previously edited exceptions. Cancelling an occurrence records the parent audience. If a member is deleted, multi-member events lose only that member; sole-member native events are deleted; FAMILY events survive. Google events belonging to the deleted member are removed by source owner.

Google events are imported as MEMBERS for the connected person. The synced calendar and source-owner member, never audience membership, identify Google updates, deletions and disconnect cleanup. Google event audience is read-only in FamilyHub for this milestone: a full sync deletes and reimports its calendar's rows, so local audience edits would not be durable. No Google write-back or attendee management is implemented.

V21 backfills every preexisting event (including recurring exceptions and Google rows) from the old `member_id` to the relational `calendar_event_member` table as MEMBERS. It renames the old column to nullable `source_owner_member_id` and clears it for native events; Google source ownership remains. Back up PostgreSQL before upgrading. Rolling back the app binary without restoring a pre-V21 database backup is unsupported.
