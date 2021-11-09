import { Option } from '@slack/bolt';
import * as Console from 'fp-ts/Console';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { App } from '../app';
import { ServerConfig } from '../domain';
import * as ErrorMessageBlocks from '../views/errorMessageBlocks';
import * as ServerConfigModal from '../views/serverConfigModal';
import * as ServerStartedSuccessfullyMessageBlocks from '../views/serverStartedSuccessfullyMessageBlocks';

export { handle };

function handle(app: App): void {
    const { slackApp, grpcClient, config } = app;
    const { cstrikeChannel } = config;

    slackApp.view(ServerConfigModal.callbackId, async ({ ack, body, client }) => {
        await ack();
        const { values } = body.view.state;

        try {
            const config = pipe(values, parseServerConfig, getOrThrow);

            const response = await grpcClient.servantService.startServer(config);
            const res = getOrThrow(response);

            if (res.success) {
                await client.chat.postMessage({
                    channel: cstrikeChannel,
                    blocks: ServerStartedSuccessfullyMessageBlocks.buildView({
                        users: config.players,
                        maps: config.maps,
                    }),
                });
            } else {
                await client.chat.postMessage({
                    channel: cstrikeChannel,
                    blocks: ErrorMessageBlocks.buildView({ why: res.errorMessage }),
                });
            }
        } catch (e) {
            Console.error(e)();
        }
    });
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Values {
    [block_id: string]: {
        [action_id: string]: any;
    };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

function parseServerConfig(values: Values): E.Either<Error, ServerConfig> {
    function buildParserError(field: string): Error {
        return new Error(`Unable to parse ${field}`);
    }

    function parseText(block_id: string, action_id: string, field: string): E.Either<Error, string> {
        const err = buildParserError(field);
        const fromNullable = E.fromNullable(err);

        return pipe(
            E.bindTo('block')(fromNullable(values[block_id])),
            E.bind('action', ({ block }) => fromNullable(block[action_id])),
            E.bind('value', ({ action }) => fromNullable((action as { value: string }).value)),
            E.map(({ value }) => value),
        );
    }

    function parsePlayers(block_id: string, action_id: string): E.Either<Error, string[]> {
        const err = buildParserError('players');
        const fromNullable = E.fromNullable(err);

        return pipe(
            E.bindTo('block')(fromNullable(values[block_id])),
            E.bind('action', ({ block }) => fromNullable(block[action_id])),
            E.bind('players', ({ action }) => fromNullable((action as { selected_users: string[] }).selected_users)),
            E.map(({ players }) => players),
        );
    }

    function parseMaps(block_id: string, action_id: string): E.Either<Error, string[]> {
        const err = buildParserError('maps');
        const fromNullable = E.fromNullable(err);

        return pipe(
            E.bindTo('block')(fromNullable(values[block_id])),
            E.bind('action', ({ block }) => fromNullable(block[action_id])),
            E.bind('options', ({ action }) =>
                fromNullable((action as { selected_options: Option[] }).selected_options),
            ),
            E.map(({ options }) => options.map((option) => option.value as string)),
        );
    }

    const {
        nameInputActionId,
        nameInputBlockId,
        passwordInputActionId,
        passwordInputBlockId,
        playersSelectActionId,
        playersSelectBlockId,
        mapsSelectActionId,
        mapsSelectBlockId,
    } = ServerConfigModal;

    return pipe(
        E.bindTo('name')(parseText(nameInputBlockId, nameInputActionId, 'name')),
        E.bind('password', () => parseText(passwordInputBlockId, passwordInputActionId, 'password')),
        E.bind('players', () => parsePlayers(playersSelectBlockId, playersSelectActionId)),
        E.bind('maps', () => parseMaps(mapsSelectBlockId, mapsSelectActionId)),
        E.map(({ name, password, players, maps }) => {
            return {
                name,
                password,
                players,
                maps,
            };
        }),
    );
}

function getOrThrow<A>(x: E.Either<Error, A>): A {
    return pipe(
        x,
        E.match(
            (e) => {
                throw e;
            },
            (a) => a,
        ),
    );
}
