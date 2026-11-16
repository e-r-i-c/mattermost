// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {PostPriorityMetadata} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {isPostPriorityEnabled as isPostPriorityEnabledSelector} from 'mattermost-redux/selectors/entities/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import PersistNotificationConfirmModal from 'components/persist_notification_confirm_modal';
import PostPriorityPicker from 'components/post_priority/post_priority_picker';

import {useLatest} from 'hooks/useLatest';
import Constants, {ModalIdentifiers} from 'utils/constants';
import {hasRequestedPersistentNotifications, mentionsMinusSpecialMentionsInText, specialMentionsInText} from 'utils/post_utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import PriorityLabels from './priority_labels';

const NO_SPECIAL_MENTIONS: {[key: string]: boolean} = {all: false, channel: false, here: false};

const usePriority = (
    draft: PostDraft,
    handleDraftChange: ((draft: PostDraft, options: {instant?: boolean; show?: boolean}) => void),
    focusTextbox: (keepFocus?: boolean) => void,
    shouldShowPreview: boolean,
    showIndividualCloseButton = true,
) => {
    const dispatch = useDispatch();
    const rootId = draft.rootId;
    const channelId = draft.channelId;

    // The handlers read the draft from this ref so that they, and the controls that are given them, don't change
    // on every keystroke
    const latestDraft = useLatest(draft);

    const isPostPriorityEnabled = useSelector(isPostPriorityEnabledSelector);
    const channelType = useSelector((state: GlobalState) => getChannel(state, channelId)?.type || 'O');
    const channelTeammateUsername = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        return getUser(state, channel?.teammate_id || '')?.username || '';
    });

    const hasPrioritySet = isPostPriorityEnabled &&
    draft.metadata?.priority &&
    (
        draft.metadata.priority.priority ||
        draft.metadata.priority.requested_ack
    );

    // Finding these means parsing the message as markdown, and they only matter for a post with a priority, so
    // skip that while typing an ordinary message
    const specialMentions = useMemo(() => {
        return hasPrioritySet ? specialMentionsInText(draft.message) : NO_SPECIAL_MENTIONS;
    }, [hasPrioritySet, draft.message]);

    const hasSpecialMentions = useMemo(() => {
        return Object.values(specialMentions).includes(true);
    }, [specialMentions]);

    const isValidPersistentNotifications = useMemo(() => {
        if (!hasPrioritySet) {
            return true;
        }

        const {priority, persistent_notifications: persistentNotifications} = draft.metadata!.priority!;
        if (priority !== PostPriority.URGENT || !persistentNotifications) {
            return true;
        }

        if (channelType === Constants.DM_CHANNEL) {
            return true;
        }

        if (hasSpecialMentions) {
            return false;
        }

        const mentions = mentionsMinusSpecialMentionsInText(draft.message);

        return mentions.length > 0;
    }, [hasPrioritySet, draft, channelType, hasSpecialMentions]);

    const handlePostPriorityApply = useCallback((settings?: PostPriorityMetadata) => {
        const updatedDraft = {
            ...latestDraft.current,
        };

        if (settings?.priority || settings?.requested_ack) {
            updatedDraft.metadata = {
                ...updatedDraft.metadata,
                priority: {
                    ...settings,
                    priority: settings!.priority || '',
                    requested_ack: settings!.requested_ack,
                },
            };
        } else {
            // Remove priority but keep other metadata
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {priority, ...restMetadata} = updatedDraft.metadata || {};
            updatedDraft.metadata = restMetadata;
        }

        handleDraftChange(updatedDraft, {instant: true});
        focusTextbox();
    }, [focusTextbox, latestDraft, handleDraftChange]);

    const handlePostPriorityHide = useCallback(() => {
        focusTextbox(true);
    }, [focusTextbox]);

    const handleRemovePriority = useCallback(() => {
        handlePostPriorityApply();
    }, [handlePostPriorityApply]);

    const showPersistNotificationModal = useCallback((message: string, specialMentions: {[key: string]: boolean}, channelType: Channel['type'], onConfirm: () => void) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.PERSIST_NOTIFICATION_CONFIRM_MODAL,
            dialogType: PersistNotificationConfirmModal,
            dialogProps: {
                currentChannelTeammateUsername: channelTeammateUsername,
                specialMentions,
                channelType,
                message,
                onConfirm,
            },
        }));
    }, [channelTeammateUsername, dispatch]);

    const onSubmitCheck = useCallback((onConfirm: () => void) => {
        const draft = latestDraft.current;

        if (
            isPostPriorityEnabled &&
            hasRequestedPersistentNotifications(draft?.metadata?.priority)
        ) {
            showPersistNotificationModal(draft.message, specialMentionsInText(draft.message), channelType, onConfirm);
            return true;
        }
        return false;
    }, [isPostPriorityEnabled, showPersistNotificationModal, latestDraft, channelType]);

    const priority = draft.metadata?.priority;
    const labels = useMemo(() => (
        (hasPrioritySet && !rootId) ? (
            <PriorityLabels
                canRemove={showIndividualCloseButton && !shouldShowPreview}
                hasError={!isValidPersistentNotifications}
                specialMentions={specialMentions}
                onRemove={handleRemovePriority}
                persistentNotifications={priority?.persistent_notifications}
                priority={priority?.priority}
                requestedAck={priority?.requested_ack}
            />
        ) : undefined
    ), [hasPrioritySet, rootId, showIndividualCloseButton, shouldShowPreview, isValidPersistentNotifications, specialMentions, handleRemovePriority, priority]);

    const additionalControl = useMemo(() =>
        !rootId && isPostPriorityEnabled && (
            <PostPriorityPicker
                key='post-priority-picker-key'
                settings={draft.metadata?.priority}
                onApply={handlePostPriorityApply}
                onClose={handlePostPriorityHide}
                disabled={shouldShowPreview}
            />
        ), [rootId, isPostPriorityEnabled, draft.metadata?.priority, handlePostPriorityApply, handlePostPriorityHide, shouldShowPreview]);

    return {
        labels,
        additionalControl,
        isValidPersistentNotifications,
        onSubmitCheck,
        handleRemovePriority,
    };
};

export default usePriority;
