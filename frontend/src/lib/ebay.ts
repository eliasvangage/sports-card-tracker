type EbayTokenCache = {
  expiresAt: number;
  token: string;
};

let tokenCache: EbayTokenCache | null = null;

export function ebayCredentials() {
  const clientId = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET || process.env.EBAY_CERT_ID;

  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
  };
}

export async function getEbayAppToken() {
  const { clientId, clientSecret, configured } = ebayCredentials();

  if (!configured || !clientId || !clientSecret) {
    throw new EbayConfigError();
  }

  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to authenticate with eBay.");
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!body.access_token) {
    throw new Error("eBay did not return an access token.");
  }

  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, (body.expires_in ?? 7200) - 120) * 1000,
  };

  return tokenCache.token;
}

export class EbayConfigError extends Error {
  constructor() {
    super(
      "eBay integration is ready, but EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are not set yet.",
    );
  }
}
