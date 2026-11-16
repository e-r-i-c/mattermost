// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {runWhenIdle} from './run_when_idle';

describe('runWhenIdle', () => {
    const originalRequestIdleCallback = window.requestIdleCallback;

    afterEach(() => {
        window.requestIdleCallback = originalRequestIdleCallback;
        jest.useRealTimers();
    });

    test('should use requestIdleCallback with the given timeout when it is supported', () => {
        const requestIdleCallback = jest.fn();
        window.requestIdleCallback = requestIdleCallback;

        const callback = jest.fn();
        runWhenIdle(callback, 500);

        expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {timeout: 500});
        expect(callback).not.toHaveBeenCalled();

        requestIdleCallback.mock.calls[0][0]();

        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('should run the callback after the next frame when requestIdleCallback is not supported', () => {
        jest.useFakeTimers();

        (window as Partial<Window>).requestIdleCallback = undefined;

        const callback = jest.fn();
        runWhenIdle(callback);

        expect(callback).not.toHaveBeenCalled();

        jest.runAllTimers();

        expect(callback).toHaveBeenCalledTimes(1);
    });
});
