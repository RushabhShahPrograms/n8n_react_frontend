import React, { useState } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { OutputSection } from "@/components/OutputSection";
import { TaskButtons } from "@/components/TaskButtons";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { generateJobId } from "@/lib/utils";

const MainScreenURL = "https://wholesomegoods.app.n8n.cloud/webhook/05276933-cda1-4390-81d0-f9f23b47ca38";

export const MainScreen = ({ response, setResponse, setActiveTab, setSharedData }) => {
  const [activeTab, setActiveTabLocal] = useState("Main Screen");
  const [formData, setFormData] = useState({
    productUrl: "",
    winningAngle: "",
    targetAudience: "",
    brandTone: "",
    offerDetails: "",
    productTypes: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const inputFields = [
    { label: "Product URL", name: "productUrl", placeholder: "Enter product URL" },
    { label: "Winning Angle", name: "winningAngle", placeholder: "Describe the winning angle" },
    { label: "Target Audience", name: "targetAudience", placeholder: "Define target audience" },
    { label: "Brand Tone", name: "brandTone", placeholder: "Describe brand tone" },
    { label: "Offer Details", name: "offerDetails", placeholder: "Enter offer details" },
    { label: "Product Types", name: "productTypes", placeholder: "List product types" },
  ];

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResponse(null);
    setDone(false);
    
    const job_id = generateJobId();
    const callback_url = `${window.location.origin}/callback`;
    console.log("form data",formData)
    const dataToSend = { ...formData, job_id, callback_url };
    console.log("data send to backend",dataToSend)

    try {
      const res = await fetch(MainScreenURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) {
        throw new Error(`n8n returned ${res.status}`);
      }
      
      const pollStart = Date.now();
      const pollTimeoutMs = 20 * 60 * 1000; // 20 minutes
      const pollIntervalMs = 2000; // Poll every 2 seconds
      let resultData = null;

      while (Date.now() - pollStart < pollTimeoutMs) {
        try {
          const pollUrl = `${window.location.origin}/result/${job_id}`;
          console.log("poll url",pollUrl)
          const r = await fetch(pollUrl);
          console.log("result r",r)
          
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
      }
    } catch (err) {
      console.error("Error calling backend:", err);
      setResponse({ error: `Failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout>
      <h1 className="text-2xl font-bold text-white mt-8 mb-4 bg-gradient-primary bg-clip-text text-transparent">
        {activeTab}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <InputSection 
            title="Input Text" 
            fields={inputFields} 
            onChange={handleInputChange} 
            values={formData}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Response */}
          {response && !response.error && (
            <div
              className="p-6 bg-card rounded-md shadow-soft text-sm text-muted-foreground"
              style={{
                maxHeight: "500px",
                overflowY: "auto",
                overflowX: "hidden",
                whiteSpace: "pre-wrap",
              }}
              dangerouslySetInnerHTML={{ __html: response }}
            />
          )}

          {response && response.error && (
            <div className="p-6 bg-card rounded-md shadow-soft text-sm text-red-500">
              {response.error}
            </div>
          )}
        </div>
      </div>
      <br />

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
              cursor: "pointer",
              transition: "all 0.3s",
              background: "linear-gradient(to right, #3b82f6, #6366f1)",
              color: "white",
              border: "none",
              outline: "none",
            }}
            className={`w-full max-w-[320px] text-lg px-10 py-4 rounded-2xl transition-all duration-300 ease-in-out ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Generating...</span>
              </span>
            ) : (
              "✨ Generate Content"
            )}
          </Button>
        ) : (
          <Button
            onClick={() => {
              setSharedData({
                productUrl: formData.productUrl || "",
                winningAngle: formData.winningAngle || "",
              });
              setActiveTab("screen2");
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
            className="w-full max-w-[320px] text-lg px-10 py-4 rounded-2xl transition-all duration-300 ease-in-out"
          >
            🚀 Go to Screen 2
          </Button>
        )}
      </div>
    </ScreenLayout>
  );
};
