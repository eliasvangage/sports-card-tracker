import { createHash } from "crypto";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challengeCode = searchParams.get("challenge_code");
  const verificationToken = process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN;
  const endpoint = process.env.EBAY_MARKETPLACE_DELETION_ENDPOINT;

  if (!challengeCode || !verificationToken || !endpoint) {
    return NextResponse.json(
      { error: "eBay account deletion endpoint is not configured." },
      { status: 400 },
    );
  }

  const challengeResponse = createHash("sha256")
    .update(challengeCode)
    .update(verificationToken)
    .update(endpoint)
    .digest("hex");

  return NextResponse.json({ challengeResponse });
}

export async function POST(request: Request) {
  const event = await request.json().catch(() => null);

  console.info("Received eBay marketplace account deletion notification.", {
    notificationId: event?.metadata?.notificationId,
    topic: event?.metadata?.topic,
    username: event?.notification?.username,
    userId: event?.notification?.userId,
  });

  return NextResponse.json({ received: true });
}
