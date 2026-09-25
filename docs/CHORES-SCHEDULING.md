# Scheduled recurring chores

Daily chores are due each family-local day. Weekly chores use Sunday–Saturday
periods and may have a single due weekday. Monthly chores use calendar months
and may have a due day from 1–31. A monthly day beyond the end of a shorter
month is due on that month's final day (for example, April 31 → April 30).

The backend schedule remains optional for compatibility. The frontend requires
a weekday or day of month for new weekly/monthly chores. Existing weekly and
monthly chores with no due day remain "Any day this week/month" and are never
assigned an invented due date merely by opening and saving them.
The backend calculates `dueDate` and `dueState` (`UPCOMING`, `DUE`, `OVERDUE`,
`COMPLETE`, or `UNSCHEDULED`) using the family's stored timezone. Completion
still belongs to the current day/week/month period; missed work does not carry
into the next period. No future occurrences or calendar events are generated.

Editing a chore's cadence or schedule sends the cadence and both schedule
fields. Changing cadence to weekly/monthly requires a new day selection.
Legacy nulls can be preserved when saving an unchanged legacy recurrence.
Completion and archive actions are unchanged. Home counts daily chores plus
incomplete scheduled weekly/monthly chores that are due or overdue; upcoming
ones remain on the Chores board.

Backend Flyway migration V19 adds nullable `due_weekday` (Java weekday name,
such as `TUESDAY`) and `due_day_of_month` to `chore_template`. It leaves all
existing templates and completion rows intact. Take a database backup and
verify its archive before starting a backend containing V19 against an existing
database. The migration runs during normal backend startup. See
[household deployment](HOUSEHOLD-DEPLOYMENT.md) for the backup procedure.
