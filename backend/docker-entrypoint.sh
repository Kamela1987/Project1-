#!/bin/sh
set -e

# MIGRATIONS_RUN=false (set below in docker-compose.prod.yml / your
# platform's env) means the app won't apply migrations on every boot —
# see the comment in src/app.module.ts. Run them here instead, once, as
# an explicit deploy step ahead of `exec`ing into the app process.
if [ "$MIGRATIONS_RUN" = "false" ]; then
  echo "Running database migrations..."
  npm run migration:run:prod
fi

exec "$@"
