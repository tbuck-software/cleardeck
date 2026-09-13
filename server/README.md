# ClearDeck sync server

This optional service stores one ClearDeck workspace per deployment. It stores
the complete encrypted SQLite snapshot supplied by the desktop client as an
opaque `bytea`; it cannot open, search, or merge the data. Clients coordinate
writes with a revision and `If-Match` (compare-and-swap), so a stale client must
reload before it can overwrite another device's change.

The server has no default account. Create an editor or reader account after the
database is healthy:

```sh
docker compose up -d --build
docker compose exec -T app npm run account -- set alice editor < password.txt
docker compose exec -T app npm run account -- set bob reader < password.txt
```

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
