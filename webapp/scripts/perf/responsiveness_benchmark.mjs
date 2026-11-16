// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, no-await-in-loop */

// Measures how responsive the web app feels for the interactions people repeat most: typing in the message box,
// switching between channels and opening a thread. Run it against a server before and after a change to compare.
//
// Usage (see README.md in this directory):
//   node scripts/perf/responsiveness_benchmark.mjs --label before --out before.json
//
// Environment:
//   MM_URL       URL of the server to measure (default http://localhost:8065)
//   MM_USERNAME  A system admin, created if the server has no users yet (default perfadmin)
//   MM_PASSWORD  That user's password
//   CPU_THROTTLE CPU slowdown factor applied to the browser (default 4)

import fs from 'node:fs';
import {createRequire} from 'node:module';

import {seed, TEAM_NAME} from './seed.mjs';

const require = createRequire(import.meta.url);

function loadPlaywright() {
    for (const name of ['playwright', '@playwright/test']) {
        try {
            return require(name);
        } catch {
            // Try the next package
        }
    }
    throw new Error('Playwright is required to run this benchmark. Install it with: npm install --no-save playwright');
}

function parseArgs(argv) {
    const args = {label: 'run', out: '', typingChars: 200, switchPasses: 3, threadOpens: 6, headed: false};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--label') {
            args.label = argv[++i];
        } else if (arg === '--out') {
            args.out = argv[++i];
        } else if (arg === '--typing-chars') {
            args.typingChars = Number(argv[++i]);
        } else if (arg === '--switch-passes') {
            args.switchPasses = Number(argv[++i]);
        } else if (arg === '--thread-opens') {
            args.threadOpens = Number(argv[++i]);
        } else if (arg === '--headed') {
            args.headed = true;
        }
    }
    return args;
}

function summarize(values) {
    if (values.length === 0) {
        return {count: 0};
    }

    const sorted = [...values].sort((a, b) => a - b);
    const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
    const round = (value) => Math.round(value * 10) / 10;

    return {
        count: sorted.length,
        p50: round(percentile(50)),
        p95: round(percentile(95)),
        max: round(sorted[sorted.length - 1]),
        mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    };
}

// Runs in the page. Resolves with the time from now until the frame in which `isDone` first returns true has been
// presented, so the result includes rendering, layout and paint rather than only script time.
function installPageHelpers() {
    window.perfBench = {
        afterNextPaint() {
            return new Promise((resolve) => {
                requestAnimationFrame(() => {
                    const channel = new MessageChannel();
                    channel.port1.onmessage = () => resolve(performance.now());
                    channel.port2.postMessage(undefined);
                });
            });
        },

        async timeUntil(start, isDone, timeout = 30000) {
            for (;;) {
                const now = await this.afterNextPaint();
                if (isDone()) {
                    return now - start;
                }
                if (now - start > timeout) {
                    throw new Error('Timed out waiting for the page to update');
                }
            }
        },

        // Records, for every key pressed in the given element, how long it took until the next frame was presented
        watchKeystrokes(element) {
            const latencies = [];
            const longFrames = [];

            const onKeyDown = () => {
                const start = performance.now();
                this.afterNextPaint().then((end) => latencies.push(end - start));
            };
            element.addEventListener('keydown', onKeyDown, {capture: true});

            let observer;
            if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
                observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        longFrames.push(entry.duration);
                    }
                });
                observer.observe({type: 'long-animation-frame'});
            }

            return () => {
                element.removeEventListener('keydown', onKeyDown, {capture: true});
                observer?.disconnect();
                return {latencies, longFrames};
            };
        },
    };
}

const LONG_DRAFT = Array.from({length: 24}, (_, i) => (
    `${i + 1}. Step **${i + 1}** of the rollout: update \`service-${i}\`, check the [dashboard](https://example.com/d/${i}) ` +
    'and confirm with @sysadmin in ~town-square before moving on :white_check_mark:'
)).join('\n');

const TYPED_TEXT = 'The quick brown fox jumps over the lazy dog and keeps on running through the forest. ';

async function measureTyping(page, {chars, prefill}) {
    const textbox = page.locator('#post_textbox');
    await textbox.click();
    await textbox.fill(prefill);
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
        window.perfBenchStop = window.perfBench.watchKeystrokes(document.getElementById('post_textbox'));
    });

    let text = '';
    while (text.length < chars) {
        text += TYPED_TEXT;
    }

    // A steady 12 characters per second, which is fast typing but leaves time for each key to be rendered
    await page.keyboard.type(text.slice(0, chars), {delay: 80});
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => window.perfBenchStop());

    await textbox.fill('');
    await page.waitForTimeout(1000);

    return result;
}

