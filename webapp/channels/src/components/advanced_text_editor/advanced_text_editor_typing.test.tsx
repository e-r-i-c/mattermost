// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Permissions from 'mattermost-redux/constants/permissions';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AdvancedTextEditor from './advanced_text_editor';

const mockFormattingBarRendered = jest.fn();
const mockSendButtonRendered = jest.fn();
const mockToggleFormattingBarRendered = jest.fn();
const mockUseEmojiPicker = jest.fn();

// These stand in for the memoized parts of the editor that don't show the message. Like the real ones, they only
// render again when they're given different props, which is what typing shouldn't do.
jest.mock('./formatting_bar', () => {
    const ReactMock = require('react');
    return {
        __esModule: true,
        default: ReactMock.memo(ReactMock.forwardRef((props: any, ref: any) => {
            ReactMock.useImperativeHandle(ref, () => ({}));
            mockFormattingBarRendered(props);
            return <div data-testid='formatting-bar'/>;
        })),
    };
});

jest.mock('./send_button', () => {
    const ReactMock = require('react');
    return {
        __esModule: true,
        default: ReactMock.memo((props: any) => {
            mockSendButtonRendered(props);
            return <div data-testid='send-button'/>;
        }),
    };
});

jest.mock('./toggle_formatting_bar', () => {
    const ReactMock = require('react');
    return {
        __esModule: true,
        default: ReactMock.memo((props: any) => {
            mockToggleFormattingBarRendered(props);
            return <div data-testid='toggle-formatting-bar'/>;
        }),
    };
});

jest.mock('components/emoji_picker/use_emoji_picker', () => ({
    __esModule: true,
    useEmojiPickerOffset: 4,
    default: (options: any) => {
        mockUseEmojiPicker(options);
        return {
            emojiPicker: null,
            getReferenceProps: () => ({}),
            setReference: () => {},
        };
    },
}));

const channelId = 'current_channel_id';

const initialState = {
    entities: {
        general: {
            config: {
                EnableEmojiPicker: 'true',
                PostPriority: 'true',
            },
        },
        channels: {
            channels: {
                [channelId]: TestHelper.getChannelMock({
                    id: channelId,
                    team_id: 'current_team_id',
                    display_name: 'Test Channel',
                }),
            },
            roles: {
                [channelId]: new Set(['channel_roles']),
            },
        },
        roles: {
            roles: {
                user_roles: {permissions: [Permissions.CREATE_POST]},
            },
        },
        teams: {
            currentTeamId: 'current_team_id',
            teams: {
                current_team_id: TestHelper.getTeamMock({id: 'current_team_id'}),
            },
            myMembers: {
                current_team_id: TestHelper.getTeamMembershipMock({roles: 'team_roles'}),
            },
        },
        users: {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: TestHelper.getUserMock({id: 'current_user_id', roles: 'user_roles'}),
            },
        },
    },
};

describe('AdvancedTextEditor while typing', () => {
    beforeEach(() => {
        mockFormattingBarRendered.mockClear();
        mockSendButtonRendered.mockClear();
        mockToggleFormattingBarRendered.mockClear();
        mockUseEmojiPicker.mockClear();
    });

    it('should not render the controls around the textbox again on every keystroke', async () => {
        renderWithContext(
            <AdvancedTextEditor
                location='CENTER'
                channelId={channelId}
                rootId=''
            />,
            initialState,
        );

        const textbox = screen.getByPlaceholderText('Write to Test Channel');

        // The first character changes what's shown, such as enabling the send button, so start counting after it
        await userEvent.type(textbox, 'T');

        expect(mockFormattingBarRendered).toHaveBeenCalled();
        expect(mockSendButtonRendered).toHaveBeenCalled();
        expect(mockToggleFormattingBarRendered).toHaveBeenCalled();
        expect(mockUseEmojiPicker).toHaveBeenCalled();

        mockFormattingBarRendered.mockClear();
        mockSendButtonRendered.mockClear();
        mockToggleFormattingBarRendered.mockClear();
        mockUseEmojiPicker.mockClear();

        await userEvent.type(textbox, 'his is a message for @all');

        expect(textbox).toHaveValue('This is a message for @all');

        expect(mockFormattingBarRendered).not.toHaveBeenCalled();
        expect(mockSendButtonRendered).not.toHaveBeenCalled();
        expect(mockToggleFormattingBarRendered).not.toHaveBeenCalled();
        expect(mockUseEmojiPicker).not.toHaveBeenCalled();
    });
});
