exports.handler = async () => {
  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    redirect_uri:  process.env.REDIRECT_URI,
    response_type: 'code',
    scope:         'identify guilds.members.read',
  });

  return {
    statusCode: 302,
    headers: { Location: `https://discord.com/oauth2/authorize?${params}` },
    body: '',
  };
};
