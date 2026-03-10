import fs from 'node:fs';
import crypto from 'node:crypto';

const serviceAccountPath = 'C:/Users/lenovo/Downloads/esnaftaucuz-push-firebase-adminsdk-fbsvc-a80eb54e63.json';
const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const projectId = sa.project_id;

const b64url = (input) =>
  Buffer.from(input).toString('base64url');

const now = Math.floor(Date.now() / 1000);
const header = { alg: 'RS256', typ: 'JWT' };
const payload = {
  iss: sa.client_email,
  sub: sa.client_email,
  aud: 'https://oauth2.googleapis.com/token',
  scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
  iat: now,
  exp: now + 3600,
};

const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const signer = crypto.createSign('RSA-SHA256');
signer.update(unsigned);
signer.end();
const signature = signer.sign(sa.private_key).toString('base64url');
const jwt = `${unsigned}.${signature}`;

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }),
});
const tokenJson = await tokenRes.json();
if (!tokenRes.ok || !tokenJson.access_token) {
  console.error('TOKEN_ERROR', tokenJson);
  process.exit(1);
}
const accessToken = tokenJson.access_token;

const listRes = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const listJson = await listRes.json();
if (!listRes.ok) {
  console.error('LIST_ERROR', listJson);
  process.exit(1);
}

let appId = listJson?.apps?.[0]?.appId;
if (!appId) {
  const createRes = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName: 'esnaftaucuz-web' }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok) {
    console.error('CREATE_ERROR', createJson);
    process.exit(1);
  }
  appId = createJson.appId;
}

const configRes = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${encodeURIComponent(appId)}/config`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const configJson = await configRes.json();
if (!configRes.ok) {
  console.error('CONFIG_ERROR', configJson);
  process.exit(1);
}

console.log(JSON.stringify({ appId, config: configJson }, null, 2));
