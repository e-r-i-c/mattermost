# Responsiveness benchmark

`responsiveness_benchmark.mjs` measures how long the web app takes to respond to the interactions people repeat
most. Run it before and after a change to see what the change did.

| Metric | What is timed |
| --- | --- |
| `typing_short_message` | Each key pressed in an empty message box, until the next frame is presented |
| `typing_long_draft` | The same, typing at the end of a draft of about 4,300 characters of markdown |
| `*_long_frames` | Animation frames longer than 50 ms while typing |
| `channel_switch_first_visit` | Clicking a channel in the sidebar that hasn't been opened yet, until its posts are presented |
| `channel_switch_revisit` | The same for a channel whose posts are already loaded |
| `channel_switch_app_measure` | The app's own `channel_switch` measure, which stops when the post list is committed rather than painted |
| `thread_open_first` | Opening a thread whose replies haven't been loaded yet |
| `thread_open_revisit` | Opening the same thread again |

All times are in milliseconds. The browser's CPU is throttled 4x by default so that the numbers resemble an
ordinary laptop rather than a development machine.

## Running it

The benchmark needs a running server and a production build of the web app, since development builds of React
are several times slower. It creates a `perfbench` team with ten channels of 200 posts each, and reuses that data
on later runs.

```sh
# From webapp/, with the server running and serving a production build
npm run build
npm install --no-save playwright && npx playwright install chromium

MM_URL=http://localhost:8065 MM_USERNAME=sysadmin MM_PASSWORD=... \
    node scripts/perf/responsiveness_benchmark.mjs --label before --out before.json
```

If the server has no users yet, the given user is created and becomes the system admin.

Options: `--typing-chars <n>` (default 200), `--switch-passes <n>` (default 3), `--thread-opens <n>` (default 6),
`--headed` to watch it run, and `CPU_THROTTLE=<factor>` to change the slowdown.

## Reading the results

Compare `p50` and `p95` between runs made on the same machine. Numbers vary between machines and between runs, so
repeat a run when a difference is small, and don't compare against numbers recorded elsewhere.
