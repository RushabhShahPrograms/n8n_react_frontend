import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";

const Screen4URL = "https://wholesomegoods.app.n8n.cloud/webhook/60ce0ddc-7e2e-42ef-b5f0-ac2511363667";
// const Screen4URL = "https://19cafb11c1b9.ngrok-free.app/v1/screen4";

export const Screen4 = ({ response, setResponse, sharedData, setActiveTab, setSharedDataForScreen5 }) => {
  const [activeTab] = useState("Images to videos");
  const [formData, setFormData] = useState({
    scripts: sharedData?.currentScript || "",
    imgUrls:"",
    model: sharedData?.model || "Veo3.1",
  });
  console.log("Shared Data:", sharedData);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);  
    

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

      const [validationErrors, setValidationErrors] = useState({});

  const handleSubmit = async () => {

    // Validate form fields
    const errors = {};
    Object.keys(formData).forEach((key) => {
      if (formData[key].trim() === "") {
        errors[key] = `${key.replace(/([A-Z])/g, " $1").trim()} is required`;
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
      scripts: formData.scripts,
      imgUrls: formData.imgUrls,
      model: formData?.model || "Veo3.1",
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
    if (!res.ok) {
        throw new Error(`n8n returned ${res.status}`);
    }

    // Poll for result from Netlify function
    const pollStart = Date.now();
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
      }
    } catch (err) {
      console.error("Error calling backend:", err);
      setResponse({ error: `Failed: ${err.message}` });
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
              { label: "Script", name: "scripts", placeholder: "Script from previous screen", type: "textarea", required: true },
              { label: "Image URLs", name: "imgUrls", placeholder: "Add one or multiple image URLs", type: "textarea" },
              {label:"Choose Model", name:"model", type:"select", options:["Veo3.1", "Kling-2-1"]},
            ]}
            onChange={handleInputChange}
            values={formData}
            errors={validationErrors}
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
            }}
        >
          {loading ? "Uploading..." : "Generate with Images"}
        </Button>
        ) : (
        <Button
          onClick={() => {
                setSharedDataForScreen5({
                currentScript: formData.scripts,
                winningAngle: "",
                inspiration: "",
                });
                setActiveTab("screen5");
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
          {loading ? "Uploading..." : "Go to Screen 5"}
        </Button>
        )}
      </div>
    </ScreenLayout>
  );
};
