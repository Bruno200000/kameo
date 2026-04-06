const { corsHeaders, readJsonBody, sendJson, supabaseFetch } = require('../_lib/supabase');

module.exports = async (req, res) => {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method Not Allowed' });

  try {
    const body = await readJsonBody(req);
    const { email, password } = body || {};

    if (!email || !password) {
      return sendJson(res, 400, { error: 'Email et mot de passe requis' });
    }

    const users = await supabaseFetch(
      `users?email=eq.${encodeURIComponent(email)}&password_hash=eq.${encodeURIComponent(password)}&select=*,companies(name)&limit=1`
    );

    if (users && users.length > 0) {
      return sendJson(res, 200, { success: true, user: users[0] });
    }

    return sendJson(res, 401, { error: 'Identifiants incorrects' });
  } catch (err) {
    console.error('Login error:', err.message);
    return sendJson(res, 500, { error: 'Erreur serveur lors de la connexion' });
  }
};
