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
  const [debugInfo, setDebugInfo] = useState([]);

  const addDebug = (msg) => {
    setDebugInfo(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    console.log(msg);
  };

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
    setDebugInfo([]);
    setDone(false);
    
    const job_id = generateJobId();
    const callback_url = `${window.location.origin}/callback`;
    const dataToSend = { ...formData, job_id, callback_url };

    addDebug(`Generated job_id: ${job_id}`);
    addDebug(`Callback URL: ${callback_url}`);
    addDebug(`Sending request to n8n...`);

    try {
      const res = await fetch(MainScreenURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      addDebug(`n8n responded with status: ${res.status}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        addDebug(`n8n error response: ${errorText}`);
        throw new Error(`n8n returned ${res.status}`);
      }

      addDebug(`Starting polling for results...`);
      
      const pollStart = Date.now();
      const pollTimeoutMs = 20 * 60 * 1000; // 20 minutes
      const pollIntervalMs = 2000; // Poll every 2 seconds
      let resultData = null;
      let pollCount = 0;

      while (Date.now() - pollStart < pollTimeoutMs) {
        pollCount++;
        addDebug(`Poll attempt ${pollCount}...`);
        
        try {
          const pollUrl = `${window.location.origin}/result/${job_id}`;
          addDebug(`Polling: ${pollUrl}`);
          
          const r = await fetch(pollUrl);
          addDebug(`Poll response status: ${r.status}`);
          
          if (r.status === 200) {
            const json = await r.json();
            addDebug(`Received data: ${JSON.stringify(json).substring(0, 100)}...`);
            resultData = json?.result ?? null;
            addDebug(`Result found! Breaking poll loop.`);
            break;
          } else if (r.status === 204) {
            addDebug(`Result not ready yet (204)`);
          } else {
            const errorText = await r.text();
            addDebug(`Unexpected status ${r.status}: ${errorText}`);
          }
        } catch (pollError) {
          addDebug(`Poll error: ${pollError.message}`);
        }
        
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      if (resultData == null) {
        addDebug(`❌ Timed out after ${pollCount} attempts`);
        setResponse({ error: "Timed out waiting for result. Check debug info below." });
      } else {
        addDebug(`✅ Success! Received result.`);
        setResponse(typeof resultData === "string" ? resultData : JSON.stringify(resultData));
        setDone(true);
      }
    } catch (err) {
      addDebug(`❌ Error: ${err.message}`);
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
          {/* Debug Info */}
          {debugInfo.length > 0 && (
            <div className="p-4 bg-gray-900 rounded-md">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Debug Log:</h3>
              <div className="text-xs text-gray-400 space-y-1 max-h-60 overflow-y-auto">
                {debugInfo.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            </div>
          )}

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