# Scheduled recurring chores

Daily chores are due each family-local day. Weekly chores use Sunday–Saturday
periods and may have a single due weekday. Monthly chores use calendar months
and may have a due day from 1–31. A monthly day beyond the end of a shorter
month is due on that month's final day (for example, April 31 → April 30).

Fortnightly chores require a weekday and a **Starting** local date that matches
that weekday. Starting is the first due date, not merely a week marker. The
backend makes the chore due again every 14 days (for example, Saturday 3 Oct
2026, then 17 Oct). Its period runs from seven days before each due date through
six days after it. Completion belongs to that exact 14-day period and resets
when the next period starts; a missed period does not carry over. Before the
first period begins, the chore is visible as upcoming but cannot be completed.
The backend calculates the due date and period using the family's local date.

The backend schedule remains optional for compatibility. The frontend requires
a weekday or day of month for new weekly/monthly chores. Existing weekly and
monthly chores with no due day remain "Any day this week/month" and are never
assigned an invented due date merely by opening and saving them.
The backend calculates `dueDate` and `dueState` (`UPCOMING`, `DUE`, `OVERDUE`,
`COMPLETE`, or `UNSCHEDULED`) using the family's stored timezone. Completion
still belongs to the current day/week/fortnight/month period; missed work does not carry
into the next period. No future occurrences or calendar events are generated.

Editing a chore's cadence or schedule sends the cadence and its schedule
fields. Changing cadence to weekly/monthly requires a new day selection;
changing to fortnightly requires a weekday and matching Starting date.
Legacy nulls can be preserved when saving an unchanged legacy recurrence.
Fortnightly chores appear in the existing This Week column with a Fortnightly
label. That column's week dates still apply to weekly chores; each fortnightly
item carries its own period dates for completion. Home counts daily chores plus
incomplete scheduled weekly/fortnightly/monthly chores that are due or overdue;
upcoming ones remain on the Chores board.

Backend Flyway migration V19 adds nullable `due_weekday` (Java weekday name,
such as `TUESDAY`) and `due_day_of_month` to `chore_template`. It leaves all
existing templates and completion rows intact. Take a database backup and
verify its archive before starting a backend containing V19 against an existing
database. The migration runs during normal backend startup. See
[household deployment](HOUSEHOLD-DEPLOYMENT.md) for the backup procedure.

Backend Flyway migration V20 adds nullable `recurrence_anchor_date` and extends
the cadence constraint. It leaves V19 and all existing records unchanged.
Take and verify a fresh backup before starting a V20 backend against staging.
