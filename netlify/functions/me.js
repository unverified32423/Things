exports.handler = async (event) => {
  const cookie = event.headers.cookie || '';
  const match = cookie.match(/aether_user=([^;]+)/);
  if (!match) return json({ logged_in: false }, 401);

  try {
    const user = JSON.parse(Buffer.from(match[1], 'base64').toString());
    return json({ logged_in: true, user });
  } catch {
    return json({ logged_in: false }, 401);
  }
};

function json(data, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(data),
  };
}
