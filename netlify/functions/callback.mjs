import { getStore } from "@netlify/blobs";

export default async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const contentType = request.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    const body = await request.json();
    const { job_id, result } = body;

    console.log(`Received callback for job_id: ${job_id}`);
    console.log(`Result type:`, typeof result);
    console.log(`Result preview:`, JSON.stringify(result).substring(0, 200));

    if (!job_id) {
      return new Response(JSON.stringify({ error: "Missing job_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getStore("job-results");
    
    // Store the result - ensure it's properly serialized
    await store.set(`job:${job_id}`, JSON.stringify(result || null), {
      metadata: { timestamp: new Date().toISOString() }
    });

    console.log(`Successfully stored result for job_id: ${job_id}`);

    return new Response(JSON.stringify({ status: "received", job_id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({ error: "Internal error", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};