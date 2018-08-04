# s2r -- Replicate SQL updates to RChain

**Work in Progress**. So far, it just subscribes to mysql events.


## Usage

As is traditional, start with:

```
npm install
```

Once you have user authorized as a replication client (see
INSTALL.md), provide its credentials in the environment and start the
service; then watch it log changes to database tables:

```
DBR_BINLOG_USERNAME=U1 DBR_BINLOG_PASSWORD=... node server.js 
Waiting for database events...
...
{ type: 'INSERT',
  schema: 'xataface',
  table: 'budget_vote',
  affectedRows: [ { after: [Object], before: undefined } ],
  affectedColumns: 
   [ 'pay_period',
     'issue_num',
     'voter',
     'amount',
     'vote_time',
     'weight' ],
  timestamp: 1533407169000,
  nextPosition: 2463,
  binlogName: 'mysql-bin.000001' }
```


## Mysql Binary Logging Configuration


See `INSTALL.md`.
