async function debugSupabase() {
    // Manually setting vars for testing if process.env is missing in current shell
    const supabaseUrl = "https://eexwvekyowskvobzptoa.supabase.co"; // Found in server.js
    const supabaseKey = ""; // I don't have it, I'll try to get it from .env or server.js view
    
    // Actually I'll read backend/server.js to get the vars
    const fs = require('fs');
    const serverJs = fs.readFileSync('backend/server.js', 'utf8');
    const urlMatch = serverJs.match(/SUPABASE_URL\s*=\s*['"](.*?)['"]/);
    const keyMatch = serverJs.match(/SUPABASE_KEY\s*=\s*['"](.*?)['"]/);
    
    const url = process.env.SUPABASE_URL || urlMatch?.[1];
    const key = process.env.SUPABASE_KEY || keyMatch?.[1];

    if (!url || !key) {
        console.error("Supabase URL or Key not found!");
        return;
    }

    const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`
    };

    const queries = [
        'companies?select=id,name,plan_id,subscription_status,created_at&order=created_at.asc',
        'users?select=id',
        'products?select=id'
    ];

    for (const q of queries) {
        console.log(`Checking ${q}...`);
        try {
            const res = await fetch(`${url}/rest/v1/${q}`, { headers });
            if (res.ok) {
                const data = await res.json();
                console.log(`  OK: found ${data.length} records.`);
                if (data.length > 0) console.log(`  First record keys: ${Object.keys(data[0]).join(', ')}`);
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
