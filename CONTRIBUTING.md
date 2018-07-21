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
