/** gameSession -- sit in on RChain games

    Each game is represented by a key pair. If you are granted a session
    (e.g. via OAuth), your moves will be signed and deployed to RChain.

*/
// @flow strict

const { rho } = require('./rhoTemplate');
const { once, persisted } = require('../../capper_start');
const { verifyDataSigHex } = require('./keyPair');

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
};

interface GameSessionP extends Persistent, GameSession {
  init(maybeUserProfile: mixed, maybeGame: mixed): void
}

export interface GameBoard {
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

type GamePowers = {
  clock: () => Date,
  rchain: RChain,
}
*/

const def = Object.freeze;

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
      requestCertificate,
    });

    function requestCertificate(binding) {
      console.log('reqCert binding:@@', JSON.stringify(binding));
      return state.game.counterSign(binding);
    }

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
    const self = def({ init, counterSign, makeSignIn, sessionFor, label, publicKey });
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

    function counterSign(claim) {
      checkCurrent(claim);
      checkSig(claim);

      const endorsement = state.gameKey.signDataHex(claim);
      const cert = rho`${{ claim, endorsement }}`;

      console.log('deploying:', cert);
      return rchain.doDeploy({ term: cert }).then((message) => {
        console.log('doDeploy result:', message);

        return rchain.createBlock().then(() => {
          console.log('created block');
          return cert;
        });
      });
    }

    function checkCurrent(claim) {
      const { memberSigTime } = claim;

      const now = clock().valueOf();
      const threshold = 10 * 60 * 1000;
      const lo = new Date(now - threshold).toISOString();
      const hi = new Date(now + threshold).toISOString();
      if (memberSigTime < lo || memberSigTime > hi) { throw new Error('bad sig time'); }
    }

    function checkSig(claim) {
      const { binding: { publicKey, discord }, memberSignature } = claim;
      const ok = verifyDataSigHex({ publicKey, discord }, memberSignature, publicKey);
      if (!ok) { throw new Error('bad sig'); }
    }
  }
}
