# Design and development of rchain-dbr

Please excuse the use of PHP; I try to use alternatives below for new
development.


## CRUD powered by xataface, LAMP

Most of the web CRUD UI is built with [xataface][], which lets us
create some SQL tables and write:

```
[tables]
github_users=Users
issue=Issue
...
```

and voila, xataface makes a full CRUD application, with searching and
sorting. For this (and because I have years of experience using it in
[hh-office][]), I am willing to hold my nose and use PHP.

Customizing field widgets, relationships, permissions, and templates
is a little extra work, but it's all quite straightforward.

[xataface]: http://www.xataface.com/
[hh-office]: https://bitbucket.org/DanC/hh-office


## Sync powered by python, sqlalchemy, and pandas

Some auxiliary functions such as sync with github and computing the
trust metric are written in python with sqlalchemy and pandas.
See `social_coding_sync.py`.

[Rholang]: https://developer.rchain.coop/


## Porting the trust metric to Rholang with node.js and Capper

To put certifications such as "I (dckc) certify Bob at journeyer
level" on RChain, `package.json` and `server.js` and such are the
start of a node.js/Express web UI that integrates with RChain nodes
via the [CasperMessage.proto][] gRPC protocol.

As in the PHP code, we use OAuth2 to authenticate discord and github
users and we (aim to) use the **member** discord role to verify RChain coop
membership.

Then we (aim to) represent votes as rholang terms such as `["dckc",
"bob", 2, "deadbeef"]` where 2 is journeyer level and "deadbeef" is a
signature using a key held by this gateway. An on-chain rholang contract
can check such signatures, much like [BasicWallet.rho][bw] as
seen in the [Genesis Block Demo][gbd] of July 11.

To extend persistence and object capability security to off-chain
secrets and configuration, `server.js` is built using [Capper][],
which supports ocap discipline and object persistence in
node.js/Express applications with [webkeys][].

[cp]: https://github.com/rchain/rchain/blob/dev/models/src/main/protobuf/CasperMessage.proto
[bw]: https://github.com/rchain/rchain/blob/dev/casper/src/main/rholang/BasicWallet.rho
[gbd]: https://www.youtube.com/watch?v=WzAdfjwgaQs#t=9m28s
[Capper]: https://github.com/dckc/Capper
[webkeys]: http://waterken.sourceforge.net/web-key/
