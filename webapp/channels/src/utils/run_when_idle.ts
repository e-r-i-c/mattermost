// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const DEFAULT_TIMEOUT_MILLISECONDS = 1000;

/**
 * Runs the callback once the browser has finished the work it's doing now, such as rendering the result of the
 * interaction that's in progress. Use it for work that isn't needed for what the user sees next, so that it doesn't
 * delay that.
 *
 * The callback always runs, at the latest after the given timeout when the browser stays busy.
 */
export function runWhenIdle(callback: () => void, timeout = DEFAULT_TIMEOUT_MILLISECONDS) {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => callback(), {timeout});
        return;
    }

    // Safari doesn't support requestIdleCallback, so wait for the next frame to be painted instead
    window.requestAnimationFrame(() => {
        window.setTimeout(callback, 0);
    });
}
