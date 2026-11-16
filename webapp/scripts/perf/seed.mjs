// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, no-await-in-loop */

// Seeds a server with the data used by responsiveness_benchmark.mjs: a team with several channels full of
// posts and one long thread. It's safe to run more than once, since anything that already exists is reused.

export const TEAM_NAME = 'perfbench';
export const CHANNEL_COUNT = 10;
export const POSTS_PER_CHANNEL = 200;
export const THREAD_REPLIES = 80;

const SAMPLE_MESSAGES = [
    'Morning all, the deploy went out at 9 and everything looks healthy so far.',
    'Can someone take a look at the failing job? It started after the last merge to `main`.',
    'Thanks! I\'ll **follow up** with the customer and report back here once I hear from them.',
    'A few notes from the call:\n\n- Pricing page copy needs another pass\n- Legal is fine with the new terms\n- Launch stays on the 14th',
    '@sysadmin could you review https://example.com/pull/1234 when you get a chance? :eyes:',
    '```\nconst total = items.reduce((sum, item) => sum + item.price, 0);\nconsole.log(total);\n```',
    'Sounds good to me.',
    '> We should ship the smaller change first.\n\nAgreed, and it gives us a clean baseline to compare against.',
    'Reminder that the retro is at 3pm in ~town-square. Add your topics to the board before then.',
    '| Region | Requests | Errors |\n| --- | --- | --- |\n| us-east | 120k | 12 |\n| eu-west | 98k | 7 |',
];

export class Api {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = '';
    }

    async request(method, path, body) {
        const response = await fetch(`${this.baseUrl}/api/v4${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(this.token ? {Authorization: `Bearer ${this.token}`} : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        return {ok: response.ok, status: response.status, data, headers: response.headers};
    }

    async mustRequest(method, path, body) {
        const result = await this.request(method, path, body);
        if (!result.ok) {
            throw new Error(`${method} ${path} failed with ${result.status}: ${JSON.stringify(result.data)}`);
        }
        return result.data;
    }

    async login(username, password) {
        const result = await this.request('POST', '/users/login', {login_id: username, password});
        if (!result.ok) {
            return null;
        }
        this.token = result.headers.get('Token');
        return result.data;
    }
}

export async function seed({baseUrl, username, password}) {
    const api = new Api(baseUrl);

    let user = await api.login(username, password);
    if (!user) {
        // On a new server, the first user to be created becomes the system admin
        await api.mustRequest('POST', '/users', {
            email: `${username}@example.com`,
            username,
            password,
        });
        user = await api.login(username, password);
        if (!user) {
            throw new Error(`Unable to log in as ${username}. Set MM_USERNAME and MM_PASSWORD to a system admin.`);
        }
    }

    // Skip the onboarding flows that would otherwise cover the channel
    await api.mustRequest('PUT', `/users/${user.id}/preferences`, [
        {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
        {user_id: user.id, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
        {user_id: user.id, category: 'insights', name: 'insights_tutorial_state', value: '{"insights_modal_viewed":true}'},
        {user_id: user.id, category: 'drafts', name: 'drafts_tour_tip_showed', value: '{"drafts_tour_tip_showed":true}'},
        {user_id: user.id, category: 'crt_thread_pane_step', name: user.id, value: '999'},
    ]);

    const existingTeam = await api.request('GET', `/teams/name/${TEAM_NAME}`);
    let team = existingTeam.data;
    if (!existingTeam.ok) {
        team = await api.mustRequest('POST', '/teams', {name: TEAM_NAME, display_name: 'Perf Bench', type: 'O'});
    }
    await api.request('POST', `/teams/${team.id}/members`, {team_id: team.id, user_id: user.id});

    const channels = [];
    for (let i = 0; i < CHANNEL_COUNT; i++) {
        const name = `perf-channel-${i}`;
        const existingChannel = await api.request('GET', `/teams/${team.id}/channels/name/${name}`);
        let channel = existingChannel.data;
        if (!existingChannel.ok) {
            channel = await api.mustRequest('POST', '/channels', {
                team_id: team.id,
                name,
                display_name: `Perf Channel ${i}`,
                type: 'O',
            });
        }
        await api.request('POST', `/channels/${channel.id}/members`, {user_id: user.id});

        const postsToCreate = POSTS_PER_CHANNEL - (channel.total_msg_count_root ?? 0);
        for (let j = 0; j < postsToCreate; j++) {
            await api.mustRequest('POST', '/posts', {
                channel_id: channel.id,
                message: SAMPLE_MESSAGES[(i + j) % SAMPLE_MESSAGES.length],
            });
        }

        channels.push(channel);
        console.log(`Seeded ${channel.name} (${Math.max(postsToCreate, 0)} new posts)`);
    }

    // One long thread, on a known root post in the first channel
    const threadChannel = channels[0];
    const pinned = await api.mustRequest('GET', `/channels/${threadChannel.id}/pinned`);
    let rootPost = Object.values(pinned.posts ?? {}).find((post) => post.message.startsWith('Perf thread root'));
    if (!rootPost) {
        rootPost = await api.mustRequest('POST', '/posts', {
            channel_id: threadChannel.id,
            message: 'Perf thread root: what should we tackle first next quarter?',
        });
        await api.mustRequest('POST', `/posts/${rootPost.id}/pin`);
        for (let j = 0; j < THREAD_REPLIES; j++) {
            await api.mustRequest('POST', '/posts', {
                channel_id: threadChannel.id,
                root_id: rootPost.id,
                message: SAMPLE_MESSAGES[j % SAMPLE_MESSAGES.length],
            });
        }
        console.log(`Seeded a thread with ${THREAD_REPLIES} replies`);
    }

    return {user, team, channels, rootPost};
}
