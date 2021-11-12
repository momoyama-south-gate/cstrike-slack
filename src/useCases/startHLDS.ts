import * as fs from 'fs';

import { ServerConfig } from '../domainObjects/serverConfig';
import { Settings } from '../settings';

export { startHLDS, renderHLDSConfig };

async function startHLDS(settings: Settings, config: ServerConfig): Promise<void> {
    const { pathToCzeroServerCfg } = settings;

    const hldsConfig = buildHLDSConfig(config);
    const newConfig = renderHLDSConfig(hldsConfig);
    await fs.promises.writeFile(pathToCzeroServerCfg, newConfig);
}

enum BotQuotaMode {
    Normal = 'normal',
    Fill = 'fill',
    Match = 'match',
}

enum BotDifficulty {
    Easy = '0',
    Normal = '1',
    Hard = '2',
    Expert = '3',
}

interface HLDSConfig {
    bot_allow_shield: boolean;
    bot_auto_vacate: boolean;
    bot_join_after_player: boolean;
    bot_difficulty: BotDifficulty;
    bot_quota: number;
    bot_quota_mode: BotQuotaMode;
    hostname: string;
    mp_winlimit: number;
    mp_timelimit: number;
    mp_autoteambalance: boolean;
    pausable: boolean;
    sv_aim: boolean;
    sv_password: string;
    sv_maxspeed: number;
    sv_cheats: boolean;
}

const defaultHLDSConfig: HLDSConfig = {
    bot_allow_shield: false,
    bot_auto_vacate: true,
    bot_difficulty: BotDifficulty.Expert,
    bot_join_after_player: true,
    bot_quota: 9,
    bot_quota_mode: BotQuotaMode.Fill,
    hostname: 'Counter-Strike: Condition Zero',
    mp_winlimit: 11,
    mp_timelimit: 120,
    mp_autoteambalance: true,
    pausable: false,
    sv_aim: false,
    sv_password: '',
    sv_maxspeed: 320,
    sv_cheats: false,
};

function buildHLDSConfig(config: ServerConfig): HLDSConfig {
    const { name, password, players } = config;
    // TODO: move max players to `ServerConfig`
    const maxPlayers = 10;
    return { ...defaultHLDSConfig, hostname: name, sv_password: password, bot_quota: maxPlayers - players.length };
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

function renderHLDSConfig(config: HLDSConfig): string {
    return Object.entries(config)
        .map(([key, value]) => {
            let valueStr = '';
            switch (typeof value) {
                case 'boolean':
                    valueStr = value ? '1' : '0';
                    break;
                case 'number':
                    valueStr = value.toString();
                    break;
                case 'string':
                    valueStr = `"${value}"`;
                    break;
                default:
                    throw Error(`unsupported type ${typeof value}`);
            }

            return `${key} ${valueStr}`;
        })
        .join(`\n`);
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
