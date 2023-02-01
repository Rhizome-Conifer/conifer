from webrecorder.models.usermanager import CLIUserManager

um = CLIUserManager()

effected_users = []

for u, data in um.all_users.items():
    if data['role'] in ['admin', 'beta-archivist', 'supporter']:
        effected_users.append(u)


for u in effected_users:
    colls = um.all_users[u].get_collections()
    for coll in colls:
        recs = um.redis.smembers(f'c:{coll.my_id}:recs')
        orphans = []
        for r in recs:
            if not um.redis.exists(f'r:{r}:info'):
                orphans.append(r)

        if orphans:
            o = ', '.join(orphans)
            print(f'removed {len(orphans)} orphan recordings from {u}/{coll.name} ({o})')

            i = input('remove orphan recordings? y/n ')

            if i == 'y':
                # remove orphan recordings
                for r in orphans:
                    um.redis.srem(f'c:{coll.my_id}:recs', r)
