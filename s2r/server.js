const mysql = require('mysql');
const MySQLEvents = require('@rodrigogs/mysql-events');

const program = async () => {
  const connection = mysql.createConnection({
      host: '127.0.0.1', port: 3506,
      user: process.env.DBR_BINLOG_USERNAME,
      password: process.env.DBR_BINLOG_PASSWORD,
  });

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

program()
  .then(() => console.log('Waiting for database events...'))
    .catch(console.error);
