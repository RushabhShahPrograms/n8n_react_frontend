import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { marked } from "marked";
import { generateJobId } from "@/lib/utils";


const Screen3URL = "https://wholesomegoods.app.n8n.cloud/webhook/b6e95acd-b2c8-46fa-9a92-90ae55bc8a5f";
// const Screen3URL = "https://wholesomegoods.app.n8n.cloud/webhook-test/b6e95acd-b2c8-46fa-9a92-90ae55bc8a5f"

export const Screen3 = ({ response, setResponse, sharedData, setActiveTab, setSharedDataForScreen4 }) => {
  const [activeTab] = useState("Images/Voice");
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("screen3FormData");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      scripts: sharedData?.currentScriptIndex || "",
      insightsMatch: sharedData?.insightsMatch || "",
      imgUrl: sharedData?.imgUrl || "",
      voiceStyle: "Rachel-American-calm-young-female",
      voiceSpeed:"1.0",
      model: sharedData?.model || "Image-Gen",
    };
  });
  const [loading, setLoading] = useState(false);
  const [scriptList, setScriptList] = useState([]);
  const [currentScriptIndex, setCurrentScriptIndex] = useState(0);
  const [done, setDone] = useState(false);  
  const JOB_STATE_KEY = "screen3JobState"; // { job_id, pollStartMs, loading, done }
  const RESPONSE_KEY = "screen3Response"; // stringified html or object

  const voiceStyle = ["Rachel-American-calm-young-female",
                    "Drew-American-well-rounded-middle_aged-male",
                    "Clyde-American-war_veteran-middle_aged-male",
                    "Paul-American-authoritative-middle_aged-male",
                    "Aria-American-husky-middle_aged-female", 
                    "Domi-American-strong-young-female",
                    "Dave-British-conversational-young-male",
                    "Roger-confident-middle_aged-male",
                    "Fin-Irish-sailor-old-male",
                    "Sarah-American-professional-young-female"];
  const voiceSpeed = ["1.0", "1.1", "1.2"];

  const inputFields = [
    { label: "Image URL", name: "imgUrl", placeholder: "Image URL from previous screen", required: true },
    { label: "Scripts", type: "textarea", name: "scripts", placeholder: "Script from previous screen", required: true },
    { label: "Insights", type: "textarea", name: "insightsMatch", placeholder: "Insights from previous screen", required: true },
    { label:"Choose Model", name:"model", type:"select", options:["Image-Gen", "Neno-Banana"]},
    { label: "VOICE STYLE", name: "voiceStyle", type: "select", options: voiceStyle, required: true },
    { label: "VOICE SPEED", name: "voiceSpeed", type: "select", options: voiceSpeed, required: true },
    ];

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto-save to localStorage
  useEffect(() => {
    try { localStorage.setItem("screen3FormData", JSON.stringify(formData)); } catch (_) {}
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
            setResponse(resultData);
            setDone(true);
            try { localStorage.setItem(RESPONSE_KEY, typeof resultData === "string" ? resultData : JSON.stringify(resultData)); } catch (_) {}
          }
          break;
        }
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    setLoading(false);
    try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
  };

  // On mount: restore job state/response and resume if needed
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(JOB_STATE_KEY);
      const savedResponse = localStorage.getItem(RESPONSE_KEY);
      if (savedResponse && !response) {
        try {
          setResponse(JSON.parse(savedResponse));
        } catch (_) {
          setResponse(savedResponse);
        }
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

  const getHtmlFromResponse = (resp) => {
    if (!resp) return "";
    if (typeof resp === "string") return resp;
    if (resp && typeof resp === "object") {
      if (typeof resp.formattedOutput === "string") return resp.formattedOutput;
      if (typeof resp.html === "string") return resp.html;
      try {
        return JSON.stringify(resp);
      } catch (_) {
        return String(resp);
      }
    }
    return String(resp);
  };

    const [validationErrors, setValidationErrors] = useState({});

  const handleSubmit = async () => {

    // Validate form fields
    const errors = {};
    inputFields.forEach((field) => {
      if (field.required && !formData[field.name]) {
        errors[field.name] = `${field.label} is required`;
      }
    });
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;


    setLoading(true);
    setResponse(null);
    setDone(false);
    const job_id = generateJobId();
    const callback_url = `${window.location.origin}/callback`;
    const dataToSend = {
       ...formData, 
       job_id,
       callback_url,
       model: formData?.model || "Image-Gen",
      };

    console.log("Data sent to backend:", dataToSend);
    try {
      const res = await fetch(
        Screen3URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSend),
        }
      );
      if (!res.ok) {
        throw new Error(`n8n returned ${res.status}`);
      }

      // Persist job state and begin polling
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
        setResponse(resultData);
        setDone(true);
        try { localStorage.setItem(RESPONSE_KEY, typeof resultData === "string" ? resultData : JSON.stringify(resultData)); } catch (_) {}
      }
    } catch (err) {
      console.error("Error calling backend:", err);
      setResponse({ error: `Failed: ${err.message}` });
    } finally {
      setLoading(false);
      try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
    }
  };

  const downloadImage = async (url, filename) => {
    try {
        // Fetch the image as blob (use a proxy if CORS blocks)
        const res = await fetch(url, { mode: "no-cors" });
        const blob = await res.blob();

        // Create a blob URL and trigger download
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        // Cleanup
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error("Failed to download image:", err);
        alert(
        "Download failed due to browser CORS restrictions. Right-click the image and select 'Save as...' instead."
        );
    }
    };

  // Parse response into scripts and insights
  useEffect(() => {
    if (!response || response.error) {
      setScriptList([]);
      setCurrentScriptIndex(0);
      return;
    }
    const html = getHtmlFromResponse(response);
    if (!html || typeof html !== "string") {
      setScriptList([]);
      setCurrentScriptIndex(0);
      return;
    }
    // Extract all <div class="script"> blocks
    const scripts = [...html.matchAll(/<div class="script">(.*?)<\/div>/gs)].map(
      (m) => m[1]
    );

    // Extract "Based on Insights" section
    const insightsMatch = html.match(/<h3>Based on Insights:<\/h3>([\s\S]*)/);
    let insights = null;
    if (insightsMatch) {
      const markdownText = insightsMatch[1];
      const html = `<h3>Based on Insights:</h3>` + marked(markdownText);
      insights = html;
    }

    setScriptList([...scripts, insights].filter(Boolean));
    setCurrentScriptIndex(0);
  }, [response, sharedData]);

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
            try { localStorage.removeItem("screen3FormData"); } catch (_) {}
            try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
            try { localStorage.removeItem(RESPONSE_KEY); } catch (_) {}
            setFormData({
              scripts: "",
              insightsMatch: "",
              imgUrl: "",
              voiceStyle: "Rachel-American-calm-young-female",
              voiceSpeed:"1.0",
              model: "Image-Gen",
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
            {/* LEFT COLUMN — Input + Generated Content */}
            <div className="lg:col-span-1 space-y-6">
            <InputSection
                title="Input Text"
                fields={inputFields}
                onChange={handleInputChange}
                values={formData}
                errors={validationErrors}
            />            
            </div>

            {/* RIGHT COLUMN — optional extra content */}
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
              {/* Product Images */}
              {response && !response.error && (() => {
                // Product Images
                const html = getHtmlFromResponse(response);
                const productImages = (() => {
                    const sectionMatch = html.match(/<h3>Generated Product Image URLs:<\/h3>([\s\S]*?)(<h3>|$)/i);
                    if (!sectionMatch) return [];
                    return Array.from(sectionMatch[1].matchAll(/<li>(https?:\/\/[^\s<]+)<\/li>/gi), m => m[1]);
                    })();

                if (!productImages.length) return null;

                return (
                <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
                    <h3 className="text-sm font-medium mb-2 text-foreground/80">🖼️ Product Images</h3>
                    <div className="flex flex-wrap justify-center gap-3">
                    {productImages.map((imgUrl, index) => (
                        <div key={index} className="flex flex-col items-center gap-2">
                        <img
                            src={imgUrl}
                            alt={`Product ${index + 1}`}
                            style={{ width: "120px", height: "120px", objectFit: "cover" }}
                            className="rounded-lg border border-border/30 shadow-md hover:scale-105 transition-transform duration-300 cursor-pointer"
                        />
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
                            className="px-3 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                        >
                            Download
                        </button>
                        </div>
                    ))}
                    </div>
                </div>
                );
            })()}

            {/* Lifestyle Images */}
            {response && !response.error && (() => {
                const html = getHtmlFromResponse(response);
                const lifestyleImages = (() => {
                    const sectionMatch = html.match(/<h3>Generated LifeStyle Image URLs:<\/h3>([\s\S]*?)(<h3>|$)/i);
                    if (!sectionMatch) return [];
                    return Array.from(sectionMatch[1].matchAll(/<li>(https?:\/\/[^\s<]+)<\/li>/gi), m => m[1]);
                    })();


                if (!lifestyleImages.length) return null;

                return (
                <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
                    <h3 className="text-sm font-medium mb-2 text-foreground/80">🌟 Lifestyle Images</h3>
                    <div className="flex flex-wrap justify-center gap-3">
                    {lifestyleImages.map((imgUrl, index) => (
                        <div key={index} className="flex flex-col items-center gap-2">
                        <img
                            src={imgUrl}
                            alt={`Lifestyle ${index + 1}`}
                            style={{ width: "120px", height: "120px", objectFit: "cover" }}
                            className="rounded-lg border border-border/30 shadow-md hover:scale-105 transition-transform duration-300 cursor-pointer"
                        />
                        <button
                            onClick={() => downloadImage(imgUrl, `lifestyle_image_${index + 1}.png`)}
                            style={{
                                padding: "4px 8px",
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
                );
            })()}

            {/* VoiceOver */}
            {response && !response.error && (() => {
                const html = getHtmlFromResponse(response);
                const voiceUrl = (() => {
                    const sectionMatch = html.match(/<h3>Generated Voice URL:<\/h3>([\s\S]*?)(<h3>|$)/i);
                    if (!sectionMatch) return null;
                    const urlMatch = sectionMatch[1].match(/https?:\/\/[^\s<]+/i);
                    return urlMatch ? urlMatch[0] : null;
                    })();

                if (!voiceUrl) return null;

                return (
                <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
                    <h3 className="text-sm font-medium mb-2 text-foreground/80">🎤 VoiceOver</h3>
                    <audio controls className="w-full mt-2">
                    <source src={voiceUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                    </audio>
                    <button
                    onClick={() => window.open(voiceUrl, "_blank")}
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
                    Download Voice
                    </button>
                </div>
                );
            })()}
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
            <Button
            onClick={() => {
                setSharedDataForScreen4({
                currentScript: formData.scripts,
                });
                setActiveTab("screen4");
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
             Go to Screen 4
            </Button>
        )}
        </div>
    </ScreenLayout>
  );
};
