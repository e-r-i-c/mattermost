// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, render, screen} from 'tests/react_testing_utils';

import {DynamicVirtualizedList} from './index';
import type {DynamicVirtualizedListProps} from './index';

describe('DynamicVirtualizedList', () => {
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    const originalScrollHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight');
    const originalRequestIdleCallback = window.requestIdleCallback;

    let idleCallbacks: Array<() => void> = [];

    function setRowHeight(height: number) {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {configurable: true, value: height});
    }

    function runIdleCallbacks() {
        // Each batch schedules the next one, so keep going until there's nothing left to do
        while (idleCallbacks.length > 0) {
            const callbacks = idleCallbacks;
            idleCallbacks = [];

            act(() => {
                callbacks.forEach((callback) => callback());
            });
        }
    }

    const itemData = Array.from({length: 80}, (_, i) => `item${i}`);

    const baseProps: DynamicVirtualizedListProps = {
        canLoadMorePosts: jest.fn(),
        children: ({itemId}) => <div data-testid='row'>{itemId}</div>,
        height: 600,
        width: 800,
        initRangeToRender: [0, 50],
        initScrollToIndex: () => ({index: 0, position: 'end'}),
        itemData,
        onItemsRendered: jest.fn(),
        onScroll: jest.fn(),
        overscanCountBackward: 80,
        overscanCountForward: 80,
        scrollToFailed: jest.fn(),
        style: {},
        correctScrollToBottom: true,
    };

    const originalRequestAnimationFrame = window.requestAnimationFrame;

    beforeEach(() => {
        // The rest of the initial range waits for a frame to be presented, which happens right away here
        window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            callback(0);
            return 0;
        }) as typeof window.requestAnimationFrame;

        // JSDOM doesn't lay anything out, so give the list something to scroll as it would have in a browser
        Object.defineProperty(Element.prototype, 'scrollHeight', {configurable: true, value: 5000});

        idleCallbacks = [];
        window.requestIdleCallback = jest.fn((callback: () => void) => {
            idleCallbacks.push(callback);
            return idleCallbacks.length;
        }) as unknown as typeof window.requestIdleCallback;
    });

    afterEach(() => {
        window.requestIdleCallback = originalRequestIdleCallback;
        window.requestAnimationFrame = originalRequestAnimationFrame;

        if (originalOffsetHeight) {
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
        }
        if (originalScrollHeight) {
            Object.defineProperty(Element.prototype, 'scrollHeight', originalScrollHeight);
        }
    });

    test('should render all of the initial range at once by default', () => {
        setRowHeight(100);

        render(<DynamicVirtualizedList {...baseProps}/>);

        expect(screen.getAllByTestId('row')).toHaveLength(51);
        expect(idleCallbacks).toHaveLength(0);
    });

    test('should start with initRangeFillCount items when they cover the visible area', () => {
        setRowHeight(100);

        render(
            <DynamicVirtualizedList
                {...baseProps}
                initRangeFillCount={15}
            />,
        );

        // 15 rows of 100px are taller than the list with room to spare
        expect(screen.getAllByTestId('row')).toHaveLength(15);
        expect(screen.getByText('item0')).toBeInTheDocument();
        expect(screen.getByText('item14')).toBeInTheDocument();
    });

    test('should render more items before the list is shown when the first ones do not cover the visible area', () => {
        setRowHeight(30);

        render(
            <DynamicVirtualizedList
                {...baseProps}
                initRangeFillCount={15}
            />,
        );

        // 720px are needed, which takes 24 rows, and rows are added 5 at a time
        expect(screen.getAllByTestId('row')).toHaveLength(25);
    });

    test('should render the rest of the initial range once the browser is idle', () => {
        setRowHeight(100);

        render(
            <DynamicVirtualizedList
                {...baseProps}
                initRangeFillCount={15}
            />,
        );

        expect(screen.getAllByTestId('row')).toHaveLength(15);

        runIdleCallbacks();

        expect(screen.getAllByTestId('row')).toHaveLength(51);
    });

    test('should not render past the end of a short list', () => {
        setRowHeight(30);

        render(
            <DynamicVirtualizedList
                {...baseProps}
                itemData={itemData.slice(0, 8)}
                initRangeFillCount={15}
            />,
        );

        expect(screen.getAllByTestId('row')).toHaveLength(8);

        runIdleCallbacks();

        expect(screen.getAllByTestId('row')).toHaveLength(8);
    });
});
