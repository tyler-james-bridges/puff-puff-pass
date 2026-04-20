import {
  x402ResourceServer,
  x402HTTPResourceServer,
  HTTPFacilitatorClient,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createCdpAuthHeadersFactory } from "../../src/x402/cdp-auth.mjs";
import {
  ABSTRACT_USDC_ASSET,
  ABSTRACT_USDC_NAME,
  ABSTRACT_USDC_VERSION,
  CDP_API_KEY_ID,
  CDP_API_KEY_SECRET,
  FACILITATOR_URL,
  FACILITATOR_URL_ABSTRACT,
  PASS_FEE_USD,
  PAY_TO,
  X402_NETWORKS,
} from "./config";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getStore } from "./store";

let _httpServer: x402HTTPResourceServer | null = null;

function getX402Server(): x402HTTPResourceServer {
  if (_httpServer) return _httpServer;

  const cdpHeadersFactory = createCdpAuthHeadersFactory({
    facilitatorUrl: FACILITATOR_URL,
    apiKeyId: CDP_API_KEY_ID,
    apiKeySecret: CDP_API_KEY_SECRET,
  });

  const cdpFacilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    createAuthHeaders: cdpHeadersFactory || undefined,
  });

  const abstractFacilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL_ABSTRACT,
  });

  const facilitatorClients =
    FACILITATOR_URL_ABSTRACT === FACILITATOR_URL
      ? [cdpFacilitatorClient]
      : [cdpFacilitatorClient, abstractFacilitatorClient];

  const exactEvmScheme = new ExactEvmScheme();

  exactEvmScheme.registerMoneyParser(
    async (amount: number, network: string) => {
      if (!(network === "eip155:2741" || String(network).includes("2741"))) {
        return null;
      }
      return {
        amount: String(Math.round(amount * 1_000_000)),
        asset: ABSTRACT_USDC_ASSET,
        extra: {
          name: ABSTRACT_USDC_NAME,
          version: ABSTRACT_USDC_VERSION,
          decimals: 6,
        },
      };
    }
  );

  // Build ResourceServer with facilitators + schemes
  const resourceServer = new x402ResourceServer(facilitatorClients)
    .register("eip155:*" as any, exactEvmScheme)
    .register("eip155:2741" as any, exactEvmScheme);

  const microUsd = String(Math.round(Number(PASS_FEE_USD) * 1_000_000));
  const accepts = X402_NETWORKS.map((network) => {
    const isAbstract = network === "eip155:2741";
    return {
      scheme: "exact" as const,
      price: isAbstract
        ? {
            amount: microUsd,
            asset: ABSTRACT_USDC_ASSET,
            extra: {
              name: ABSTRACT_USDC_NAME,
              version: ABSTRACT_USDC_VERSION,
              decimals: 6,
            },
          }
        : `$${PASS_FEE_USD}`,
      network,
      payTo: PAY_TO,
    };
  });

  const routesConfig = {
    "POST /api/joint/pass": {
      accepts: accepts.length === 1 ? accepts[0] : accepts,
      description:
        "Pay to pass the virtual joint and claim the live holder slot.",
      mimeType: "application/json",
    },
  };

  _httpServer = new x402HTTPResourceServer(resourceServer, routesConfig as any);
  return _httpServer;
}

function makeAdapter(req: NextRequest) {
  return {
    getHeader(name: string) {
      return req.headers.get(name) ?? undefined;
    },
    getMethod() {
      return req.method;
    },
    getPath() {
      return new URL(req.url).pathname;
    },
    getUrl() {
      return req.url;
    },
    getAcceptHeader() {
      return req.headers.get("accept") || "*/*";
    },
    getUserAgent() {
      return req.headers.get("user-agent") || "";
    },
  };
}

export function withPayPass(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const server = getX402Server();
    const adapter = makeAdapter(req);

    const result = await server.processHTTPRequest({
      adapter,
      path: new URL(req.url).pathname,
      method: req.method,
      paymentHeader: req.headers.get("payment-signature") || undefined,
      routePattern: "POST /api/joint/pass",
    });

    if (result.type === "payment-error") {
      const ri = result.response;
      const headers: Record<string, string> = {};
      if (ri.headers) {
        for (const [k, v] of Object.entries(ri.headers)) {
          headers[k] = String(v);
        }
      }
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
      return new NextResponse(
        typeof ri.body === "string" ? ri.body : JSON.stringify(ri.body),
        {
          status: ri.status,
          headers,
        }
      );
    }

    if (result.type === "no-payment-required") {
      return handler(req);
    }

    // payment-verified: run handler then settle
    const response = await handler(req);

    try {
      const settlement = await server.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions,
        {
          request: {
            adapter,
            path: new URL(req.url).pathname,
            method: req.method,
            paymentHeader:
              req.headers.get("payment-signature") || undefined,
          },
        }
      );

      if (settlement.success && settlement.transaction) {
        try {
          const body = await req.clone().json();
          const handle = body?.handle;
          if (handle) {
            const store = await getStore();
            await store.backfillLatestPendingTxHash(
              handle,
              settlement.transaction
            );
          }
        } catch {
          // silent
        }

        const paymentResponse = Buffer.from(
          JSON.stringify(settlement)
        ).toString("base64");
        response.headers.set("Payment-Response", paymentResponse);
      }
    } catch (settleErr: any) {
      console.error(
        "[x402] settle error:",
        settleErr?.message || String(settleErr)
      );
    }

    return response;
  };
}
