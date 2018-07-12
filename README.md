See https://github.com/rchain/Members/issues/260

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
    gh_client_id: ...
    gh_client_secret: ...
    github_repo_token: ...
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

[xataface]: http://www.xataface.com/
[ansible]: https://docs.ansible.com/ansible/latest/index.html

  
## TODO

  - import persons, issues from github repo
    - sync/update
  - [dashboard](http://xataface.com/wiki/Creating_a_Dashboard)

### Beyond PHP

Please excuse the use of PHP; [Rholang][] isn't here yet. :-)

[Rholang]: https://developer.rchain.coop/


