#!/bin/bash
# Start the portable MySQL dev database (workspace-local, no admin rights needed).
# The server lives in ../tools relative to the repo root.
set -e
TASK_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MYSQL="$TASK_ROOT/tools/mysql-8.4.5-winx64"
DATADIR="$TASK_ROOT/tools/mysql-data"
if ! "$MYSQL/bin/mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "select 1" >/dev/null 2>&1; then
  "$MYSQL/bin/mysqld.exe" --datadir="$(cygpath -w "$DATADIR")" --bind-address=127.0.0.1 --port=3306 --mysqlx=OFF &
  for i in $(seq 1 30); do
    "$MYSQL/bin/mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "select 1" >/dev/null 2>&1 && break
    sleep 1
  done
fi
"$MYSQL/bin/mysql.exe" -h 127.0.0.1 -P 3306 -u root -e "create database if not exists worldline"
echo "Dev database ready at mysql://root@127.0.0.1:3306/worldline"
