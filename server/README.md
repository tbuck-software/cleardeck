# ClearDeck sync server

This optional service stores one ClearDeck workspace per deployment. Protocol 2
stores validated SQLite rows as PostgreSQL `jsonb` records and keeps a durable
change log for offline clients. Existing protocol-1 encrypted SQLite snapshots
remain opaque `bytea` data; they are never silently migrated or deleted.

The server has no default account. Create an administrator, editor, or reader account after the
database is healthy:

```sh
docker compose up -d --build
docker compose exec -T app npm run account -- set alice editor < password.txt
docker compose exec -T app npm run account -- set bob reader < password.txt
docker compose exec -T app npm run account -- set bootstrap-admin admin < password.txt
```

Only an `admin` account may initialize an empty protocol-2 workspace. Admin
accounts retain editor write access after initialization; readers remain
read-only. Protocol 2 stores validated rows and change history in PostgreSQL,
while existing encrypted protocol-1 snapshots remain opaque and unchanged.

`password.txt` should contain one password of 14–256 characters and should be
removed after use. To revoke an account and all of its sessions, run:

```sh
docker compose exec app npm run account -- disable bob
```

For a self-hosted deployment, copy `.env.example` to `.env`, set a long random
database password and a DNS name that points to the machine, then run the
commands above. Caddy terminates HTTPS and obtains a certificate for
`SERVER_DOMAIN`; the app and database stay on the private Compose network.
The desktop app accepts plain HTTP only for loopback addresses, so a remote
deployment must use the Caddy HTTPS address.

Run the HTTP/password tests with `npm test`. The Postgres test starts and
removes a uniquely named disposable Docker container when explicitly enabled:

```sh
npm run test:integration
```

The production service is released under the MIT License in `LICENSE`.
