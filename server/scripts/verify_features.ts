
import { auth } from '../src/auth'; // Using .ts resolution via tsx
import { prisma } from '../src/db';

async function main() {
    console.log("Starting Features Verification...");
    const API_URL = "http://localhost:4000/api";

    // 1. Create Users
    const emailA = `userA_${Date.now()}@test.com`;
    const emailB = `userB_${Date.now()}@test.com`;
    const password = "password123";

    console.log(`Creating User A: ${emailA}`);
    const resA = await auth.api.signUpEmail({ body: { email: emailA, password, name: "User A" } });

    console.log(`Creating User B: ${emailB}`);
    const resB = await auth.api.signUpEmail({ body: { email: emailB, password, name: "User B" } });

    // Login to get cookies
    const loginA = await fetch(`${API_URL}/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailA, password })
    });
    const cookieA = loginA.headers.get('set-cookie')!;

    const loginB = await fetch(`${API_URL}/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailB, password })
    });
    const cookieB = loginB.headers.get('set-cookie')!;

    // --- TEST 1: Unread Counts ---
    console.log("\n--- Testing Unread Counts ---");
    // User A creates channel
    const chanRes = await fetch(`${API_URL}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
        body: JSON.stringify({ name: `test-chan-${Date.now()}` })
    });
    const channel = await chanRes.json();
    console.log(`Channel Created: ${channel.name} (${channel.id})`);

    // User B joins channel
    const joinRes = await fetch(`${API_URL}/channels/${channel.id}/join`, {
        method: 'POST',
        headers: { 'Cookie': cookieB }
    });
    if (!joinRes.ok) throw new Error("User B failed to join channel");
    console.log("User B joined channel");

    // User A sends message
    await fetch(`${API_URL}/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
        body: JSON.stringify({ content: "Ping" })
    });
    console.log("User A sent message 'Ping'");

    // User B checks unread count
    // Fetch channels list
    const listRes = await fetch(`${API_URL}/channels`, {
        headers: { 'Cookie': cookieB }
    });
    const channels = await listRes.json();
    const targetChan = channels.find((c: any) => c.id === channel.id);
    console.log(`User B Unread Count: ${targetChan.unreadCount} (Expected >= 1)`);

    if (targetChan.unreadCount < 1) throw new Error("Unread count failed!");

    // User B marks as read
    const readRes = await fetch(`${API_URL}/channels/${channel.id}/read`, {
        method: 'POST',
        headers: { 'Cookie': cookieB }
    });
    if (!readRes.ok) throw new Error("Mark read failed");
    console.log("User B marked channel as read");

    // Check again
    const listRes2 = await fetch(`${API_URL}/channels`, {
        headers: { 'Cookie': cookieB }
    });
    const channels2 = await listRes2.json();
    const targetChan2 = channels2.find((c: any) => c.id === channel.id);
    console.log(`User B Unread Count: ${targetChan2.unreadCount} (Expected 0)`);

    if (targetChan2.unreadCount !== 0) throw new Error("Mark read logic failed! Count not 0.");

    // --- TEST 2: Threads ---
    console.log("\n--- Testing Threads ---");
    // Send Parent
    const msgRes = await fetch(`${API_URL}/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
        body: JSON.stringify({ content: "Parent Message" })
    });
    const parentMsg = await msgRes.json();
    console.log(`Parent Message ID: ${parentMsg.id}`);

    // Send Reply
    const replyRes = await fetch(`${API_URL}/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
        body: JSON.stringify({ content: "Reply Message", threadId: parentMsg.id })
    });
    const replyMsg = await replyRes.json();
    console.log(`Reply Message Sent. Thread ID: ${replyMsg.threadId}`);

    // Verify fetching thread
    const threadRes = await fetch(`${API_URL}/channels/${channel.id}?threadId=${parentMsg.id}`, {
        headers: { 'Cookie': cookieA }
    });
    const threadData = await threadRes.json(); // returns { channel, messages }
    const replies = threadData.messages;
    console.log(`Fetched Thread Replies: ${replies.length}`);

    if (replies.length < 1) throw new Error("Thread fetch failed");
    if (replies[0].content !== "Reply Message") throw new Error("Correct reply not found");

    // --- TEST 3: Profiles ---
    console.log("\n--- Testing Profiles ---");
    // Update Bio
    await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
        body: JSON.stringify({ bio: "I like coding" })
    });
    console.log("User A updated bio.");

    // Fetch User A info as User B
    const usersRes = await fetch(`${API_URL}/users`, {
        headers: { 'Cookie': cookieB }
    });
    const users = await usersRes.json();
    const fetchedUserA = users.find((u: any) => u.id === resA.user.id);
    if (!fetchedUserA) {
        console.log("Users available:", users.map((u: any) => u.id));
        throw new Error(`User A (${resA.user.id}) not found in users list`);
    }
    console.log(`User A Bio seen by B: '${fetchedUserA.bio}'`);

    if (fetchedUserA.bio !== "I like coding") throw new Error("Profile bio update failed");

    console.log("\nALL BACKEND TESTS PASSED.");
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
