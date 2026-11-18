#!/usr/bin/env node
// One-time helper for the real-Spotify smoke workflow (#76 tier 3).
//
// Signs you in to Spotify in your browser and prints a refresh token for
// the SPOTIFY_TEST_REFRESH_TOKEN GitHub secret. Run it yourself, in your own
// terminal: the token controls your Spotify account within Groupify's
// scopes, so never paste it into a chat, an issue, a PR or a log.
//
// It reuses the local-dev redirect URI, which the Spotify app you pick must
// already list in the Spotify dashboard (Spotify matches it exactly):
//   http://127.0.0.1:5001/api/v1/auth/callback
// So stop the local backend first: this script listens on port 5001.
//
// Usage (from Groupify-backend, with .env filled in):
//   node scripts/get-spotify-refresh-token.js          # SPOTIFY_CLIENT_ID
//   node scripts/get-spotify-refresh-token.js --app 1  # SPOTIFY_CLIENT_ID_1
require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const { SPOTIFY_SCOPES } = require('../src/config/spotifyScopes');

const PORT = 5001;
const CALLBACK_PATH = '/api/v1/auth/callback';
const REDIRECT_URI = `http://127.0.0.1:${PORT}${CALLBACK_PATH}`;

const appArg = process.argv.indexOf('--app');
const appIndex = appArg === -1 ? 0 : Number(process.argv[appArg + 1]);
const suffix = appIndex ? `_${appIndex}` : '';
const clientId = process.env[`SPOTIFY_CLIENT_ID${suffix}`];
const clientSecret = process.env[`SPOTIFY_CLIENT_SECRET${suffix}`];
if (!clientId || !clientSecret) {
  console.error(`SPOTIFY_CLIENT_ID${suffix} and SPOTIFY_CLIENT_SECRET${suffix} must be set in Groupify-backend/.env.`);
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
// Every scope Groupify asks for: the backend asks a user to sign in again if
// a refreshed token is missing any of them.
const authorizeUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  scope: SPOTIFY_SCOPES.join(' '),
  redirect_uri: REDIRECT_URI,
  state,
  show_dialog: 'true',
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== CALLBACK_PATH) {
    res.writeHead(404).end();
    return;
  }
  const finish = (status, text) => {
    res.writeHead(status, { 'Content-Type': 'text/plain' }).end(text);
    server.close();
  };
  if (url.searchParams.get('state') !== state) return finish(400, 'State mismatch. Run the script again.');
  if (url.searchParams.get('error')) return finish(400, `Spotify said: ${url.searchParams.get('error')}`);

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: REDIRECT_URI }),
    });
    const body = await tokenRes.json();
    if (!tokenRes.ok || !body.refresh_token) {
      finish(500, 'Spotify did not return a refresh token. See the terminal.');
      console.error('Token request failed:', tokenRes.status, body.error, body.error_description);
      return;
    }
    finish(200, 'Done. Go back to the terminal.');
    console.log('\nRefresh token (store it as the GitHub secret SPOTIFY_TEST_REFRESH_TOKEN, then clear your terminal):\n');
    console.log(body.refresh_token);
    console.log(`\nAlso store this app's client ID and secret as SPOTIFY_TEST_CLIENT_ID and SPOTIFY_TEST_CLIENT_SECRET (from SPOTIFY_CLIENT_ID${suffix} / SPOTIFY_CLIENT_SECRET${suffix}).`);
    console.log('Granted scopes:', body.scope);
  } catch (err) {
    finish(500, 'Token request failed. See the terminal.');
    console.error('Token request failed:', err.message);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Stop the local backend (npm run dev) and run this again.`);
  } else {
    console.error('Could not start:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Using Spotify app ${appIndex} (SPOTIFY_CLIENT_ID${suffix}).`);
  console.log(`Make sure ${REDIRECT_URI} is a redirect URI on that app, then open:\n\n${authorizeUrl}\n`);
});
