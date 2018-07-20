/** server -- OAuth / RChain gateway server

goals:
https://medium.com/@orels1/using-discord-oauth2-a-simple-guide-and-an-example-nodejs-app-71a9e032770
https://grpc.io/docs/tutorials/basic/node.html

@flow
*/

const Capper = require('Capper');
const docopt = require('docopt').docopt;

const capper_start = require('./capper_start');
const gateway = require('./gateway/server/main');

// ISSUE: indirect to SecretService for CLIENT_SECRET?

const usage = `
Usage:
  server.js [options] make REVIVER [ARG...]
  server.js [options] post WEBKEY METHOD [ARG...]
  server.js [options] drop WEBKEY
  server.js [options]

Options:
 REVIVER                app reviver; e.g.
                        gateway.client ID SECRET
 --db FILE              persistent object storage
                        [default: capper.db]
 --conf FILE            config file [default: capper.config]
 --ssl DIR              SSL server.crt server.key dir
                        [default: ./ssl]
 -h --help              show usage

`;

function main(argv, {fs, path, crypto, https, express}) {
    const unique = Capper.caplib.makeUnique(crypto.randomBytes);

    const cli = docopt(usage, { argv: argv.slice(2) });
    // console.log('DEBUG: cli:', cli);

    const dbfile = Capper.fsSyncAccess(fs, path.join, cli['--db']);
    const rd = arg => Capper.fsReadAccess(fs, path.join, cli[arg]);

    Capper.makeConfig(rd('--conf')).then(config => {
	const gw = gateway.makeGateway(app, passport, config.domain);
	const apps = Object.freeze({ gateway: gw });
	const reviver = capper_start.makeReviver(apps);
	const saver = Capper.makeSaver(unique, dbfile, reviver.toMaker);

        if (capper_start.command(cli, config, saver)) {
            return;
        } else {
	    Capper.run(argv, config, reviver, saver,
		       rd('--ssl'), https.createServer, express);
	    console.log('server started...');
	}
    });
}


if (require.main == module) {
    // Access ambient stuff only when invoked as main module.
    main(process.argv,
         {
	     fs: require('fs'),
	     path: require('path'),
	     crypto: require('crypto'),
             https: require('https'),
             express: require('express'),
	 });
}
