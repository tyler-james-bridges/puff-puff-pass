import { generateJwt } from "@coinbase/cdp-sdk/auth";

function resolveFacilitatorEndpoint(facilitatorUrl, endpoint) {
  const parsed = new URL(facilitatorUrl);
  const basePath = parsed.pathname.endsWith("/")
    ? parsed.pathname.slice(0, -1)
    : parsed.pathname;
  const endpointPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  return {
    host: parsed.host,
    path: `${basePath}${endpointPath}`
  };
}

export function createCdpAuthHeadersFactory({ facilitatorUrl, apiKeyId, apiKeySecret }) {
  if (!apiKeyId || !apiKeySecret) return null;

  return async () => {
    const verifyTarget = resolveFacilitatorEndpoint(facilitatorUrl, "verify");
    const settleTarget = resolveFacilitatorEndpoint(facilitatorUrl, "settle");
    const supportedTarget = resolveFacilitatorEndpoint(facilitatorUrl, "supported");

    const [verifyJwt, settleJwt, supportedJwt] = await Promise.all([
      generateJwt({
        apiKeyId,
        apiKeySecret,
        requestMethod: "POST",
        requestHost: verifyTarget.host,
        requestPath: verifyTarget.path,
        expiresIn: 120
      }),
      generateJwt({
        apiKeyId,
        apiKeySecret,
        requestMethod: "POST",
        requestHost: settleTarget.host,
        requestPath: settleTarget.path,
        expiresIn: 120
      }),
      generateJwt({
        apiKeyId,
        apiKeySecret,
        requestMethod: "GET",
        requestHost: supportedTarget.host,
        requestPath: supportedTarget.path,
        expiresIn: 120
      })
    ]);

    return {
      verify: { Authorization: `Bearer ${verifyJwt}` },
      settle: { Authorization: `Bearer ${settleJwt}` },
      supported: { Authorization: `Bearer ${supportedJwt}` }
    };
  };
}

