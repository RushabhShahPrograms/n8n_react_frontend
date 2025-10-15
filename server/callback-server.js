import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.CALLBACK_PORT || 5174;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// In-memory store of job results
// Structure: { [job_id: string]: any }
const jobIdToResult = Object.create(null);

app.post("/callback", (req, res) => {
  const { job_id, result } = req.body || {};

  if (!job_id) {
    return res.status(400).json({ error: "Missing job_id" });
  }

  jobIdToResult[job_id] = result !== undefined ? result : null;
  return res.status(200).json({ status: "received" });
});

app.get("/result/:job_id", (req, res) => {
  const { job_id } = req.params;
  if (!job_id) {
    return res.status(400).json({ error: "Missing job_id" });
  }

  if (!(job_id in jobIdToResult)) {
    // Not ready yet
    return res.status(204).end();
  }

  const result = jobIdToResult[job_id];
  return res.status(200).json({ job_id, result });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Callback server listening on http://localhost:${PORT}`);
});


