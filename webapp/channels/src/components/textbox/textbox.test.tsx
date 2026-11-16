// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import Textbox from './textbox';
import type {Props} from './textbox';

jest.mock('components/post_markdown', () => ({
    __esModule: true,
    default: ({message}: {message: string}) => <div data-testid='mock-post-markdown'>{message}</div>,
}));

describe('components/textbox/Textbox', () => {
    const baseProps: Props = {
        id: 'post_textbox',
        channelId: 'channelId',
        rootId: '',
        value: 'Some **markdown** text',
        onChange: jest.fn(),
        onKeyPress: jest.fn(),
        createMessage: 'Write a message',
        characterLimit: 10000,
        currentUserId: 'currentUserId',
        currentTeamId: 'currentTeamId',
        autocompleteGroups: null,
        delayChannelAutocomplete: false,
        actions: {
            autocompleteUsersInChannel: jest.fn(),
            autocompleteChannels: jest.fn(),
            searchAssociatedGroupsForReference: jest.fn(),
            fetchAgents: jest.fn(),
        },
        useChannelMentions: true,
    };

    test('should not format the message for the preview while the preview is hidden', () => {
        renderWithContext(<Textbox {...baseProps}/>);

        expect(screen.queryByTestId('mock-post-markdown')).not.toBeInTheDocument();
        expect(screen.getByTestId('post_textbox')).toHaveValue('Some **markdown** text');
    });

    test('should format the message once the preview is shown', () => {
        const {rerender} = renderWithContext(<Textbox {...baseProps}/>);

        rerender(
            <Textbox
                {...baseProps}
                preview={true}
            />,
        );

        expect(screen.getByTestId('mock-post-markdown')).toHaveTextContent('Some **markdown** text');
    });
});
