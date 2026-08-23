# Prospecting engine — build spec for Claude Code

Extends the existing Later list in index.html into a proper owner-prospecting tool.
Follow CLAUDE.md conventions: terse vanilla JS, state on S, put(S) then redraw,
esc() on user text, pmoney() for money, no em dashes in user-facing copy.

## 1. Data model

Extend each S.later entry with:

- `att` — array of attempts, newest last. Each `{d, ch, out}` where
  `d` is ISO date, `ch` is 'call' or 'wa', `out` is one of the outcome keys below.
- `dnc` — 1 if they asked to be removed.

Add `S.dnc = []`, an array of phone numbers in digits-only form. Default to [] on load.

## 2. Outcomes and cadence

```
const OUT = [
 ['noans',   'No answer',        1],
 ['maybe',   'Maybe later',     90],
 ['no',      'Not selling',    180],
 ['val',     'Wants a valuation', 0],
 ['listed',  'Already listed',  300],
 ['remove',  'Remove me',       -1]
];
```

The third value is days until the next attempt.

- **noans** — reschedule tomorrow. After 3 consecutive noans, park 90 days instead and
  show "parked after 3 attempts" on the card.
- **maybe** and **no** — reschedule that many days out.
- **listed** — 300 days, since most listings run about a year.
- **val** — do not reschedule. Move them into the pipeline: push a deal onto S.deals with
  `w` = their name, `ph` = their phone, `u` = their property, `s` = 1 (Contacted),
  `na` = 'Send the valuation', `nd` = today, `src` = 'Prospecting call',
  `ty` = 'Resale', `n` = their hook text. Then remove them from S.later.
  Confirm before doing it, then toast "Moved into your pipeline".
- **remove** — set `dnc = 1`, push the digits-only phone into S.dnc, and never show
  them in the active list again. This is not optional and must not be undoable by accident.

Always append to `att` before applying the cadence. Never overwrite history.

## 3. Pre-filled WhatsApp

Add a helper:

```
function waLink(phone, text){
  var n = String(phone||'').replace(/[^\d]/g,'');
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text);
}
```

Note the number must be digits only with no plus sign.

Add a message builder that fills placeholders from the entry:

```
function proMsg(x){ ... }
```

Placeholders available: `{name}` first name only, `{unit}` from `x.w`,
`{hook}` from `x.n2` with any leading rank marker like "#1 HOT · " stripped,
`{agent}` which is 'Mustafa'.

Ship three templates in a `PROTPL` array, each `[label, body]`:

1. **Neighbour sold** — opens with the specific nearby sale from the hook, says you have
   buyers and are short of stock, ends with one question.
2. **No hook** — for entries with no `n2`. Opens with the community-level fact, that a
   share of the community has already resold at a profit, ends with an offer of a
   current value with no obligation.
3. **Follow up** — short, references that you called, gives the latest median, one line
   that you are still here if they want a number.

Keep them four to eight lines, no greeting paragraph, no sign-off, one question each,
and obey the banned-words list in the brand kit.

## 4. The prospect card

Rework each row in the Later list to show:

- Name, what it is about, why later, and when the next attempt is due.
- Attempt count and last outcome, e.g. "3 attempts · last: no answer, 2 days ago".
  Nothing if there are no attempts yet.
- The hook text, as now.
- A row of two primary buttons: **Call** (tel: link) and **WhatsApp**, where WhatsApp
  uses waLink with template 1 or 2 chosen automatically depending on whether a hook exists.
- A small link "change message" that opens the tool sheet showing all three templates
  rendered with this person's details, each with its own send button, so the wording can
  be picked per person.
- Below that, a row of six outcome buttons using short labels. Tapping one logs the
  attempt and applies the cadence immediately, with a toast naming the next date.

The channel recorded should be 'call' if they tapped Call last, otherwise 'wa'.
Simplest correct approach: record the channel when either button is tapped, hold it on
the entry as a transient, and use it when an outcome is logged. If none was tapped,
record 'call'.

## 5. Do not contact

- Filter S.dnc out of every list, every count, the money moves list on Today, and the
  calendar export.
- Add a "Do not contact" section at the bottom of More showing the count and the numbers,
  with no way to restore from the UI. Restoring should require editing a backup file.
- Before adding any imported prospect, check the number against S.dnc and skip it silently,
  then report how many were skipped.

## 6. The funnel

Add a section at the top of the Later view, above Ready to call now:

- Attempts logged, all time and last 7 days.
- Connects, meaning any outcome other than noans.
- Valuations, meaning count of 'val' outcomes.
- Conversion lines, only shown once there are at least 20 attempts:
  attempts per connect, connects per valuation. Below 20 attempts show
  "Not enough attempts yet to be meaningful" instead of a ratio. Never show an invented number.

## 7. Import

Update the prospect import so it also accepts `att` and `dnc` if present, defaults them
otherwise, and skips anyone already on the do-not-contact list.

## 8. Finish

Bump APPVER, the Storage version and the CACHE version in sw.js.
Verify every getElementById has a matching id in the HTML, and run node --check on the
extracted script before declaring done.
