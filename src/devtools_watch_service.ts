import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_gateway.js";
import { watchReleasePage, watchRequestSchema } from "./release_page_watch.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const port = Number(process.env.PORT ?? 3000);

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/watch") {
    sendJson(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = watchRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    sendJson(response, 200, await watchReleasePage(input, apiKey));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, message: error.message });
      return;
    }
    sendJson(response, 500, { error: "internal_error" });
  }
});

server.listen(port, () => {
  console.log(`Developer page watch service listening on http://localhost:${port}`);
});
