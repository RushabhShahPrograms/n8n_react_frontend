import { getStore } from "@netlify/blobs";

export default async (request, { params }) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { job_id } = params; // Extracts from URL path
    console.log(`Fetching result for job_id: ${job_id}`);

    if (!job_id) {
      return new Response(JSON.stringify({ error: "Missing job_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getStore("job-results");
    const result = await store.getJSON(`job:${job_id}`);

    console.log(`Retrieved result for job_id ${job_id}: ${JSON.stringify(result)}`);

    if (result === null) {
      return new Response(null, { status: 204 }); // Not ready
    }

    return new Response(JSON.stringify({ job_id, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Result error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};