async function switchChannel(page, channel) {
    return page.evaluate(({name, id}) => {
        const link = document.getElementById(`sidebarItem_${name}`);
        if (!link) {
            throw new Error(`Channel ${name} isn't in the sidebar`);
        }

        const start = performance.now();
        link.click();

        return window.perfBench.timeUntil(start, () => (
            Boolean(document.querySelector(`#postListContent[data-channel-id="${id}"] [id^="post_"]`)) &&
            document.getElementById('channelHeaderTitle')?.textContent?.includes(link.textContent?.trim() ?? '')
        ));
    }, {name: channel.name, id: channel.id});
}

async function openThread(page) {
    await page.locator('#post_textbox').click();

    return page.evaluate(() => {
        const textbox = document.getElementById('post_textbox');

        const start = performance.now();

        // Shift+Up in an empty message box replies to the latest post, which opens its thread
        textbox.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, shiftKey: true, bubbles: true}));

        return window.perfBench.timeUntil(start, () => (
            document.querySelectorAll('#rhsContainer [id^="rhsPost_"]').length > 1
        ));
    });
}

async function closeThread(page) {
    await page.locator('#rhsCloseButton').click();
    await page.locator('#rhsContainer').waitFor({state: 'detached'});
    await page.waitForTimeout(500);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const baseUrl = (process.env.MM_URL || 'http://localhost:8065').replace(/\/$/, '');
    const username = process.env.MM_USERNAME || 'perfadmin';
    const password = process.env.MM_PASSWORD || 'Perf-bench-1234';
    const cpuThrottle = Number(process.env.CPU_THROTTLE || 4);

    console.log(`Seeding ${baseUrl}...`);
    const {channels} = await seed({baseUrl, username, password});

    const {chromium} = loadPlaywright();
    const browser = await chromium.launch({headless: !args.headed});
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    await context.addInitScript(installPageHelpers);

    // Skip the page that asks whether to open the desktop app
    await context.addInitScript(() => localStorage.setItem('__landingPageSeen__', 'true'));

    try {
        await measure({context, baseUrl, username, password, channels, args, cpuThrottle});
    } finally {
        await browser.close();
    }
}

async function measure({context, baseUrl, username, password, channels, args, cpuThrottle}) {
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error('Page error:', error.message));

    await page.goto(`${baseUrl}/login`);
    await page.locator('input[name="loginId"]').fill(username);
    await page.locator('input[type="password"]').fill(password);
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));

    await page.goto(`${baseUrl}/${TEAM_NAME}/channels/${channels[0].name}`);
    await page.locator('#post_textbox').waitFor();
    await page.locator(`#postListContent[data-channel-id="${channels[0].id}"] [id^="post_"]`).first().waitFor();
    await page.waitForTimeout(3000);

    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', {rate: cpuThrottle});

    const results = {
        label: args.label,
        url: baseUrl,
        cpuThrottle,
        date: new Date().toISOString(),
        metrics: {},
    };

    console.log('Measuring typing a short message...');
    const shortTyping = await measureTyping(page, {chars: args.typingChars, prefill: ''});
    results.metrics.typing_short_message = summarize(shortTyping.latencies);
    results.metrics.typing_short_message_long_frames = summarize(shortTyping.longFrames);

    console.log('Measuring typing at the end of a long draft...');
    const longTyping = await measureTyping(page, {chars: args.typingChars, prefill: LONG_DRAFT + '\n'});
    results.metrics.typing_long_draft = summarize(longTyping.latencies);
    results.metrics.typing_long_draft_long_frames = summarize(longTyping.longFrames);

    console.log('Measuring channel switches...');
    const firstVisit = [];
    const revisit = [];
    for (let pass = 0; pass < args.switchPasses; pass++) {
        // Start from the second channel because the first one is already open
        for (let i = 1; i <= channels.length; i++) {
            const duration = await switchChannel(page, channels[i % channels.length]);
            if (pass === 0 && i !== channels.length) {
                firstVisit.push(duration);
            } else {
                revisit.push(duration);
            }
            await page.waitForTimeout(1500);
        }
    }
    results.metrics.channel_switch_first_visit = summarize(firstVisit);
    results.metrics.channel_switch_revisit = summarize(revisit);

    // The app's own measure of the same interaction, which stops when the post list is committed rather than painted
    const appMeasures = await page.evaluate(() => performance.getEntriesByName('channel_switch').map((entry) => entry.duration));
    results.metrics.channel_switch_app_measure = summarize(appMeasures);

    console.log('Measuring opening a thread...');
    const threadOpens = [];
    for (let i = 0; i < args.threadOpens; i++) {
        const duration = await openThread(page);
        if (i > 0) {
            // The first open fetches the thread, so it mostly measures the server
            threadOpens.push(duration);
        } else {
            results.metrics.thread_open_first = summarize([duration]);
        }
        await page.waitForTimeout(1000);
        await closeThread(page);
    }
    results.metrics.thread_open_revisit = summarize(threadOpens);

    console.log(`\nResults for "${args.label}" (milliseconds, CPU throttled ${cpuThrottle}x)\n`);
    console.table(results.metrics);

    if (args.out) {
        fs.writeFileSync(args.out, JSON.stringify(results, null, 2) + '\n');
        console.log(`Wrote ${args.out}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
