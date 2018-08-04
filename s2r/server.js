const docopt = require('docopt').docopt;
const MySQLEvents = require('@rodrigogs/mysql-events');

const usage = `
Replicate MySql events in RChain

Usage:
  server.js [options]

Options:
 --host HOST     mysql connection host [default: 127.0.0.1]
 --port PORT     mysql connection port [default: 3506]
 --user USER     mysql connection user [default: rchain_binlog]
 --passkey VAR   environment variable for mysql password
                 [default: RCHAIN_BINLOG_PASSWORD]
 --help          show usage help
`;

function main(argv, env, { createConnection }) {
    const cli = docopt(usage, { argv: argv.slice(2) });
    program(createConnection({
	host: cli['--host'], port: parseInt(cli['--port']),
	user: cli['--user'], password: env[cli['--passkey']] }))
	.then(() => console.log('Waiting for database events...'))
	.catch(console.error);
}

const program = async (connection) => {
  const instance = new MySQLEvents(connection, {
    startAtEnd: true,
    excludedSchemas: {
      mysql: true,
    },
  });

  await instance.start();

  instance.addTrigger({
    name: 'TEST',
    expression: '*',
    statement: MySQLEvents.STATEMENTS.ALL,
    onEvent: (event) => { // You will receive the events here
      console.log(event);
    },
  });

  instance.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error);
  instance.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);
};


if (require.main == module) {
    // Import primitive effects only when invoked as main module.
    //
    // TODO: document Object capability discipline in CONTRIBUTING.md.
    main(process.argv, process.env,
         {
	     createConnection: require('mysql').createConnection
	 });
}
