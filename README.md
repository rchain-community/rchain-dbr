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


## Design notes: powered by xataface, PHP, python, and mysql

Please excuse the use of PHP; [Rholang][] isn't here yet. :-)

[xataface][] lets us create some SQL tables and write:

```
[tables]
github_users=Users
issue=Issue
...
```

and voila, xataface makes a full CRUD application. Customizing field
widgets, relationships, permissions, and templates is a little extra
work, but it's all quite straightforward. For this (and because I have
years of experience using it in hh-office), I am willing to hold my
nose and use PHP.

Some auxiliary functions such as sync with github and computing the
trust metric are written in python with sqlalchemy and pandas.

[Rholang]: https://developer.rchain.coop/
[xataface]: http://www.xataface.com/


## Installation and Configuration

At a high level:

  1. Create OAuth apps in github, discord.
  2. Initialize a mysql database from `dbr_tables.sql` etc.
  3. Install software dependencies.
  4. Fill in `conf.ini` from `conf.ini.example`.

Detailed, executable instructions are in `playbook.yml` following
[ansible][] conventions. Use `ansible-playbook -i inventory.yml playbook.yml`
once you have `inventory.yml` set up appropriately:

```
all:
  hosts:
    # Where to install?
    SSH_HOST
  vars:
    # ISSUE: managing privileges is still very rough
    ansible_user: SSH_USER
    ansible_ssh_pass: ...

    # deploy_tasks/nginx_site.yaml sets up nginx
    # and connects it to PHP using fastcgi
    # and python using uwsgi (go figure).
    htdocs: /var/www/html
    url_path: ""

    # ISSUE: very picky dependendcy on mysql-server-5.7
    # fails with mariadb and mysql-8.x
    db_host: localhost
    db_name: xataface
    db_user: xataface
    db_password: ...

    # Github token for fetching issues, uses
    github_repo_token: ...

    # Github authentication shared secret
    # TODO: document setup
    gh_client_id: ...
    gh_client_secret: ...

    # Discord authentication, authorization
    # TODO: document setup
    discord_coop_role: member
    discord_redirect_uri: https://{{ domain }}/index.php?discord_oauth_callback=true"
    rchain_guild_id: ...
    discord_client_id: ...
    discord_client_secret: ...
    discord_bot_token: ...
```

You may need to set other ansible vars such as
`ansible_python_interpreter: /usr/local/bin/python2`.

### Github authentication

The `gh_client_id` and `gh_client_secret` come from [registering your
github
app](https://developer.github.com/v3/guides/basics-of-authentication/#registering-your-app).

The callback URL should correspond to `github_auth_callback.php`;
e.g. `https://rewards.rchain.coop/github_auth_callback.php` or
e.g. `https://rewards-test.rhobot.net/github_auth_callback.php`.


### nginx, python, and systemd sockets

As shown in `dbr_aux.service` and `deploy_tasks/nginx_site.yml`, the
python code runs as a systemd service called `dbr_aux`; `nginx`
connects to it via a socket: `/tmp/dbr_aux.sock`. _ISSUE: how is the
socket supposed to get created?_

[ansible]: https://docs.ansible.com/ansible/latest/index.html
