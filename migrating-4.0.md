## Migrating from Webrecorder 3.x to Webrecorder 4.x

The Webrecorder 4.x release introduced signficant changes to the data model.

A migration script is provided which will migrate a local Webrecorder 3.x installation to 4.x.

(The version of Webrecorder can be found in the [webrecorder package init](webrecorder/webrecorder/__init__.py))

The migration can be performed as follows:

1) Stop old Webrecorder 3.x

2) Pull the latest Webrecorder 4.x from github (this branch)

3) Update `REDIS_BASE_URL` in `wr.env` to redis://redis/2 to use a blank new Redis DB

4) Recreate Webrecorder containers via `./rebuild.sh`, which will remove old containers, build new ones.

5) Run `docker exec -it webrecorder_app_1 python ./migration_scripts/migrate4.0.py --new-redis=redis://redis/2`

This process will create a copy of the Redis data in Redis DB 2. To use a different Redis DB or a remote Redis, specify
a different `redis://` url.

The old data will not be deleted automatically. The existing Redis DB (usually DB 1) will still be in place, and existing WARCs 
under `./data/warcs` will not be deleted. All the WARC data will be copied to `./data/storage` and organized by collections to match
the new data model and directory layout.

For more migration options, including migrating data on S3, you can run:

`docker exec -it webrecorder_app_1 python ./migration_scripts/migrate4.0.py -h`

Please open an issue or contact us for additional questions about migration.
