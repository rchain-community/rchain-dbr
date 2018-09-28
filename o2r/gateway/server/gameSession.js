/** gameSession -- sit in on RChain games

    Each game is represented by a key pair. If you are granted a session
    (e.g. via OAuth), your moves will be signed and deployed to RChain.

*/
// @flow strict

const { RHOCore, logged } = require('rchain-api');

const { rho } = require('./rhoTemplate');
const { once, persisted } = require('../../capper_start');

/*:: // ISSUE: belongs in RChain-API
import { RNode } from 'rchain-api';
opaque type Rholang = string;
type RChain = $Call<typeof RNode, mixed, { host: string, port: number }>
*/

/*::
import type { Context, Persistent } from '../../capper_start';
import type { Hex, PublicKey, Signature } from './keyPair';
import type { Provider, Token, OAuthClient } from './main';

interface GameSession {
  info(): {
    created: TimeInMs,
    userProfile: UserProfile,
    gameLabel: string,
    gameKey: Hex<PublicKey>,
  },
  select(tablename: string): Record[],
  merge(tablename: string, record: Record): Promise<MergeResult>
};

interface GameSessionP extends Persistent, GameSession {
  init(maybeUserProfile: mixed, maybeGame: mixed): void
}

export interface GameBoard {
  select(tablename: string): Record[],
  merge(tablename: string, record: Record): Promise<MergeResult>,
  makeSignIn(path: string, callbackPath: string,
             provider: Provider, locus: string, role: string, token: Token,
             id: string, secret: Token): OAuthClient,
  sessionFor(userProfile: UserProfile): GameSession,
  label(): string,
  publicKey(): Hex<PublicKey>
}

interface GameBoardP extends Persistent, GameBoard {
}

// cribbed from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/passport/index.d.ts#L130
type UserProfile = {
  id: string,
}

opaque type TimeInMs = number;

type Record = { [string]: mixed };

type MergeResult = {
  turnSig: Hex<Signature>,
  takeTurnTerm: Rholang,
  recordKey: mixed[],
};

type GamePowers = {
  clock: () => Date,
  rchain: RChain,
}
*/

const def = Object.freeze;

// ISSUE: TODO: get peers to rate from github / discord
const mockDB = {
  // ISSUE: dbr_tables.sql calls it github_users, with login
  users: {
    key: ['username'],
    // JSON-stringified key cols -> record
    records: {
      '["a1"]': { username: 'a1', displayName: 'Angela' },
      '["b2"]': { username: 'b2', displayName: 'Bob' },
      '["c3"]': { username: 'c3', displayName: 'Charlie' },
      '["d4"]': { username: 'd4', displayName: 'Darlene' },
    },
  },
  trust_cert: {
    key: ['voter', 'subject'],
    records: {},
  },
};


module.exports.appFactory = appFactory;
function appFactory(parent /*: string*/, { clock, rchain } /*: GamePowers*/) {
  return def({ gameSession, gameBoard });

  function gameSession(context /*: Context<*> */) /*: GameSessionP */ {
    const state = context.state;

    function init(userProfileM, gameM) {
      once(state);

      state.userProfile = persisted(userProfileM);
      state.game = persisted(gameM);
      state.created = clock().valueOf(); // persist as millis
    }

    return def({
      init,
      info,
      select: tableName => state.game.select(tableName),
      merge: (tableName, record) => state.game.merge(tableName, record),
    });

    function info() {
      return def({
        created: state.created,
        userProfile: state.userProfile,
        gameLabel: state.game.label(),
        gameKey: state.game.publicKey(),
      });
    }
  }

  function gameBoard(context /*: Context<*> */) /*: GameBoard */ {
    let state = context.state;

    function init(label /*: mixed*/) {
      once(state);
      if (typeof label !== 'string') { throw new TypeError('label must be string'); }
      state = context.state;
      state.label = label;
      state.gameKey = context.make('keyChain.keyPair', `for ${label}`);
      state.players = {};
      // ISSUE: TODO: state.peers = ... from github
    }

    const label = () => state.label;
    const publicKey = () => state.gameKey.publicKey();
    const self = def({ init, select, merge, makeSignIn, sessionFor, label, publicKey });
    return self;

    function makeSignIn(path, callbackPath, provider, locus, role, token, id, secret) {
      const makers = {
        'github': 'gateway.githubProvider', // ISSUE: hard-code gateway?
        'discord': 'gateway.discordProvider',
      };
      const maker = makers[String(provider)]
      if (!maker) { throw new Error(`unknown provider: ${String(provider)}`); }
      console.log('makeSignIn:', { path, callbackPath, locus, role, token, id, secret, provider, maker, self });
      return context.make(maker,
                          path, callbackPath,
                          locus, role, token,
                          id, secret, self);
    }

    function sessionFor(userProfile) {
      const { id } = userProfile;
      const { players } = state;
      let session = players[id];
      if (!session) {
        session = context.make(`${parent}.gameSession`, userProfile, self);
        players[id] = session;
      }
      return session;
    }

    function select(tablename /*: string*/) /*: Record[] */ {
      const table = mockDB[tablename];
      if (!table) {
        throw new Error(`unknown table: ${tablename}`);
      }

      return values(table.records);
    }

    /* typesafe version of Object.values */
    function values(o) {
      return Object.keys(o).map(p => o[p]);
    }

    function merge(tablename /*: string*/, record /*: { [string]: mixed } */) {
      if (tablename !== 'trust_cert') {
        throw new Error(`not implemented: ${tablename}`);
      }

      const table = mockDB[tablename];
      const recordKey = table.key.map(field => record[field]);

      const gameKey = state.gameKey;

      const turnMsg = ['merge', tablename, record];
      const turnSig = gameKey.signDataHex(turnMsg);
      const takeTurnTerm = rho`@"takeTurn"!(${gameKey.publicKey()}, ${turnMsg}, ${turnSig}, "stdout")`;

      console.log('@@deploying:', takeTurnTerm);
      return rchain.doDeploy(takeTurnTerm).then((result) => {
        console.log('doDeploy result:', result);
        if (!result.success) {
          throw result;
        }

        return rchain.createBlock().then((maybeBlock) => {
          if (!maybeBlock.block) { throw new Error('createBlock failed'); }
          logged(maybeBlock.block.blockHash, 'created block:');
          return { turnSig, takeTurnTerm, recordKey };
        });
      });
    }
  }
}
