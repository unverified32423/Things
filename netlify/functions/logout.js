exports.handler = async () => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Set-Cookie': 'aether_user=; Path=/; Max-Age=0',
  },
  body: JSON.stringify({ success: true }),
});
