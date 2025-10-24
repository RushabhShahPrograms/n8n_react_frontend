import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { marked } from "marked";
import { generateJobId } from "@/lib/utils";


const Screen2URL = "https://wholesomegoods.app.n8n.cloud/webhook/49b35a96-aad0-4a57-ade2-f170d0d2370c";
// const Screen2URL = "https://wholesomegoods.app.n8n.cloud/webhook-test/49b35a96-aad0-4a57-ade2-f170d0d2370c"

export const Screen2 = ({ response, setResponse, sharedData, setActiveTab, setSharedDataForScreen3, setSharedDataForScreen5, clearSharedData }) => {
  const [activeTab] = useState("AIDA Script");
  const [formData, setFormData] = useState(() => {
    // Restore from localStorage, fall back to sharedData
    try {
      const saved = localStorage.getItem("screen2FormData");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      productUrl: sharedData?.productUrl || "",
      winningAngle: sharedData?.winningAngle || "",
      ctaHook: "",
    };
  });
  const [loading, setLoading] = useState(false);
  const [scriptList, setScriptList] = useState([]);
  const [currentScriptIndex, setCurrentScriptIndex] = useState(0);
  const [done, setDone] = useState(false);
  const JOB_STATE_KEY = "screen2JobState"; // { job_id, pollStartMs, loading, done }
  const RESPONSE_KEY = "screen2Response"; // stringified html

  const inputFields = [
    { label: "Product URL", name: "productUrl", placeholder: "Enter product URL", required: true },
    { label: "Winning Angle", name: "winningAngle", placeholder: "Describe the winning angle", required: true },
    { label: "CTA HOOK", name: "ctaHook",  placeholder: "Add CTA Hook", required: true },
  ];

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("screen2FormData", JSON.stringify(formData));
    } catch (_) {}
  }, [formData]);

  // Persist response whenever it changes
  useEffect(() => {
    try {
      if (response && !response.error) {
        localStorage.setItem(RESPONSE_KEY, typeof response === "string" ? response : JSON.stringify(response));
      }
    } catch (_) {}
  }, [response]);

  // Helper: polling loop (resumable)
  const resumePolling = async (job_id, existingPollStartMs) => {
    const pollTimeoutMs = 20 * 60 * 1000;
    const pollIntervalMs = 2000;
    const pollStart = existingPollStartMs || Date.now();

    setLoading(true);
    setDone(false);

    while (Date.now() - pollStart < pollTimeoutMs) {
      try {
        const pollUrl = `${window.location.origin}/result/${job_id}`;
        const r = await fetch(pollUrl);
        if (r.status === 200) {
          const json = await r.json();
          const resultData = json?.result ?? null;
          if (resultData == null) {
            setResponse({ error: "Timed out waiting for result. Please try again." });
          } else {
            setResponse(typeof resultData === "string" ? resultData : JSON.stringify(resultData));
            setDone(true);
            try {
              localStorage.setItem(RESPONSE_KEY, typeof resultData === "string" ? resultData : JSON.stringify(resultData));
            } catch (_) {}
          }
          break;
        }
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    setLoading(false);
    // Clear job state on finish or timeout
    try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
  };

  // On mount: restore job state/response and resume if needed
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(JOB_STATE_KEY);
      const savedResponse = localStorage.getItem(RESPONSE_KEY);
      if (savedResponse && !response) {
        setResponse(savedResponse);
        setDone(true);
      }
      if (savedState) {
        const { job_id, pollStartMs, loading: wasLoading, done: wasDone } = JSON.parse(savedState);
        if (wasLoading && !wasDone && job_id) {
          resumePolling(job_id, pollStartMs);
        } else if (wasDone && savedResponse) {
          setDone(true);
        }
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


    // State for validation errors
  const [validationErrors, setValidationErrors] = useState({});

  const handleSubmit = async () => {

    // Validate required fields before submission
    const errors = {};
    let hasErrors = false;
    inputFields.forEach((field) => {
      if (field.required && !formData[field.name]) {
        errors[field.name] = `${field.label} is required`;
        hasErrors = true;
      }
    });

    setValidationErrors(errors);
    if (hasErrors) return;

    // Clear any previous validation errors
    setValidationErrors({});

    setLoading(true);
    setResponse(null);
    setDone(false);
    const job_id = generateJobId();
    const callback_url = `${window.location.origin}/callback`;
    const dataToSend = { ...formData, job_id, callback_url };

    console.log("Data sent to backend:", dataToSend);
    try {
      const res = await fetch(Screen2URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) {
        throw new Error(`n8n returned ${res.status}`);
      }

      // Persist job state and begin polling
      const pollStart = Date.now();
      try {
        localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ job_id, pollStartMs: pollStart, loading: true, done: false }));
      } catch (_) {}
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
        setResponse(typeof resultData === "string" ? resultData : JSON.stringify(resultData));
        setDone(true);
        try {
          localStorage.setItem(RESPONSE_KEY, typeof resultData === "string" ? resultData : JSON.stringify(resultData));
        } catch (_) {}
      }
    } catch (err) {
      console.error("Error calling backend:", err);
      setResponse({ error: `Failed: ${err.message}` });
    } finally {
      setLoading(false);
      try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
    }
  };

  const extractImageURLFromResponse = (response) => {
    const imageMatches = response.match(/https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp)/gi);
    return imageMatches && imageMatches.length > 0 ? imageMatches[0] : "";
  };

  const downloadImage = async (url, filename) => {
    try {
      const res = await fetch(url, { mode: "cors" }); // fetch the image
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(blobUrl); // cleanup
    } catch (err) {
      console.error("Failed to download image:", err);
    }
  };

  // Parse response into scripts and insights
  // *** FIX PART 2: Replace the problematic logic in this useEffect ***
  useEffect(() => {
    // When sharedData comes from MainScreen, populate form fields
    if (sharedData && Object.keys(sharedData).length > 0) {
      setFormData((prev) => {
        // Check if the form is empty before populating it
        const isFormEmpty = !prev.productUrl && !prev.winningAngle;
        if (isFormEmpty) {
          return {
            ...prev,
            productUrl: sharedData.productUrl || "",
            winningAngle: sharedData.winningAngle || "",
          };
        }
        // If the form is not empty, do not change it
        return prev;
      });

      // After using the data, call the function to clear it from the parent
      if (clearSharedData) {
        clearSharedData();
      }
    }

    // --- The rest of this hook's logic is fine ---
    if (response && !response.error) {
      setDone(true);
    } else {
      setDone(false);
    }

    if (!response || response.error) {
      setScriptList([]);
      setCurrentScriptIndex(0);
      return;
    }

    const scripts = [...response.matchAll(/<div class="script">(.*?)<\/div>/gs)].map(
      (m) => m[1]
    );

    const insightsMatch = response.match(/<h3>Based on Insights:<\/h3>([\s\S]*)/);
    let insights = null;
    if (insightsMatch) {
      const markdownText = insightsMatch[1];
      const html = `<h3>Based on Insights:</h3>` + marked(markdownText);
      insights = html;
    }

    setScriptList([...scripts, insights].filter(Boolean));
    setCurrentScriptIndex(0);
  // *** FIX PART 3: Add `clearSharedData` to the dependency array ***
  }, [response, sharedData, clearSharedData]);

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
        onMouseOver={(e) => {
          e.currentTarget.style.filter = "brightness(1.1)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.filter = "brightness(1)";
        }}
        onClick={() => {
          try { localStorage.removeItem("screen2FormData"); } catch (_) {}
          try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
          try { localStorage.removeItem(RESPONSE_KEY); } catch (_) {}
          setFormData({
            productUrl: "",
            winningAngle: "",
            ctaHook: "",
          });
          setResponse(null);
          setDone(false);
        }}
      >
        Clear Inputs
      </Button>
      {/* Title */}
      <h1 className="text-2xl font-bold text-white mt-8 mb-4 bg-gradient-primary bg-clip-text text-transparent">
        {activeTab}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN — Input + small image preview */}
        <div className="lg:col-span-1 space-y-6">
          <InputSection title="Input Text" fields={inputFields} onChange={handleInputChange} values={formData} errors={validationErrors} />

          {/* Small image section */}
          {response && !response.error && (() => {
            const imageMatches = response.match(/https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp)/gi);
            if (!imageMatches || imageMatches.length === 0) return null;

            return (
              <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
                <h3 className="text-sm font-medium mb-2 text-foreground/80">🖼️ Product Images</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {imageMatches.map((imgUrl, index) => (
                    <div key={index} className="flex flex-col items-center gap-2">
                      {/* Image preview */}
                      <img
                        src={imgUrl}
                        alt={`Generated product ${index + 1}`}
                        style={{ width: "120px", height: "120px", objectFit: "cover" }}
                        className="rounded-lg border border-border/30 shadow-md hover:scale-105 transition-transform duration-300 cursor-pointer"
                      />

                      {/* Download button */}
                      <button
                        onClick={() => downloadImage(imgUrl, `product_image_${index + 1}.png`)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "12px",
                          borderRadius: "6px",
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* RIGHT COLUMN — Script carousel */}
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
          {scriptList.length > 0 && (
            <div className="mt-6 bg-card rounded-xl shadow-md p-6 text-foreground overflow-auto max-h-[500px]">
              {currentScriptIndex === scriptList.length - 1 ? (
                // Last page: Based on Insights
                <div
                  style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}
                  dangerouslySetInnerHTML={{ __html: scriptList[currentScriptIndex] }}
                  className="prose prose-sm [&_p]:my-2 [&_h2]:text-xl [&_h3]:text-lg [&_h2]:font-bold [&_h3]:font-semibold"
                />
              ) : (
                // Other script pages
                <div
                  dangerouslySetInnerHTML={{ __html: scriptList[currentScriptIndex] }}
                  className="prose prose-sm [&_p]:my-2 [&_h2]:text-xl [&_h3]:text-lg [&_h2]:font-bold [&_h3]:font-semibold"
                />
              )}

              {/* Navigation */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
                <button
                  onClick={() => setCurrentScriptIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={currentScriptIndex === 0}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    background: "linear-gradient(to right, #3b82f6, #6366f1)", // blue → indigo
                    color: "white",
                    fontWeight: "500",
                    borderRadius: "9999px", // pill shape
                    border: "none",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    cursor: currentScriptIndex === 0 ? "not-allowed" : "pointer",
                    opacity: currentScriptIndex === 0 ? 0.5 : 1,
                    transition: "all 0.3s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.filter = "brightness(1.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.filter = "brightness(1)";
                  }}
                >
                  <span style={{ fontSize: "18px" }}>←</span> Previous
                </button>

                <span style={{ fontSize: "14px", color: "#9ca3af", fontWeight: "500" }}>
                  {currentScriptIndex + 1} / {scriptList.length}
                </span>

                <button
                  onClick={() =>
                    setCurrentScriptIndex((prev) => Math.min(prev + 1, scriptList.length - 1))
                  }
                  disabled={currentScriptIndex === scriptList.length - 1}
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
                    cursor: currentScriptIndex === scriptList.length - 1 ? "not-allowed" : "pointer",
                    opacity: currentScriptIndex === scriptList.length - 1 ? 0.5 : 1,
                    transition: "all 0.3s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.filter = "brightness(1.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.filter = "brightness(1)";
                  }}
                >
                  Next <span style={{ fontSize: "18px" }}>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {response && response.error && (
            <div className="mt-6 p-6 bg-card rounded-md shadow-soft text-sm text-red-500">
              {response.error}
            </div>
          )}
        </div>
      </div><br/>

      {/* Backend Submit Button */}
      <div className="flex justify-center mt-10">
        {!done ? (
          <Button
            onClick={handleSubmit}
            disabled={loading}
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
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center space-x-2">
                <span className="h-4 w-4 border-t-transparent rounded-full animate-spin border-white"></span>
                <span>Generating...</span>
              </span>
            ) : (
              "✨ Generate Content"
            )}
          </Button>
        ) : (
          <div className="flex gap-4 w-full max-w-2xl">
            <Button
              onClick={() => {
                const insightsMatch = response.match(/<h3>Based on Insights:<\/h3>([\s\S]*)/);
                let insights = "";
                if (insightsMatch) {
                  const markdownText = insightsMatch[1];
                  insights = `<h3>Based on Insights:</h3>` + marked(markdownText);
                }
                
                // Prepare a comprehensive data object for other screens
                const dataToShare = {
                  // For Screen 3
                  insightsMatch: insights,
                  imgUrl: extractImageURLFromResponse(response),
                  currentScriptIndex: scriptList[currentScriptIndex],

                  // For Screen 5
                  currentScript: scriptList[currentScriptIndex],
                  winningAngle: formData.winningAngle,
                  inspiration: insights,
                };

                setSharedDataForScreen3(dataToShare);
                setActiveTab("screen3");
              }}
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
               Go to Image-Voice Generation
            </Button>
            
            <Button
              onClick={() => {
                const insightsMatch = response.match(/<h3>Based on Insights:<\/h3>([\s\S]*)/);
                let insights = "";
                if (insightsMatch) {
                  const markdownText = insightsMatch[1];
                  insights = `<h3>Based on Insights:</h3>` + marked(markdownText);
                }
                
                // Prepare data for Screen 5
                const dataToShare = {
                  currentScript: scriptList[currentScriptIndex],
                  winningAngle: formData.winningAngle,
                  inspiration: insights,
                };

                setSharedDataForScreen5(dataToShare);
                setActiveTab("screen5");
              }}
              variant="default"
              style={{
                flex: 1,
                textAlign: "center",
                padding: "12px 16px",
                borderRadius: "9999px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.3s",
                background: "linear-gradient(to right, #f59e0b, #ef4444)",
                color: "white",
                border: "none",
                outline: "none",
              }}
            >
               Go to Text to Video
            </Button>
          </div>
        )}
      </div>
    </ScreenLayout>
  );
};