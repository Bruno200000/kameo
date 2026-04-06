const { corsHeaders, readJsonBody, sendJson, supabaseFetch } = require('./_lib/supabase');

module.exports = async (req, res) => {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const rows = (await supabaseFetch('platform_settings?select=key,value')) || [];
      const settings = { name: '', email: '', phone: '', address: '', currency: 'XOF' };
      rows.forEach((row) => {
        if (row && typeof row.key === 'string' && row.key in settings) {
          settings[row.key] = row.value ?? settings[row.key];
        }
      });
      return sendJson(res, 200, settings);
    }

    if (req.method === 'POST') {
      const payload = (await readJsonBody(req)) || {};
      const allowedKeys = ['name', 'email', 'phone', 'address', 'currency'];

      for (const key of allowedKeys) {
        if (!(key in payload)) continue;
        const value = payload[key] == null ? '' : String(payload[key]);
        const updated = await supabaseFetch(`platform_settings?key=eq.${encodeURIComponent(key)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ value })
        });

        if (!updated || updated.length === 0) {
          await supabaseFetch('platform_settings', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ key, value })
          });
        }
      }

      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (err) {
    console.error('Settings error:', err.message);
    return sendJson(res, 500, { error: 'Erreur serveur' });
  }
};
