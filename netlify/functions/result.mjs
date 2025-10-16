import { getStore } from "@netlify/blobs";

export default async (request) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Extract job_id from URL path (e.g., /result/job_123_abc)
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const job_id = pathParts[pathParts.length - 1]; // Get last segment

    console.log(`Full URL: ${request.url}`);
    console.log(`Path parts:`, pathParts);
    console.log(`Fetching result for job_id: ${job_id}`);

    if (!job_id || job_id === 'result' || job_id.includes('.netlify')) {
      console.log('Invalid job_id detected');
      return new Response(JSON.stringify({ error: "Missing or invalid job_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getStore("job-results");
    
    // Try to get the result as text first, then parse
    const rawResult = await store.get(`job:${job_id}`);
    console.log(`Raw result type:`, typeof rawResult);
    console.log(`Raw result:`, rawResult);

    if (rawResult === null || rawResult === undefined) {
      console.log('Result not found, returning 204');
      return new Response(null, { status: 204 }); // Not ready
    }

    // Parse the result if it's a string
    let result;
    if (typeof rawResult === 'string') {
      try {
        result = JSON.parse(rawResult);
      } catch (e) {
        result = rawResult; // Return as-is if not valid JSON
      }
    } else {
      result = rawResult;
    }

    return new Response(JSON.stringify({ job_id, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Result fetch error:", error);
    return new Response(JSON.stringify({ error: "Internal error", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};