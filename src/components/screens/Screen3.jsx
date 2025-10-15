import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { InsightsSection } from "@/components/InsightsSection";
import { marked } from "marked";
import { generateJobId } from "@/lib/utils";


// const Screen3URL = "https://wholesomegoods.app.n8n.cloud/webhook/c7f59618-7cec-4264-9ecb-e6fcd95a6892";
// const Screen3URL = "http://localhost:8000/v1/screen3"
const Screen3URL = "https://wholesomegoods.app.n8n.cloud/webhook/b6e95acd-b2c8-46fa-9a92-90ae55bc8a5f"

export const Screen3 = ({ response, setResponse, sharedData, setActiveTab, setSharedDataForScreen4 }) => {
  const [activeTab] = useState("Screen 3");
  const [formData, setFormData] = useState({
    scripts: sharedData?.currentScriptIndex || "",
    insightsMatch: sharedData?.insightsMatch || "",
    imgUrl: sharedData?.imgUrl || "",
    voiceStyle: "Rachel-American-calm-young-female",
    voiceSpeed:"1.0",
  });
  const [loading, setLoading] = useState(false);
  const [scriptList, setScriptList] = useState([]);
  const [currentScriptIndex, setCurrentScriptIndex] = useState(0);
  const [done, setDone] = useState(false);  

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
    { label: "Image URL", name: "imgUrl", placeholder: "Image URL from previous screen" },
    { label: "Scripts", name: "scripts", placeholder: "Script from previous screen" },
    { label: "Insights", name: "insightsMatch", placeholder: "Insights from previous screen" },
    { label: "VOICE STYLE", name: "voiceStyle", type: "select", options: voiceStyle },
    { label: "VOICE SPEED", name: "voiceSpeed", type: "select", options: voiceSpeed },
    ];

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Normalize response into an HTML string for parsing-dependent UI
  const getHtmlFromResponse = (resp) => {
    if (!resp) return "";
    if (typeof resp === "string") return resp;
    if (resp && typeof resp === "object") {
      if (typeof resp.formattedOutput === "string") return resp.formattedOutput;
      // Some flows may wrap HTML under a generic key
      if (typeof resp.html === "string") return resp.html;
      // Fallback: stringify objects for visibility
      try {
        return JSON.stringify(resp);
      } catch (_) {
        return String(resp);
      }
    }
    return String(resp);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResponse(null);

    const job_id = generateJobId();
    const callback_url = `${window.location.protocol}//${window.location.hostname}:5174/callback`;
    const dataToSend = { ...formData, job_id, callback_url };

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
    //   const data = await res.text();
      // Poll for result from callback server
      const pollStart = Date.now();
      const pollTimeoutMs = 20 * 60 * 1000; // 20 minutes
      const pollIntervalMs = 1500;
      let resultData = null;
      while (Date.now() - pollStart < pollTimeoutMs) {
        try {
          const r = await fetch(`http://${window.location.hostname}:5174/result/${job_id}`);
          if (r.status === 200) {
            const json = await r.json();
            resultData = json?.result ?? null;
            break;
          }
        } catch (e) {}
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      if (resultData == null) {
        setResponse({ error: "Timed out waiting for result" });
      } else {
        setResponse(resultData);
        setDone(true);
      }
    } catch (err) {
      console.error("Error calling backend:", err);
      setResponse({ error: "Failed to connect to backend" });
    } finally {
      setLoading(false);
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
            />            
            </div>

            {/* RIGHT COLUMN — optional extra content */}
            <div className="lg:col-span-2 space-y-6">
                {/* Product Images */}
                {response && !response.error && (() => {
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
                    className="mt-2 px-3 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
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
            className={`w-full max-w-[320px] text-lg px-10 py-4 rounded-2xl border-t-transparent transition-all duration-300 ease-in-out ${
                loading ? "opacity-70" : ""
            }`}
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
            className="w-full max-w-[320px] text-lg px-10 py-4 rounded-2xl border-t-transparent transition-all duration-300 ease-in-out"
            >
            🚀 Go to Screen 4
            </Button>
        )}
        </div>
    </ScreenLayout>
  );
};
