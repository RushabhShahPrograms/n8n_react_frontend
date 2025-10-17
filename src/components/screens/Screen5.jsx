import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";

const Screen5URL = "https://wholesomegoods.app.n8n.cloud/webhook/c929805e-af8c-406b-8bd7-52fb517d01bf";
// const Screen5URL = "https://wholesomegoods.app.n8n.cloud/webhook-test/c929805e-af8c-406b-8bd7-52fb517d01bf";

export const Screen5 = ({ response, setResponse, sharedData, setActiveTab, setSharedDataForScreen6 }) => {
  const [activeTab] = useState("Text to video");  
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("screen5FormData");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      currentScript: sharedData?.currentScript || "",
      winningAngle: sharedData?.winningAngle || "",
      inspiration: sharedData?.inspiration || "",
    };
  });

  const [usePrevious, setUsePrevious] = useState({
    aidaScript: true,
    winningAngle: true,
    inspiration: true,
  });

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const JOB_STATE_KEY = "screen5JobState"; // { job_id, pollStartMs, loading, done }
  const RESPONSE_KEY = "screen5Response"; // stringified JSON or string

  // Pull data from Screen 2 if user chooses "Use Previous"
  useEffect(() => {
    if (sharedData) {
      setFormData((prev) => ({
        ...prev,
        aidaScript: usePrevious.aidaScript ? sharedData?.aidaScript || "" : prev.aidaScript,
        winningAngle: usePrevious.winningAngle ? sharedData?.winningAngle || "" : prev.winningAngle,
        inspiration: usePrevious.inspiration ? sharedData?.inspiration || "" : prev.inspiration,
        model: sharedData?.model || "Kling",
      }));
    }
  }, [sharedData, usePrevious]);

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto-save to localStorage
  useEffect(() => {
    try { localStorage.setItem("screen5FormData", JSON.stringify(formData)); } catch (_) {}
  }, [formData]);

  // Persist response whenever it changes
  useEffect(() => {
    try {
      if (response && !response.error) {
        localStorage.setItem(
          RESPONSE_KEY,
          typeof response === "string" ? response : JSON.stringify(response)
        );
      }
    } catch (_) {}
  }, [response]);

  // Restore response/done and resume polling if a job is pending
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(JOB_STATE_KEY);
      const savedResponse = localStorage.getItem(RESPONSE_KEY);
      if (savedResponse && !response) {
        try { setResponse(JSON.parse(savedResponse)); } catch (_) { setResponse(savedResponse); }
        setDone(true);
      }
      if (savedState) {
        const { job_id, pollStartMs, loading: wasLoading, done: wasDone } = JSON.parse(savedState);
        if (wasLoading && !wasDone && job_id) {
          const pollTimeoutMs = 20 * 60 * 1000; // 20 minutes
          const pollIntervalMs = 2000;
          const pollStart = pollStartMs || Date.now();
          setLoading(true);
          setDone(false);
          (async () => {
            let resultData = null;
            while (Date.now() - pollStart < pollTimeoutMs) {
              try {
                const pollUrl = `${window.location.origin}/result/${job_id}`;
                const r = await fetch(pollUrl);
                if (r.status === 200) {
                  const json = await r.json();
                  resultData = json?.result ?? null;
                  break;
                }
              } catch (_) {}
              await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            }
            if (resultData == null) {
              setResponse({ error: "Timed out waiting for result. Please try again." });
            } else {
              setResponse(
                typeof resultData === "string" ? JSON.parse(resultData) : resultData
              );
              setDone(true);
              try {
                localStorage.setItem(
                  RESPONSE_KEY,
                  typeof resultData === "string" ? resultData : JSON.stringify(resultData)
                );
              } catch (_) {}
            }
            setLoading(false);
            try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
          })();
        } else if (wasDone && savedResponse) {
          setDone(true);
        }
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleUsePrevious = (name) => {
    setUsePrevious((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // State for validation errors
  const [validationErrors, setValidationErrors] = useState({});

  const handleSubmit = async () => {    
    // Validate required fields before submission
    const errors = {};
    let hasErrors = false;
    
    // Check each required field in inputFields
    inputFields.forEach(field => {
      if (field.require && (!formData[field.name] || formData[field.name].trim() === '')) {
        errors[field.name] = `${field.label} is required`;
        hasErrors = true;
      }
    });
    
    // If validation fails, update error state and stop submission
    if (hasErrors) {
      setValidationErrors(errors);
      return;
    }
    
    // Clear any previous validation errors
    setValidationErrors({});
    setLoading(true);
    setResponse(null);
    const job_id = generateJobId();
    const callback_url = `${window.location.origin}/callback`;
    const dataToSend = {
        currentScript: formData.currentScript,
        winningAngle: formData.winningAngle,
        inspiration: formData.inspiration,
        model: formData.model,
        job_id,
        callback_url,
    };
    console.log("📤 Data sent to backend:", dataToSend);
    try {
      const res = await fetch(Screen5URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      if (!res.ok) {
        throw new Error(`n8n returned ${res.status}`);
      }
      const pollStart = Date.now();
      try { localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ job_id, pollStartMs: pollStart, loading: true, done: false })); } catch (_) {}
      const pollTimeoutMs = 20 * 60 * 1000; // 20 minutes
      const pollIntervalMs = 2000;
      let resultData = null;

      while (Date.now() - pollStart < pollTimeoutMs) {
        try {
          const pollUrl = `${window.location.origin}/result/${job_id}`;
          const r = await fetch(pollUrl);
          
          if (r.status === 200) {
            const json = await r.json();
            resultData = json?.result ?? null;
            console.log("✅ Data received from backend:", resultData);
            break;
          }
        } catch (pollError) {
          // Ignore intermittent polling errors
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      if (resultData == null) {
        setResponse({ error: "Timed out waiting for result. Please try again." });
      } else {
        setResponse(
          typeof resultData === "string"
            ? JSON.parse(resultData) // if backend sends a JSON string
            : resultData
        );
        setDone(true);
        try {
          localStorage.setItem(
            RESPONSE_KEY,
            typeof resultData === "string" ? resultData : JSON.stringify(resultData)
          );
        } catch (_) {}
      }
    } catch (err) {
      console.error("Error calling backend:", err);
      setResponse({ error: "Failed to connect to backend" });
    } finally {
      setLoading(false);
      try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
    }
  };

  const inputFields = [
    { label: "Current Script", name: "currentScript", placeholder: "Enter Current Script", type: "textarea", require: true },
    { label: "Winning Angle", name: "winningAngle", placeholder: "Enter Winning Angle", type: "text", require: true },
    { label: "Inspiration", name: "inspiration", placeholder: "Enter Inspiration", type: "textarea", require: true },
    {label:"Choose Model", name:"model", type:"select", options:["Kling", "Sora 2"," Veo 3","Veo 3.1"], defaultValue: "Kling", require: true},
  ];

  return (
    <ScreenLayout>
      <Button
        variant="secondary"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          background: "linear-gradient(to right, #3b82f6, #6366f1)",
          color: "white",
          fontWeight: "500",
          borderRadius: "9999px",
          border: "none",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          transition: "all 0.3s",
        }}
        onMouseOver={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
        onMouseOut={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
        onClick={() => {
          try { localStorage.removeItem("screen5FormData"); } catch (_) {}
          try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
          try { localStorage.removeItem(RESPONSE_KEY); } catch (_) {}
          setFormData({
            currentScript: "",
            winningAngle: "",
            inspiration: "",
          });
          setResponse(null);
          setDone(false);
        }}
      >
        Clear Inputs
      </Button>
      <h1 className="text-2xl font-bold text-white mt-8 mb-4 bg-gradient-primary bg-clip-text text-transparent">
        {activeTab}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {inputFields.map((field) => (
            <div key={field.name}>
              <div className="flex items-center justify-between mb-2">
            </div>
            <InputSection
              fields={[
                {
                  ...field,
                },
              ]}
              onChange={handleInputChange}
              values={formData}
              errors={validationErrors}
            />
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {loading && (
            <div
              className="mt-6 p-6 bg-card rounded-md shadow-soft text-sm text-muted-foreground"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                maxHeight: "200px",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>⏳ IN QUEUE</div>
              <div style={{ fontSize: 13, opacity: 0.9, textAlign: "center" }}>
                Request received. Processing may take up to <strong>10–20 minutes</strong>.
                The server is working — you can go to other screens, results will remain here when ready.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 8, background: "#3b82f6", animation: "bounce 0.6s infinite alternate" }} />
                <div style={{ width: 8, height: 8, borderRadius: 8, background: "#60a5fa", animation: "bounce 0.6s 0.15s infinite alternate" }} />
                <div style={{ width: 8, height: 8, borderRadius: 8, background: "#93c5fd", animation: "bounce 0.6s 0.3s infinite alternate" }} />
              </div>

              {/* Small keyframe injected inline since we used style prop */}
              <style>{`
                @keyframes bounce {
                  from { transform: translateY(0); opacity: 1; }
                  to { transform: translateY(-6px); opacity: 0.7; }
                }
              `}</style>
            </div>
          )}
          {response && !response.error && response[0]?.videoUrlsArray?.length > 0 && (
            <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
              <h3 className="text-sm font-medium mb-2 text-foreground/80">🎬 Generated Videos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 justify-items-center">
                {response[0].videoUrlsArray.map((videoUrl, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <video
                      src={videoUrl}
                      controls
                      style={{ width: "160px", height: "160px", objectFit: "cover" }}
                      className="rounded-lg border border-border/20"
                    />
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = videoUrl;
                        a.download = `video_${i + 1}.mp4`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      }}
                      style={{
                        padding: "8px 16px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        background: "#3b82f6",
                        color: "white",
                        border: "none",
                        cursor: "pointer",
                      }}
                      className="px-3 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center mt-10">
        {!done ? (
        <Button
          onClick={handleSubmit}
          disabled={loading}
          variant="default"
          style={{
                flex: 1,
                textAlign: "center",
                padding: "12px 16px",
                borderRadius: "9999px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.3s",
                background: "linear-gradient(to right, #3b82f6, #6366f1)",
                color: "white",
                border: "none",
                outline: "none",
            }}>
          {loading ? "Processing..." : "Generate"}
        </Button>
        ) : (
        <Button
          onClick={() => {
              setSharedDataForScreen6(response);
              setActiveTab("screen6");
            }}
            disabled={loading}
            variant="default"
            style={{
              flex: 1,
              textAlign: "center",
              padding: "12px 16px",
              borderRadius: "9999px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.3s",
              background: "linear-gradient(to right, #6366f1, #10b981)",
              color: "white",
              border: "none",
              outline: "none",
            }}
        >
          {loading ? "Uploading..." : "Go to Screen 6"}
        </Button>
        )}
      </div>
    </ScreenLayout>
  );
};
