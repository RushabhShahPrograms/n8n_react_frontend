import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { InsightsSection } from "@/components/InsightsSection";
import { marked } from "marked";
import { generateJobId } from "@/lib/utils";


// const Screen2URL = "https://wholesomegoods.app.n8n.cloud/webhook/ab94aeee-3fc4-4d47-be04-a20b701fafd8";
// const Screen2URL = "http://localhost:8000/v1/screen2"
const Screen2URL = "https://wholesomegoods.app.n8n.cloud/webhook/49b35a96-aad0-4a57-ade2-f170d0d2370c"

export const Screen2 = ({ response, setResponse, sharedData, setActiveTab, setSharedDataForScreen3 }) => {
  const [activeTab] = useState("Screen 2");
  const [formData, setFormData] = useState({
    productUrl: sharedData?.productUrl || "",
    winningAngle: sharedData?.winningAngle || "",
    ctaHook: "",
  });
  const [loading, setLoading] = useState(false);
  const [scriptList, setScriptList] = useState([]);
  const [currentScriptIndex, setCurrentScriptIndex] = useState(0);
  const [done, setDone] = useState(false);

  const inputFields = [
    { label: "Product URL", name: "productUrl", placeholder: "Enter product URL" },
    { label: "Winning Angle", name: "winningAngle", placeholder: "Describe the winning angle" },
    { label: "CTA HOOK", name: "ctaHook", placeholder: "Add CTA Hook" },
  ];

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        Screen2URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSend),
        }
      );
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
        setResponse(typeof resultData === "string" ? resultData : JSON.stringify(resultData));
        setDone(true);
      }
    } catch (err) {
      console.error("Error calling backend:", err);
      setResponse({ error: "Failed to connect to backend" });
    } finally {
      setLoading(false);
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
  useEffect(() => {
    // When sharedData comes from MainScreen, populate form fields
    if (sharedData && Object.keys(sharedData).length > 0) {
      setFormData((prev) => ({
        ...prev,
        productUrl: prev.productUrl || sharedData.productUrl || "",
        winningAngle: prev.winningAngle || sharedData.winningAngle || "",
      }));
    }

    if (!response || response.error) {
      setScriptList([]);
      setCurrentScriptIndex(0);
      return;
    }

    // Extract all <div class="script"> blocks
    const scripts = [...response.matchAll(/<div class="script">(.*?)<\/div>/gs)].map(
      (m) => m[1]
    );

    // Extract "Based on Insights" section
    const insightsMatch = response.match(/<h3>Based on Insights:<\/h3>([\s\S]*)/);
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
        {/* LEFT COLUMN — Input + small image preview */}
        <div className="lg:col-span-1 space-y-6">
          <InputSection title="Input Text" fields={inputFields} onChange={handleInputChange} values={formData}/>

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
              const insightsMatch = response.match(/<h3>Based on Insights:<\/h3>([\s\S]*)/);
                let insights = "";
                if (insightsMatch) {
                  const markdownText = insightsMatch[1];
                  insights = `<h3>Based on Insights:</h3>` + marked(markdownText);
                }
              setSharedDataForScreen3({
                insightsMatch: insights,
                imgUrl: extractImageURLFromResponse(response),
                currentScriptIndex:scriptList[currentScriptIndex],
              });
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
            className="w-full max-w-[320px] text-lg px-10 py-4 rounded-2xl border-t-transparent transition-all duration-300 ease-in-out"
          >
            🚀 Go to Screen 3
          </Button>
        )}
      </div>
    </ScreenLayout>
  );
};
