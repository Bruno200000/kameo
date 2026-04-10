const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function debugSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;

    console.log('Using URL:', url);
    console.log('Using Key:', key ? 'FOUND' : 'NOT FOUND');

    if (!url || !key) {
        console.error("Supabase URL or Key not found!");
        return;
    }

    const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`
    };

    const queries = [
        'companies?select=*&order=created_at.asc',
        'users?select=*',
        'products?select=*'
    ];

    for (const q of queries) {
        console.log(`Checking ${q}...`);
        try {
            const res = await fetch(`${url}/rest/v1/${q}`, { headers });
            if (res.ok) {
                const data = await res.json();
                console.log(`  OK: found ${data.length} records.`);
            } else {
                const text = await res.text();
                console.log(`  FAILED ${res.status}: ${text}`);
            }
        } catch (err) {
            console.log(`  ERROR: ${err.message}`);
        }
    }
}

debugSupabase();
