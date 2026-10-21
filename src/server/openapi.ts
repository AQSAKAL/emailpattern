// Served at /api/openapi.json. Shapes mirror FindResult in ./find.ts.

const Candidate = {
  type: "object",
  properties: {
    email: { type: ["string", "null"], description: "Null when no name was given." },
    pattern: { type: "string", example: "first-dot-last" },
    template: { type: "string", example: "{first}.{last}@acme.com" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
}

const FindResult = {
  type: "object",
  properties: {
    query: { type: "object", properties: { domain: { type: "string" }, name: { type: "string" } } },
    domain: { type: ["string", "null"] },
    error: { type: ["string", "null"], enum: ["invalid_domain", "invalid_name", null] },
    company_name: { type: ["string", "null"] },
    known_domain: { type: "boolean", description: "False when the ranking is the global default because we have no data for the domain." },
    prior_basis: {
      type: "string",
      enum: ["mail_host", "overall", "catalogue"],
      description: "What the ranking starts from before the company's own addresses: formats at companies on the same mail host, across all known companies, or built-in defaults.",
    },
    sample_count: { type: "integer" },
    candidates: { type: "array", items: Candidate },
    mail: {
      type: "object",
      properties: { accepts_mail: { type: ["boolean", "null"] }, host: { type: ["string", "null"] } },
    },
  },
}

export function openApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Email Pattern API",
      version: "1.0.0",
      description: "The email address format a company uses, and the likely address for a person there. 60 requests a minute per IP.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/v1/find": {
        get: {
          summary: "Find the likely address for one person",
          parameters: [
            { name: "domain", in: "query", required: true, schema: { type: "string" }, example: "acme.com" },
            { name: "name", in: "query", required: false, schema: { type: "string" }, example: "Jane Doe" },
          ],
          responses: { 200: { description: "Ranked candidates", content: { "application/json": { schema: FindResult } } } },
        },
        post: {
          summary: "Find addresses for up to 50 people",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["queries"],
                  properties: {
                    queries: {
                      type: "array",
                      maxItems: 50,
                      items: { type: "object", required: ["domain"], properties: { domain: { type: "string" }, name: { type: "string" } } },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "One result per query, in order",
              content: { "application/json": { schema: { type: "object", properties: { results: { type: "array", items: FindResult } } } } },
            },
          },
        },
      },
      "/api/v1/domains/{domain}": {
        get: {
          summary: "Every format a domain uses",
          parameters: [{ name: "domain", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Formats with shares", content: { "application/json": { schema: FindResult } } } },
        },
      },
    },
  }
}
