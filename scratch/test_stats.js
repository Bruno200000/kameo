async function testStats() {
    try {
        const res = await fetch('http://localhost:5000/api/admin/stats');
        const json = await res.json();
        console.log('Stats Response:', JSON.stringify(json, null, 2));
    } catch (err) {
        console.error('Error fetching stats:', err.message);
    }
}

testStats();
