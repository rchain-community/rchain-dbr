/** server -- RChain / OAuth gateway

See also: CONTRIBUTING.md design notes on Capper and webkeys
as well as ocap discipline.

ISSUE: add @flow static types
*/

const Capper = require('Capper');
const docopt = require('docopt').docopt;

const capper_start = require('./capper_start');
const gateway = require('./gateway/server/main');

const usage = `
Start with "make gateway.gateway" to generate (and save) your initial
webkey, and a key pair for use on RChain.

Then visit that webkey URL in your browser to configure the rest.

Usage:
  server.js [options] make REVIVER [ARG...]
  server.js [options] post WEBKEY METHOD [ARG...]
  server.js [options] drop WEBKEY
  server.js [options]

Options:
 REVIVER                app reviver; e.g. gateway.gateway
 --conf FILE            specification of protocol (http / https), domain, and
                        port of this service, in JSON.
                        [default: capper.config]
 --ssl DIR              where to find SSL server.key, server.crt, ca.crt
                        if protocol is https
                        [default: ./ssl]
 --db FILE              persistent object storage
                        [default: capper.db]
 -h --help              show usage

ISSUE: add option to list all REVIVERs?
ISSUE: help on each REVIVER?
`;

function main(argv, {fs, path, crypto, https, express, passport}) {
    const unique = Capper.caplib.makeUnique(crypto.randomBytes);

    const cli = docopt(usage, { argv: argv.slice(2) });
    // console.log('DEBUG: cli:', cli);

    const dbfile = Capper.fsSyncAccess(fs, path.join, cli['--db']);
    const rd = arg => Capper.fsReadAccess(fs, path.join, cli[arg]);

    Capper.makeConfig(rd('--conf')).then(config => {
	const app = express(),
	      expressWrap = () => app;
	const apps = Object.freeze({
		  gateway: gateway.makeGateway(app, passport, config.domain),
	      }),
	      reviver = capper_start.makeReviver(apps),
	      saver = Capper.makeSaver(unique, dbfile, reviver.toMaker);

        if (capper_start.command(cli, config, saver)) {
            return;
        } else {
	    Capper.run(argv, config, reviver, saver,
		       rd('--ssl'), https.createServer, expressWrap);
	    console.log('server started...');
	}
    });
}


if (require.main == module) {
    // Import primitive effects only when invoked as main module.
    //
    // See Object capability discipline design note in
    // CONTRIBUTING.md.
    main(process.argv,
         {
	     // Opening a file based on filename is a primitive effect.
	     fs: require('fs'),
	     // path.join is platform-specific and hence a primitive effect.
	     path: require('path'),
	     // Random number generation is primitive (typically implemented
	     // as access to a special file, /dev/urandom).
	     crypto: require('crypto'),
	     // If node's https module followed ocap discipline, it would
	     // have us pass in capabilities to make TCP connections.
	     // But it doesn't, so we treat it as primitive.
             https: require('https'),
	     // If express followed ocap discipine, we would pass it
	     // access to files and the network and such.
             express: require('express'),
	     // The top-level passport strategy registry seems to be
	     // global mutable state.
	     // ISSUE: use passport constructors to avoid global mutable state?
             passport: require('passport'),
	 });
}
