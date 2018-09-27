/** gateway -- RChain / OAuth gateway Capper persistent objects

    BUG: clients don't revive when the server restarts.

    ISSUE: sessions?
    refresh = require('passport-oauth2-refresh')
    app.use(passport.session());

    ISSUE: indirect to SecretService for CLIENT_SECRET?
*/
// @flow strict
const URL = require('url').URL;

const discord = require('passport-discord');
const github = require('passport-github');
const rnodeAPI = require('rchain-api');

const { once, persisted, ready } = require('../../capper_start');
const keyPair = require('./keyPair');
const { rho } = require('./rhoTemplate');

const def = Object.freeze; // cf. ocap design note

/*::
import type { $Application } from 'express';
import type passportT from 'passport';

import type { Context, Sturdy, Persistent } from '../../capper_start';
import type { GameBoard } from './gameSession';

export opaque type Strategy = 'github' | 'discord';
export opaque type ClientSecret = string;
export interface OAuthClient {
}
interface OAuthClientP extends Persistent {
  init(pathM: mixed, callbackPathM: mixed, strategyM: mixed,
       id: mixed, secret: mixed, gameM: mixed): void
}

type Powers = {
   app: $Application,
   passport : passportT,
   baseURL : string,
   setSignIn: (string) => void,
   sturdyPath: (mixed) => string,
}
*/

/**
 * Construct Capper app for RChain OAuth oracle.
 *
 * app: as from express(), with .use(), .get()
 * passport: as from require('passport'), since it has mutable state
 *           ISSUE: use passport constructors
 * baseURL: base URL for mounting OAuth login, callback URLs
 */
exports.appFactory = appFactory;
function appFactory({ app, passport, baseURL, setSignIn, sturdyPath } /*: Powers*/) {
  app.use(passport.initialize());
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  const strategies = {
    github: opts => new github.Strategy(opts, verify),
    discord: opts => new discord.Strategy(Object.assign({ scope: 'identity' }, opts), verify),
  };

  return def({ oauthClient });

  function oauthClient(context /*: Context<*> */) /*: OAuthClientP */ {
    let state;
    if ('strategy' in context.state) {
      state = context.state;
      use();
    }

    return def({
      init,
      path: () => state.path,
      strategy: () => state.strategy,
      clientId: () => state.id,
    });

    function init(pathM, callbackPathM, strategyM, id, secret, gameM) {
      once(state);
      state = context.state;
      // console.log('client init:', { path, callbackPath, strategy, id });
      state.path = persisted(pathM);
      state.strategy = persisted(strategyM);
      state.opts = {
        callbackPath: persisted(callbackPathM),
        clientID: id,
        clientSecret: secret,
      };
      state.game = persisted(gameM);

      use();
    }

    function use() {
      const strategy = state.strategy;
      const makeStrategy = strategies[strategy];
      if (!makeStrategy) {
        throw new Error(`unknown strategy: ${strategy}`);
      }

      const opts = state.opts;
      opts.callbackURL = new URL(opts.callbackPath, baseURL).toString();

      passport.use(makeStrategy(opts, verify));
      // console.log('DEBUG: opts:', opts);

      app.get(state.path, passport.authenticate(strategy));
      setSignIn(state.path);

      app.get(
        opts.callbackPath,
        passport.authenticate(strategy, { failureRedirect: '/auth-failure-@@' }),
        (req, res) => {
          const session = state.game.sessionFor(req.user);
          const sessionAddr = sturdyPath(session);
          res.redirect(sessionAddr);
        },
      );
    }
  }

  function verify(accessToken, refreshToken, profile, done) {
    done(null, {
      username: profile.username,
      displayName: profile.displayName,
      detail: profile._json, // eslint-disable-line no-underscore-dangle
    });
  }
}


function trustCertTest(argv, { clock, randomBytes, grpc }) {
  const [_node, _script, host, portNum] = argv; // GRPC peer
  const port = parseInt(portNum, 10);
  const { logged, RHOCore } = rnodeAPI;

  const cert1 = {
    voter: 'dckc',
    subject: 'bob',
    rating: 2,
    cert_time: clock().toISOString(),
  };

  // $FlowFixMe: too lazy to stub drop, make
  const context1 /*: Context<*> */ = { state: {} };
  const gatewayKey = keyPair.appFactory({ randomBytes })
        .keyPair(context1);
  gatewayKey.init('gateway 1 key');
  console.log(gatewayKey, gatewayKey.publicKey());

  const rchain = rnodeAPI.RNode(grpc, { host, port });

  const certSigHex = gatewayKey.signBytesHex(RHOCore.toByteArray(RHOCore.fromJSData(cert1)));
  const certTerm = logged(
    rho`@"certify"!(${cert1}, ${certSigHex})`,
    'certTerm',
  );
  rchain.doDeploy(certTerm).then((result) => {
    console.log('doDeploy result:', result);

    if (!result.success) { throw result; }
    return rchain.createBlock().then((maybeBlock) => {
      logged(maybeBlock, 'createBlock?');
    });
  }).catch((oops) => { console.log(oops); });
}


if (require.main === module) {
  // ocap: Import powerful references only when invoked as a main module.
  /* eslint-disable global-require */
  trustCertTest(
    process.argv,
    {
      grpc: require('grpc'),
      clock: () => new Date(),
      randomBytes: require('crypto').randomBytes,
    },
  );
}
