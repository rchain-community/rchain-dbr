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

const { once, persisted } = require('../../capper_start');
const keyPair = require('./keyPair');
const { rho } = require('./rhoTemplate');

const def = Object.freeze; // cf. ocap design note

/*::
import type { $Application } from 'express';
import type passportT from 'passport';

import type { Context, Sturdy, Persistent } from '../../capper_start';
import type { GameBoard } from './gameSession';

export opaque type Provider = 'github' | 'discord';
export opaque type Token = string;
export interface OAuthClient {
}
interface OAuthClientP extends Persistent {
  init(pathM: mixed, callbackPathM: mixed, providerM: mixed,
       id: mixed, secret: mixed, gameM: mixed): void
}

type Powers = {
   app: $Application,
   passport : passportT,
   baseURL : string,
   setSignIn: (string) => void,
   sturdyPath: (mixed) => string,
}

type DiscordRoleNeeded = {
  provider: 'discord',
  botToken: Token,
  guildID: string,
  roleID: string,
}

type GithubRepoAccessNeeded = {
  provider: 'github',
  repository: string,
  role: 'WRITE' | 'ADMIN',
}

type OState = {
  path: string,
  opts: {
   callbackPath: string,
   callbackURL?: string,
   clientID: string,
   clientSecret: Token,
  },
  privilege: DiscordRoleNeeded | GithubRepoAccessNeeded,
  game: GameBoard,
};

// https://discordapp.com/developers/docs/resources/user
interface DiscordUser {
  id: string, // ISSUE: opaque snowflake type?
  username: string,
  discriminator: string, // 4 digit discord-tag
  avatar: ?string,
  bot?: bool,
  mfa_enabled?: bool,
  locale?: string,
  verified?: bool,
  email?: string
}

// ISSUE: look up github docs
interface GithubAccount {
  username: string,
  displayName: string,
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

  // ISSUE: state parameter
  // https://discordapp.com/developers/docs/topics/oauth2#state-and-security
  const providers = {
    github: {
      makeMiddleware: opts => new github.Strategy(opts, githubVerify),
    },
    discord: {
      makeMiddleware: opts => new discord.Strategy({ scope: ['identify'], ...opts}, discordVerify),
    }
  };

  return def({ oauthClient });

  function oauthClient(context /*: Context<OState> */) /*: OAuthClientP */ {
    const state = context.state;
    if ('provider' in context.state) {
      installRoutes();
    }

    return def({
      init,
      path: () => state.path,
      provider: () => state.privilege.provider,
      clientId: () => state.opts.clientID,
    });

    function init(pathM, callbackPathM,
                  providerM, idM, secretM,
                  locusM, roleM, tokenM,
                  gameM) {
      once(state);

      // console.log('client init:', { path, callbackPath, strategy, id });
      state.path = persisted(pathM);
      state.opts = {
        callbackPath: persisted(callbackPathM),
        clientID: persisted(idM),
        clientSecret: persisted(secretM),
      };
      if (providerM === 'discord') {
        state.privilege = {
          provider: 'discord',
          botToken: persisted(tokenM),
          guildID: persisted(locusM),
          roleID: persisted(roleM),
        };
      } else if (providerM == 'github') {
        state.privilege = {
          provider: 'github',
          repository: persisted(locusM),
          repoToken: persisted(tokenM),
          role: persisted(roleM),
        };
      }
      state.game = (persisted(gameM) /*: GameBoard */);

      installRoutes();
    }

    function installRoutes() {
      console.log(state.game.label(), 'adding authorize route:', state.path, state.opts.callbackPath);
      const provName = state.privilege.provider;
      const provider = providers[provName];
      if (!provider) {
        throw new Error(`unknown provider: ${provName}`);
      }

      const opts = state.opts;
      opts.callbackURL = new URL(opts.callbackPath, baseURL).toString();

      passport.use(provider.makeMiddleware(opts));
      // console.log('DEBUG: opts:', opts);

      app.get(state.path, passport.authenticate(provName));
      setSignIn(state.path);

      const fail /*: express$Middleware*/ = passport.authenticate(provName, { failureRedirect: '/auth-failure-@@' });
      const OK = (req, res /*: express$Response*/) => {
        console.log('successful auth:', req.user);
        const session = state.game.sessionFor(req.user);
        const sessionAddr = sturdyPath(session);
        res.redirect(sessionAddr);
      };
      app.get(opts.callbackPath, fail, OK);
    }
  }

  function githubVerify(accessToken /*: Token*/, refreshToken /*: Token*/, profile /*: GithubAccount */,
                        done /*: (mixed, mixed) => void*/) {
    console.log('githubVerify:', { profile });
    done(null, {
      username: profile.username,
      displayName: profile.displayName,
    });
  }


  function discordVerify(accessToken /*: Token*/, refreshToken /*: Token*/, profile /*: DiscordUser */,
                         done /*: (mixed, mixed) => void*/) {
    console.log('verify:', { accessToken, refreshToken, profile });
    // ISSUE: TODO: use DiscordAPI to check for role
    done(null, {
      id: profile.id,
      username: profile.username,
      displayName: `${profile.username}#${profile.discriminator}`,
      avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.avatar}/${profile.id}.png` : null
    });
  }
}


function DiscordAPI(get, token) {
  const host = 'discordapp.com';
  const v = 6;
  const headers = { Authorization: `Bot ${token}` };

  return def({
    guilds(guildID) {
      return def({
        members(userID) {
          const path = `/api/v${v}/guilds/${guildID}/members/${userID}`;
          // console.log('guilds members', { host, path, headers });

          return new Promise((resolve, reject) => {
            const req = get({ host, path, headers }, (res) => {
              const chunks = [];
              // console.log({ status: res.statusCode,
              //               headers: res.headers });
              res.on('data', (data) => {
                chunks.push(data)
              }).on('end', () => {
                const data = JSON.parse(Buffer.concat(chunks).toString());
                // console.log('end', data);
                resolve(data);
              });
            });
            req.on('error', (err) => {
              // console.log('error:', err);
              reject(err);
            });
          });
        }
      });
    },
  });
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
  const get = require('https').get;
  const env = process.env;
  DiscordAPI(get, env.TOKEN || '').guilds(env.GUILD_ID || '').members(env.USER_ID || '')
    .then((member) => {
      console.log({ member });
    })
    .catch((oops) => {
      console.log(oops);
    });

  if (0) {
  trustCertTest(
    process.argv,
    {
      grpc: require('grpc'),
      clock: () => new Date(),
      randomBytes: require('crypto').randomBytes,
    },
  );
  }
}
