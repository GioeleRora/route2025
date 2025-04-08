require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

// Print available connection strings
console.log('Available connection strings:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Available (hidden)' : 'Not available');
console.log('- POSTGRES_URL:', process.env.POSTGRES_URL ? 'Available (hidden)' : 'Not available');

async function testConnection() {
    // Try with POSTGRES_URL first
    console.log('\nTesting connection with POSTGRES_URL...');
    try {
        const sql1 = neon(process.env.POSTGRES_URL);
        const result1 = await sql1`SELECT NOW() as time`;
        console.log('✓ Connection successful with POSTGRES_URL!');
        console.log('Current database time:', result1[0].time);
    } catch (err) {
        console.error('✗ Connection with POSTGRES_URL failed:', err.message);
    }

    // Then try with DATABASE_URL
    console.log('\nTesting connection with DATABASE_URL...');
    try {
        const sql2 = neon(process.env.DATABASE_URL);
        const result2 = await sql2`SELECT NOW() as time`;
        console.log('✓ Connection successful with DATABASE_URL!');
        console.log('Current database time:', result2[0].time);
    } catch (err) {
        console.error('✗ Connection with DATABASE_URL failed:', err.message);
    }

    // Try with direct parameters   
    console.log('\nTesting connection with direct parameters...');
    try {
        const connectionString = `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}/${process.env.PGDATABASE}?sslmode=require`;
        const sql3 = neon(connectionString);
        const result3 = await sql3`SELECT NOW() as time`;
        console.log('✓ Connection successful with direct parameters!');
        console.log('Current database time:', result3[0].time);
    } catch (err) {
        console.error('✗ Connection with direct parameters failed:', err.message);
    }
}

testConnection().catch(err => {
    console.error('Test failed:', err);
});
