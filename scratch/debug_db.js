const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function debug() {
    console.log('--- DB Debug ---');
    console.log('URL:', process.env.SUPABASE_URL);
    
    const headers = {
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`
    };

    const runQuery = async (resource) => {
        const url = `${process.env.SUPABASE_URL}/rest/v1/${resource}`;
        console.log(`Fetching ${url}...`);
        try {
            const res = await fetch(url, { headers });
            const data = await res.json();
            if (res.ok) {
                console.log(`  SUCCESS: found ${data.length} records.`);
                if (data.length > 0) console.log(`  Samples:`, data.slice(0, 1).map(c => ({id: c.id, name: c.name})));
            } else {
                console.log(`  FAIL ${res.status}:`, data);
            }
        } catch (e) {
            console.log(`  ERROR: ${e.message}`);
        }
    };

    await runQuery('companies?select=*');
    await runQuery('users?select=*');
}

debug();
