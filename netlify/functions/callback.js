const fetch = (...a) => import('node-fetch').then(m => m.default(...a));

const DISCORD_API = 'https://discord.com/api/v10';

exports.handler = async (event) => {
  const FRONTEND_URL = process.env.FRONTEND_URL;
  const code = event.queryStringParameters?.code;
  if (!code) return redirect(`${FRONTEND_URL}?error=no_code`);

  // exchange code for token
  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  process.env.REDIRECT_URI,
    }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) return redirect(`${FRONTEND_URL}?error=token_failed`);

  // get user info
  const user = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(r => r.json());

  // check guild role
  const member = await fetch(
    `${DISCORD_API}/guilds/${process.env.DISCORD_GUILD_ID}/members/${user.id}`,
    { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
  ).then(r => r.json());

  const hasRole = (member.roles || []).includes(process.env.DISCORD_CLIENT_ROLE_ID);

  // encode user into a signed token (simple base64 — swap for JWT in production)
  const payload = Buffer.from(JSON.stringify({
    id:        user.id,
    username:  user.username,
    avatar:    user.avatar,
    is_client: hasRole,
  })).toString('base64');

  const dest = hasRole ? `${FRONTEND_URL}/client` : `${FRONTEND_URL}?error=no_access`;

  return {
    statusCode: 302,
    headers: {
      Location:  dest,
      'Set-Cookie': `aether_user=${payload}; Path=/; SameSite=Lax; Max-Age=86400`,
    },
    body: '',
  };
};

function redirect(url) {
  return { statusCode: 302, headers: { Location: url }, body: '' };
}
