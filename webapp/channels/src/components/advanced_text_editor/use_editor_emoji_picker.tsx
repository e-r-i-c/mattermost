// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {flip, offset, shift} from '@floating-ui/react';
import React, {memo, useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {EmoticonHappyOutlineIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Emoji, SystemEmoji} from '@mattermost/types/emojis';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getEmojiName, isSystemEmoji} from 'mattermost-redux/utils/emoji_utils';

import useEmojiPicker, {useEmojiPickerOffset} from 'components/emoji_picker/use_emoji_picker';
import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

import {unifiedToUnicode} from 'utils/emoji_utils';
import {focusAndInsertText} from 'utils/exec_commands';
import {horizontallyWithin} from 'utils/floating';

import type {GlobalState} from 'types/store';

type EditorEmojiPickerButtonProps = {
    textboxId: string;
    disabled: boolean;
    showEmojiPicker: boolean;
    setShowEmojiPicker: (showEmojiPicker: boolean) => void;
    enableGifPicker: boolean;
    onToggle: (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    onEmojiClick: (emoji: Emoji) => void;
    onGifClick: (gif: string) => void;
};

// This is a memoized component instead of part of the hook below so that the button, its tooltip and the positioning
// of the picker aren't rendered again every time the editor is, which is on every keystroke.
const EditorEmojiPickerButton = memo(({
    textboxId,
    disabled,
    showEmojiPicker,
    setShowEmojiPicker,
    enableGifPicker,
    onToggle,
    onEmojiClick,
    onGifClick,
}: EditorEmojiPickerButtonProps) => {
    const intl = useIntl();

    const {
        emojiPicker,
        getReferenceProps,
        setReference,
    } = useEmojiPicker({
        showEmojiPicker,
        setShowEmojiPicker,

        enableGifPicker,
        onGifClick,
        onEmojiClick,

        overrideMiddleware: [
            offset(useEmojiPickerOffset),
            shift(),
            horizontallyWithin({
                boundary: document.getElementById(textboxId),
            }),
            flip({
                fallbackAxisSideDirection: 'end',
            }),
        ],
    });

    return (
        <>
            <WithTooltip
                title={
                    <KeyboardShortcutSequence
                        shortcut={KEYBOARD_SHORTCUTS.msgShowEmojiPicker}
                        hoistDescription={true}
                        isInsideTooltip={true}
                    />
                }
            >
                <IconButton
                    id='emojiPickerButton'
                    ref={setReference}
                    size='small'
                    icon={
                        <Icon glyph={<EmoticonHappyOutlineIcon color='currentColor'/>}/>
                    }
                    onClick={onToggle}
                    aria-label={intl.formatMessage({id: 'emoji_picker.emojiPicker.button.ariaLabel', defaultMessage: 'select an emoji'})}
                    disabled={disabled}
                    toggled={showEmojiPicker}
                    {...getReferenceProps()}
                />
            </WithTooltip>
            {emojiPicker}
        </>
    );
});
EditorEmojiPickerButton.displayName = 'EditorEmojiPickerButton';

const useEditorEmojiPicker = (
    textboxId: string,
    isDisabled: boolean,
    shouldShowPreview: boolean,
    insertWysiwygText?: (text: string) => void,
) => {
    const enableEmojiPicker = useSelector((state: GlobalState) => getConfig(state).EnableEmojiPicker === 'true');
    const enableGifPicker = useSelector((state: GlobalState) => getConfig(state).EnableGifPicker === 'true');

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const toggleEmojiPicker = useCallback((e?: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e?.stopPropagation();
        setShowEmojiPicker((prev) => !prev);
    }, []);

    const insertTextAtCaret = useCallback((text: string) => {
        if (insertWysiwygText) {
            insertWysiwygText(text);
            return;
        }

        const textbox = document.getElementById(textboxId) as HTMLTextAreaElement | undefined;
        if (!textbox) {
            return;
        }

        const needsSpaceBefore = textbox.selectionStart !== 0 && !(/\s/).test(textbox.value[textbox.selectionStart - 1]);
        const textToBeAdded = needsSpaceBefore ? ` ${text} ` : `${text} `;

        focusAndInsertText(textbox, textToBeAdded);
    }, [textboxId, insertWysiwygText]);

    const handleEmojiClick = useCallback((emoji: Emoji) => {
        if (isSystemEmoji(emoji)) {
            insertTextAtCaret(unifiedToUnicode((emoji as SystemEmoji).unified));
        } else {
            const emojiAlias = getEmojiName(emoji);
            if (!emojiAlias) {
                return;
            }
            insertTextAtCaret(`:${emojiAlias}:`);
        }

        setShowEmojiPicker(false);
    }, [insertTextAtCaret, textboxId]);

    const handleGifClick = useCallback((gif: string) => {
        insertTextAtCaret(gif);

        setShowEmojiPicker(false);
    }, [insertTextAtCaret]);

    let emojiPickerControls = null;
    if (enableEmojiPicker && !isDisabled) {
        emojiPickerControls = (
            <EditorEmojiPickerButton
                textboxId={textboxId}
                disabled={shouldShowPreview}
                showEmojiPicker={showEmojiPicker}
                setShowEmojiPicker={setShowEmojiPicker}
                enableGifPicker={enableGifPicker}
                onToggle={toggleEmojiPicker}
                onEmojiClick={handleEmojiClick}
                onGifClick={handleGifClick}
            />
        );
    }

    return {emojiPicker: emojiPickerControls, enableEmojiPicker, toggleEmojiPicker};
};

export default useEditorEmojiPicker;
