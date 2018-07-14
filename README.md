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


## Design notes: powered by xataface, PHP, and mysql

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

[Rholang]: https://developer.rchain.coop/
[xataface]: http://www.xataface.com/


## Installation and Configuration

At a high level:

  1. Create OAuth apps in github, discord.
  2. Initialize a mysql database from `dbr_tables.sql` etc.
  3. Install software dependencies.
  4. Fill in `conf.ini` from `conf.ini.template`.

Detailed, executable instructions are in `playbook.yml` following
[ansible][] conventions. Use `ansible-playbook -i inventory.yml playbook.yml`
once you have `inventory.yml` set up appropriately:

```
all:
  hosts:
    SSH_HOST
  vars:
    ansible_user: SSH_USER
    ansible_ssh_pass: ...

    htdocs: /var/www/html
    url_path: ""

    db_host: localhost
    db_name: xataface
    db_user: xataface
    db_password: ...

    github_repo_token: ...

    gh_client_id: ...
    gh_client_secret: ...

    discord_coop_role: member
    discord_redirect_uri: FIXME
    rchain_guild_id: ...
    discord_client_id: ...
    discord_client_secret: ...
    discord_bot_token: ...
```

You may need to set other ansible vars such as
`ansible_python_interpreter: /usr/local/bin/python2`.

When creating your github OAuth app, the callback URL should
correspond to `github_auth_callback.php`.

[ansible]: https://docs.ansible.com/ansible/latest/index.html
