import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";

const Screen4URL = "http://localhost:8000/v1/screen4";

export const Screen4 = ({ response, setResponse, sharedData }) => {
  const [activeTab] = useState("Screen 4");
  const [formData, setFormData] = useState({
    scripts: sharedData?.currentScript || ""
  });
  console.log("Shared Data:", sharedData);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [loading, setLoading] = useState(false);  

  // Handle manual text input
  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle local uploads
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImages((prev) => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResponse(null);

    const job_id = generateJobId();
    const callback_url = `${window.location.protocol}//${window.location.hostname}:5174/callback`;
    const dataToSend = {
      scripts: formData.scripts,
      imgUrls: formData.imgUrls,
      uploadedImages,
      job_id,
      callback_url,
    };

    console.log("📤 Data sent to backend:", dataToSend);

    try {
  const res = await fetch(Screen4URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dataToSend),
  });

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
  }
} catch (err) {
  console.error("❌ Error calling backend:", err);
  setResponse({ error: "Failed to connect to backend" });
} finally {
  setLoading(false);
}
  };

  useEffect(() => {
    if (sharedData) {
        setFormData({
        scripts: sharedData.currentScript || "",
        });
    }
    }, [sharedData]);

  return (
    <ScreenLayout>
      <h1 className="text-2xl font-bold text-white mt-8 mb-4 bg-gradient-primary bg-clip-text text-transparent">
        {activeTab}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN — Inputs + Uploads */}
        <div className="lg:col-span-1 space-y-6">
          <InputSection
            title="Input Data"
            fields={[
              { label: "Script", name: "scripts", placeholder: "Script from previous screen" },
              { label: "Image URLs", name: "imgUrls", placeholder: "Add one or multiple image URLs" },
            ]}
            onChange={handleInputChange}
            values={formData}
          />

          {/* Upload section */}
          <div className="bg-muted/40 border border-border/30 rounded-xl p-4">
            <h3 className="text-sm font-medium mb-2 text-foreground/80">📁 Upload Images</h3>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 
                         file:rounded-full file:border-0 file:text-sm file:font-semibold 
                         file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
            {uploadedImages.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {uploadedImages.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`upload-${i}`}
                    style={{ width: "120px", height: "120px", objectFit: "cover" }}
                    className="w-20 h-20 object-cover rounded-lg border border-border/20"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN — Output preview */}
        <div className="lg:col-span-2 space-y-6">
        {/* Video Previews */}
        {response && !response.error && response[0]?.videoUrlsArray?.length > 0 && (
            <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
                <h3 className="text-sm font-medium mb-2 text-foreground/80">🎬 Generated Videos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 justify-items-center">
                {response[0].videoUrlsArray.map((videoUrl, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                    <video
                        src={videoUrl}
                        controls
                        style={{ width: "120px", height: "120px", objectFit: "cover" }}
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
            )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-center mt-10">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full max-w-[320px] text-lg px-10 py-4 rounded-2xl border-t-transparent transition-all duration-300 ease-in-out ${
            loading ? "opacity-70" : ""
          }`}
          style={{
            background: "linear-gradient(to right, #3b82f6, #6366f1)",
            color: "white",
          }}
        >
          {loading ? "Uploading..." : "🚀 Generate with Images"}
        </Button>
      </div>
    </ScreenLayout>
  );
};
