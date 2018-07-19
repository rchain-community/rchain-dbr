const Capper = require('Capper');
const docopt = require('docopt').docopt;
const capper_start = require('./capper_start');

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

    const apps = Object.freeze({ gateway: { client: gateway_client } });
    const reviver = capper_start.makeReviver(apps);

    const dbfile = Capper.fsSyncAccess(fs, path.join, cli['--db']);
    const saver = Capper.makeSaver(unique, dbfile, reviver.toMaker);

    const rd = arg => Capper.fsReadAccess(fs, path.join, cli[arg]);

    Capper.makeConfig(rd('--conf')).then(config => {
        if (capper_start.command(cli, config, saver)) {
            return;
        } else {
	    Capper.run(argv, config, reviver, saver,
		       rd('--ssl'), https.createServer, express);
	    console.log('server started...');
	}
    });
}


function gateway_client(context) {
    const mem = context.state;
    function init(id, secret) {
	mem['id'] = id;
	mem['secret'] = secret;
    }

    return Object.freeze({ init });
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
