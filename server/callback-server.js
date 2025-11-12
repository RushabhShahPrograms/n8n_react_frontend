import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 8080;

// Needed to emulate __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// In-memory store of job results
const jobIdToResult = Object.create(null);

// --- API endpoints ---

app.post("/callback", (req, res) => {
  const { job_id, result } = req.body || {};
  if (!job_id) return res.status(400).json({ error: "Missing job_id" });
  jobIdToResult[job_id] = result ?? null;
  res.status(200).json({ status: "received" });
});

app.get("/result/:job_id", (req, res) => {
  const { job_id } = req.params;
  if (!job_id) return res.status(400).json({ error: "Missing job_id" });
  if (!(job_id in jobIdToResult)) return res.status(204).end();
  res.status(200).json({ job_id, result: jobIdToResult[job_id] });
});

// --- Serve React frontend ---

// Serve static assets from dist
app.use(express.static(path.join(__dirname, "../dist")));

// Fallback: all other routes serve index.html
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "../dist", "index.html"));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server (frontend + callback) running on http://localhost:${PORT}`);
});
