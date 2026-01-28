
import { auth } from '../src/auth.js';
import { prisma } from '../src/db.js';

async function main() {
    console.log("Starting DM Verification...");

    // 1. Create Users
    const emailA = `userA_${Date.now()}@example.com`;
    const emailB = `userB_${Date.now()}@example.com`;
    const password = "password123";

    console.log(`Creating User A: ${emailA}`);
    const userA = await auth.api.signUpEmail({
        body: { email: emailA, password, name: "User A" }
    });

    console.log(`Creating User B: ${emailB}`);
    const userB = await auth.api.signUpEmail({
        body: { email: emailB, password, name: "User B" }
    });

    const userIdA = userA.user.id;
    const userIdB = userB.user.id;

    console.log(`User A ID: ${userIdA}`);
    console.log(`User B ID: ${userIdB}`);

    // 2. Create DM Session (As User A)
    // We simulate the API call logic directly or use Prisma to verify backend logic mimics it
    // But better to hit the API? We can't easily hit API with auth cookies in this script without fetch wrapper.
    // Let's test the Prisma logic directly or use `fetch` against localhost:4000.

    // We will use fetch against running server.
    const loginRes = await fetch('http://localhost:4000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailA, password })
    });

    if (!loginRes.ok) throw new Error("Login failed");
    const cookie = loginRes.headers.get('set-cookie');
    if (!cookie) throw new Error("No cookie returned");

    console.log("User A Logged In. Creating DM with User B...");

    const createDMRes = await fetch('http://localhost:4000/api/dms', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({ targetUserId: userIdB })
    });

    if (!createDMRes.ok) {
        console.error(await createDMRes.text());
        throw new Error("Failed to create DM");
    }

    const dmSession = await createDMRes.json();
    console.log(`DM Session Created: ${dmSession.id}`);

    // 3. Send Message
    console.log("Sending Message...");
    const msgRes = await fetch(`http://localhost:4000/api/dms/${dmSession.id}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({ content: "Hello from User A" })
    });

    if (!msgRes.ok) throw new Error("Failed to send message");
    const msg = await msgRes.json();
    console.log(`Message Sent: ${msg.content}`);

    // 4. Verify Message Listing
    console.log("Verifying Message Listing...");
    const listRes = await fetch(`http://localhost:4000/api/dms/${dmSession.id}`, {
        headers: { 'Cookie': cookie }
    });

    const listData = await listRes.json();
    if (listData.messages.length !== 1 || listData.messages[0].content !== "Hello from User A") {
        throw new Error("Message verification failed");
    }

    console.log("SUCCESS: DM Flow Verified!");
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
