# RChain Distribute Budgeting and Rewards (rchain-dbr)

The [RChain Cooperative](https://rchain.coop) is developing a
decentralized, economically sustainable public compute infrastructure.
As part of its efforts toward coordination at scale, it runs a [bounty
program][rb] with distributed budgeting and rewards. This `rchain-dbr`
code powers the web site where budgets and rewards are decided.

[rb]: https://github.com/rchain/bounties

copyright (c) 2018 by by [Dan Connolly
(dckc)](http://www.madmode.com/) and collaborators.

license: GPL 2 (inherited from xataface)

## Features and use cases

See [Usable Web app prototype for RAM distributed budgeting and reward
system #260](https://github.com/rchain/bounties/issues/260)


## Design notes: toward node.js and RChain from LAMP

see CONTRIBUTING.md


## Installation and Configuration

see INSTALL.md


## Contents

_ISSUE: top directory is over-crowded; push db schema etc. to subdirs?_

 - `dbr_tables.sql` - core database schema: budget votes, reward votes, etc.
   - `dbr_triggers.sql` - extra constraints
   - `dbr_views.sql` - business logic
   - `example_data.sql`  (ISSUE: out of date?)
 - `index.php` - CRUD web UI (xataface app)
   - `conf.ini.example`, `conf/ApplicationDelegate.php`
   - `tables/` - per-table, field tweaks
   - `actions.ini` - discord verification etc.
   - `xataface_template/modules/Auth/XDB/XDB.php` - OAuth integration
     - `github_auth_callback.php`, `lib/`
     - `composer.json` - OAuth libraries
       - `composer_download.php`, `composer.lock`
   - `rchain-style.css`, `templates/Dataface_Fineprint.html` - logo, fine print
   - `Web.config` - tell ASP.net to hide Xataface config files
 - `social_coding_sync.py` - sync, trust metric
   - `requirements.txt` - sqlalchemy, pandas, ...
   - `net_flow.py` - max flow for trust metric
   - `issues.graphql`, `collaborators.graphql`, `reactions.graphql` - github queries
   - `my_work.graphql`, `my_work.html`
   - `trust_net_viz.html`, `net_viz.js`
   - `dbr_norm1.py` - normalize budget, reward spreadsheets
      - `dbr_norm.py` - _ISSUE: dead code?_
   - `dbr_aux.service`, `dbr_aux.ini`, `wsgi.py` - systemd unit, uwgi config
 - `server.js` - node.js Express app
   - `package.json` - passport-discord, gRPC, etc.
   - `capper_start.js` - (should be moved into Capper)
   - `gateway/` - Capper app: server, UI for OAuth, rnode gRPC
 - `playbook.yml` - toward automated deployment with ansible
   - `deploy_tasks/`
   - `inventory.yml`
   - `sites-available/rchain-rewards` - nginx config
