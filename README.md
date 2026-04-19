# JB's Pub & Grill Bingo Night — Full Firebase Version

This is the full bingo build with your Firebase config already embedded.

## Included
- Firestore-backed saved tournaments
- local browser storage fallback if Firestore fails
- multi-step manual undo
- reset confirmation
- New Game auto-save
- saved tournaments list with load/delete
- PDF export
- Excel export

## Firestore collection
- `jb_bingo_tournaments`

## Notes
- Saved tournaments are read from Firestore first.
- `Load Last Save` uses the most recent locally cached save for quick recovery.
- Open in Chrome or Edge. For local testing, serving over `http://localhost` is more reliable than opening with `file://`.


## Layout scaling update
This version tightens the desktop layout so the full app fits better at normal 100% browser zoom on laptop-sized screens.


## Requested layout update
Tournament tools moved to a slim left rail, sync status moved to the top row, saved tournaments moved below current call, and last 5 moved under call history.


## Final polish update
Reduced header title size to keep one line, aligned header blocks, removed the left rail heading, and tightened lower panel content so it stays within wrappers.


## Ratio-tuned update
Reduced header title and sync widths, expanded Current Call area, and tightened panel ratios for a cleaner desktop fit.
