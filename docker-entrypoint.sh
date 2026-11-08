#!/bin/sh
cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  noticePublicGistUrl: "${NOTICE_PUBLIC_GIST_URL:-}",
  noticeUsersGistUrl: "${NOTICE_USERS_GIST_URL:-}"
};
EOF
exec nginx -g 'daemon off;'
