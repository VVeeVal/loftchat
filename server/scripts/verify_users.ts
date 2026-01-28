
import { auth } from '../src/auth.js';
import { prisma } from '../src/db.js';

async function main() {
    console.log("Starting Users List Verification...");

    // 1. Create a User to log in with
    const email = `userList_${Date.now()}@example.com`;
    const password = "password123";

    await auth.api.signUpEmail({
        body: { email, password, name: "List Tester" }
    });

    // 2. Login
    const loginRes = await fetch('http://localhost:4000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const cookie = loginRes.headers.get('set-cookie');
    if (!cookie) throw new Error("No cookie returned");

    // 3. Fetch Users
    console.log("Fetching /api/users...");
    const res = await fetch('http://localhost:4000/api/users', {
        headers: { 'Cookie': cookie }
    });

    if (!res.ok) {
        console.error(await res.text());
        throw new Error("Failed to fetch users");
    }

    const users = await res.json();
    console.log(`Found ${users.length} users.`);

    if (!Array.isArray(users) || users.length === 0) {
        throw new Error("Users list is empty or invalid");
    }

    console.log("SUCCESS: Users list fetched.");
    // Log headers to confirm JSON content type if needed
    // console.log(res.headers.get('content-type'));

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
