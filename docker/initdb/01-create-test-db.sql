-- Runs automatically on the FIRST Postgres container start against an
-- empty data volume only (official postgres image /docker-entrypoint-initdb.d
-- behavior). If this database is ever missing, `docker compose down -v`
-- (drops the volume) then `docker compose up -d` re-triggers this script.
CREATE DATABASE customer_distance_test;
