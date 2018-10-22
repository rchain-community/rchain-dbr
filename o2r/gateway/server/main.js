/** gateway -- RChain / OAuth gateway Capper persistent objects

    BUG: clients don't revive when the server restarts.

    ISSUE: sessions?
    refresh = require('passport-oauth2-refresh')
    app.use(passport.session());

    ISSUE: indirect to SecretService for CLIENT_SECRET?
*/
/* global require, module, exports, Buffer */
// @flow strict
const URL = require('url').URL;

const discord = require('passport-discord');
const github = require('passport-github');

const rnodeAPI = require('../../lib/rchain-api/rnodeAPI');
const { once, persisted } = require('../../capper_start');
const keyPair = require('./keyPair');
const { rhol } = rnodeAPI.RHOCore;

const def = Object.freeze; // cf. ocap design note

/*::
import type { get } from 'http';
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
   get: get,
   passport : passportT,
   baseURL : string,
   setSignIn: (string) => void,
   sturdyPath: (mixed) => string,
}

type OAuthOpts = {
  callbackPath: string,
  callbackURL?: string,
  clientID: string,
  clientSecret: Token,
};

interface ProviderState<P> {
  path: string,
  opts: OAuthOpts,
  privilege: P,
  game: GameBoard,
};

interface ProviderImpl<P> {
  privilege(locusM: mixed, tokenM: mixed, roleM: mixed): P,
  strategy(opts: OAuthOpts): express$Middleware,
  authenticate(opts: OAuthOpts): express$Middleware,
  fail(opts: OAuthOpts): express$Middleware,
}

type DiscordRole = {
  botToken: Token,
  guildID: string,
  roleID: string,
};

type GithubRole = {
  repoToken: Token,
  repository: string,
  role: 'WRITE' | 'ADMIN',
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
function appFactory({ app, get, passport, baseURL, setSignIn, sturdyPath } /*: Powers*/) {
  // ISSUE: reduce scope of app, get?
  app.use(passport.initialize());
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  return def({ githubProvider, discordProvider });

  function githubProvider(context /*: Context<ProviderState<GithubRole>> */) /*: OAuthClientP */ {
    function verify(accessToken /*: Token*/, refreshToken /*: Token*/, profile /*: GithubAccount */,
                    done /*: (mixed, mixed) => void*/) {
      console.log('githubVerify:', { profile });
      done(null, {
        username: profile.username,
        displayName: profile.displayName,
      });
    }

    return provider(context, {
      privilege: (locusM, tokenM, roleM) => ({
        provider: 'github',
        repository: persisted(locusM),
        repoToken: persisted(tokenM),
        role: persisted(roleM),
      }),
      strategy: (opts) => new github.Strategy(opts, verify),
      authenticate: _ => passport.authenticate('github'),
      fail: _ => passport.authenticate('github', { failureRedirect: '/auth-failure-@@' }),
    });
  }

  function discordProvider(context /*: Context<ProviderState<DiscordRole>> */) /*: OAuthClientP */ {
    // ISSUE: state parameter
    // https://discordapp.com/developers/docs/topics/oauth2#state-and-security
    // ISSUE: TODO: refreshToken
    function verify(_accessToken /*: Token*/, _refreshToken /*: Token*/, profile /*: DiscordUser */,
                    done /*: (mixed, mixed) => void*/) {
      console.log('verify:', { profile });
      const privilege = context.state.privilege;

      const guild = DiscordAPI(get, privilege.botToken).guilds(privilege.guildID);
      Promise.all([
        guild.info(),
        guild.members(profile.id),
      ])
        .then(([guild, member]) => {
          console.log('verify:', { profile, member });
          if (member.roles.includes(privilege.roleID)) {
            const role0 = guild.roles.filter(r => r.id === privilege.roleID)[0];
            const who = {
              id: profile.id,
              username: profile.username,
              displayName: `${profile.username}#${profile.discriminator}`,
              avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.avatar}/${profile.id}.png` : null,
              detail: {
                created_at: member.joined_at,
                roles: member.roles,
                role0: role0,
                guild: guild,
              }
            };
            console.log('authorized:', who);
            done(null, who);
          } else {
            console.error('role', privilege.roleID, ' not in ', member.roles);
            done(new Error('not authorized'));
          }
        })
        .catch((oops) => {
          console.error('failed to get roles:', oops);
          done(oops);
        });
    }

    return provider(context, {
      privilege: (locusM, tokenM, roleM) => ({
        provider: 'discord',
        botToken: persisted(tokenM),
        guildID: persisted(locusM),
        roleID: persisted(roleM),
      }),
      strategy: opts => new discord.Strategy({ scope: ['identify'], ...opts}, verify),
      authenticate: _ => passport.authenticate('discord'),
      fail: _ => passport.authenticate('discord', { failureRedirect: '/auth-failure-@@' }),
    });
  }

  function provider/*:: <P>*/(context /*: Context<ProviderState<P>> */, impl /*: ProviderImpl<P>*/) /*: OAuthClientP */ {
    const state = context.state;
    if ('path' in context.state) {
      installRoutes();
    }

    return def({
      init,
      path: () => state.path,
      clientId: () => state.opts.clientID,
    });

    function init(pathM, callbackPathM,
                  locusM, roleM, tokenM,
                  idM, secretM,
                  gameM) {
      once(state);

      console.log('provider init:', { pathM, callbackPathM, locusM, roleM, tokenM, idM, secretM, gameM });
      state.path = persisted(pathM);
      state.opts = {
        callbackPath: persisted(callbackPathM),
        clientID: persisted(idM),
        clientSecret: persisted(secretM),
      };
      state.privilege = impl.privilege(persisted(locusM), persisted(tokenM), persisted(roleM));
      state.game = (persisted(gameM) /*: GameBoard */);

      installRoutes();
    }

    function installRoutes() {
      console.log(state.game.label(), 'adding authorize route:', state.path, state.opts.callbackPath);

      const opts = state.opts;
      opts.callbackURL = new URL(opts.callbackPath, baseURL).toString();

      passport.use(impl.strategy(opts));
      // console.log('DEBUG: opts:', opts);

      app.get(state.path, impl.authenticate(opts));
      setSignIn(state.path);

      const OK = (req, res /*: express$Response*/) => {
        console.log('successful auth:', req.user);
        const session = state.game.sessionFor(req.user);
        const sessionAddr = sturdyPath(session);
        res.redirect(sessionAddr);
      };
      app.get(opts.callbackPath, impl.fail(opts), OK);
    }
  }
}


function DiscordAPI(get, token) {
  const host = 'discordapp.com';
  const api = '/api/v6';
  const headers = { Authorization: `Bot ${token}` };

  function getJSON(path) {
    console.log('calling Discord API', { host, path, headers });
    return new Promise((resolve, reject) => {
      const req = get({ host, path, headers }, (res) => {
        const chunks = [];
        // console.log({ status: res.statusCode,
        //               headers: res.headers });
        res.on('data', (data) => {
          chunks.push(data);
        }).on('end', () => {
          const body = Buffer.concat(chunks).toString();
          const data = JSON.parse(body);
          console.log('Discord done:', Object.keys(data));
          resolve(data);
        });
      });
      req.on('error', (err) => {
        console.error('Discord API error:', err);
        reject(err);
      });
    });
  }

  return def({
    guilds(guildID) {
      return def({
        info() {
          return getJSON(`${api}/guilds/${guildID}`);
        },
        members(userID) {
          return getJSON(`${api}/guilds/${guildID}/members/${userID}`);
        },
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
    rhol`@"certify"!(${cert1}, ${certSigHex})`,
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
  /* global process */
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
