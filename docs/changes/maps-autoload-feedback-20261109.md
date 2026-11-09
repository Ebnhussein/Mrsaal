# Maps autoload and activity feedback — 0.2.0

Automatic loading now defaults on. The collector locates the scrollable
ancestor of the result cards rather than assuming `role=feed` itself scrolls
or falling back to the map document. It waits for DOM updates/new place IDs,
retains results removed by virtualisation, and tolerates delayed initial loads.
The requested count, list end, cancellation, three no-growth waits or a two-minute
budget bound each run. Single-page mode remains available.

Actual progress is sent from the isolated content script to the worker only
for the matching run ID and source tab. Counts must be monotonic and cannot
exceed the configured limit. Source changes cannot redirect a running stop
command, and concurrent start requests are rejected before asynchronous work.

A live activity card shows the collected count, batch limit, latest names and
separate collection/import/completion states. A spinner, scanning animation,
source-page badge and toolbar counter provide feedback; animation respects
reduced motion. Percentages are not simulated. Cancellation wakes pending
loading immediately and never imports partial results.

Validation: 395 Node tests passed; lint and syntax/assets checks passed. Browser
fixtures cover a nested pane outside the feed, delayed loads (1.8 seconds),
replaced/virtualised cards, repeat identities, end-of-list, initial loading,
requested limits and cancellation. Bilingual panel checks cover live counters,
import transitions, reduced motion and 280/360/480px layouts. An installed
extension against the user's live Maps session remains the manual acceptance
step. This update stays on the isolated trial branch/PR #40.

After pulling/restarting the local trial, download the new ZIP and reload the
unpacked extension. Refresh the Maps tab to discard the old content script.
Version shown by Chrome/Edge should be 0.2.0.
