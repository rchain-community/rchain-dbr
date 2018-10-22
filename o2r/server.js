/** server -- RChain / OAuth gateway

    See also: CONTRIBUTING.md design notes on Capper and webkeys
    as well as ocap discipline.
*/
/* global require, module */
// @flow strict

// $FlowFixMe ISSUE: flow strict in capper
const Capper = require('Capper');
const docopt = require('docopt').docopt;

const rnodeAPI = require('./lib/rchain-api/rnodeAPI');
const capperStart = require('./capper_start');
const gateway = require('./gateway/server/main');
const keyPair = require('./gateway/server/keyPair');
const gameSession = require('./gateway/server/gameSession');

const usage = `
Start with "make game.gameBoard MyGame" to generate (and save) your initial
webkey, whose state includes a key pair for use on RChain.

Then visit that webkey URL in your browser to configure the rest.

On subsequent starts, you can use \`--sign-in ID\` to revive the path
handler for one OAuth2 client.

Usage:
  server.js [options] list
  server.js [options] make REVIVER [ARG...]
  server.js [options] post WEBKEY METHOD [ARG...]
  server.js [options] drop WEBKEY
  server.js [options]

Options:
 REVIVER                app reviver; e.g. gateway.gateway
 --conf FILE            specification of protocol (http / https), domain, and
                        port of this service, in JSON.
                        [default: capper.config]
 --sign-in ID           db ID of OAuth client to revive on start-up to provide
                        sign-in route path.
 --base URL             base URL of this service as seen from OAuth peers
                        [default: https://springboard.rhobot.net/]
 --ssl DIR              where to find SSL server.key, server.crt, ca.crt
                        if protocol is https
                        [default: ./ssl]
 --db FILE              persistent object storage
                        [default: capper.db]
 --grpc-host NAME       Where to contact rnode gRPC service [default: localhost]
 --grpc-port NUM        Where to contact rnode gRPC service [default: 40401]
 -h --help              show usage

ISSUE: add option to list all REVIVERs?
  ISSUE: help on each REVIVER?
  `;

const def = obj => Object.freeze(obj);


function main(argv, { fs, join, clock, randomBytes, http, https, express, passport, grpc }) {
  const unique = Capper.caplib.makeUnique(randomBytes);

  const cli = docopt(usage, { argv: argv.slice(2) });
  // console.log('DEBUG: cli:', cli);

  const dbfile = Capper.fsSyncAccess(fs, join, cli['--db']);
  const rd = arg => Capper.fsReadAccess(fs, join, cli[arg]);
  const rchain = rnodeAPI.RNode(grpc, {
    host: cli['--grpc-host'],
    port: parseInt(cli['--grpc-port'], 10),
  });

  Capper.makeConfig(rd('--conf')).then((config) => {
    let signIn; // ISSUE: how to link to the oauthClient at start-up?

    const app = express();
    const expressWrap = () => app;
    const apps = def({
      gateway: gateway.appFactory({
        app, passport, setSignIn, sturdyPath,
        get: https.get,
        baseURL: cli['--base'],
      }),
      keyChain: keyPair.appFactory({ randomBytes: randomBytes }),
      game: gameSession.appFactory('game', { clock, rchain }),
    });

    const reviver0 = capperStart.makeReviver(apps);
    const saver = Capper.makeSaver(unique, dbfile, reviver0.toMaker);
    const sturdy = Capper.makeSturdy(saver, config.domain);

    if (cli.list) {
      Object.keys(apps).forEach((reviver) => {
        console.log(`app: ${reviver}`);
        Object.keys(apps[reviver]).forEach((method) => {
          console.log(`app reviver: ${reviver}.${method}`);
          // $FlowFixMe
          const maker = apps[reviver][method];

          if ('usage' in maker) {
            // $FlowFixMe
            console.log('args: ', maker.usage);
          }
        });
      });
      return;
    }

    if (!capperStart.command(cli, config, saver, sturdy)) {
      // reserve the homepage before Capper does
      app.get('/', home);

      // revive sign-in page
      const clientID = cli['--sign-in'];
      if (clientID) {
        console.log('reviving sign-in client:', clientID);
        saver.live(saver.credToId(clientID));
      }

      if (config.domain.split(':')[0] === 'http') {
        console.log('WARNING! no SSL');
        Capper.runNaked(config, reviver0, saver,
                        http.createServer, expressWrap);
      } else {
        Capper.run(argv, config, reviver0, saver,
                   rd('--ssl'), https.createServer, expressWrap);
      }

      console.log('server started...');
    }

    // ISSUE: how to link to the oauthClient at start-up?
    function setSignIn(it) {
      signIn = it;
    }

    function home(req, res) {
      res.set('Content-Type', 'text/html');
      if (signIn) {
        res.send(`<a href="${signIn}">Sign In</a>`);
      } else {
        res.send('<em>Stand by...</em>');
      }
    }

    /**
     * Get webKey but with `?` rather than `#` for server-to-server communication.
     */
    function sturdyPath(obj) {
      const webKey = sturdy.idToWebkey(saver.asId(obj));
      const unhash = webKey.substring(config.domain.length).replace('#', '?');
      return `/${unhash}`;
    }
  }).done();
}


if (require.main === module) {
  // Import primitive effects only when invoked as main module.
  //
  // See Object capability discipline design note in
  // CONTRIBUTING.md.
  /* eslint-disable global-require */
  /* global process */
  main(process.argv,
       {
         // Opening a file based on filename is a primitive effect.
         fs: require('fs'),
         // path.join is platform-specific and hence a primitive effect.
         join: require('path').join,
         // Random number generation is primitive (typically implemented
         // as access to a special file, /dev/urandom).
         randomBytes: require('crypto').randomBytes,
         // Access to the clock is primitive.
         clock: () => new Date(),
         // If node's http module followed ocap discipline, it would
         // have us pass in capabilities to make TCP connections.
         // But it doesn't, so we treat it as primitive.
         http: require('http'),
         https: require('https'),
         // If express followed ocap discipine, we would pass it
         // access to files and the network and such.
         express: require('express'),
         // grpc is much like express
         grpc: require('grpc'),
         // The top-level passport strategy registry seems to be
         // global mutable state.
         // ISSUE: use passport constructors to avoid global mutable state?
         passport: require('passport'),
       });
}
