#!/usr/bin/env bash
set -euo pipefail

: "${GLOSSA_HEROKU_APP:?Set GLOSSA_HEROKU_APP to the chosen app name}"

command -v heroku >/dev/null || {
  echo "Heroku CLI is required." >&2
  exit 1
}

heroku create "$GLOSSA_HEROKU_APP"
heroku ps:type basic --app "$GLOSSA_HEROKU_APP"
heroku addons:create heroku-postgresql:essential-0 --app "$GLOSSA_HEROKU_APP"

cat <<EOF
Created $GLOSSA_HEROKU_APP with:
- one Basic dyno target
- Postgres Essential-0

Configure Auth0 and Glossa variables through Heroku config vars.
Do not place secret values in this script or shell history.
EOF
