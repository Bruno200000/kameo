const url = "https://nscsftfhndvbntgdsobc.supabase.co/rest/v1/companies?select=id,name";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zY3NmdGZobmR2Ym50Z2Rzb2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Njk3NTEsImV4cCI6MjA5MDQ0NTc1MX0.VTqitVf7LNH6WoTQhbT6T_fcdiHddVmO0Fp5x5VgqNU";

async function test() {
    console.log("Testing Supabase connection...");
    try {
        const res = await fetch(url, {
            headers: {
                "apikey": key,
                "Authorization": `Bearer ${key}`
            }
        });
        const data = await res.json();
        console.log("Status:", res.status);
        if (Array.isArray(data)) {
            console.log("Success! Found", data.length, "companies.");
            console.log("Data:", JSON.stringify(data, null, 2));
        } else {
            console.log("Unexpected data format:", data);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
