## Configure binary logging for xataface in mysql

Symptoms: `ER_NO_BINARY_LOGGING: You are not using binary logging`

Solution: put `rchain_binlog.cnf` in `/etc/mysql/mysql.conf.d` on the
mysql server host and `service restart mysql`.


## Create an account authorized to get replication logs

Log in to the mysql server as the administrative user and ...

```
mysql> create user 'U1'@'localhost' identified by '...';
Query OK, 0 rows affected (0.02 sec)

mysql> GRANT REPLICATION SLAVE, REPLICATION CLIENT, SELECT ON *.* TO 'U1'@'localhost';
Query OK, 0 rows affected (0.00 sec)
```
