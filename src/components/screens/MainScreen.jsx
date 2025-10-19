import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";

const MainScreenURL = "https://wholesomegoods.app.n8n.cloud/webhook/05276933-cda1-4390-81d0-f9f23b47ca38";
// const MainScreenURL = "https://wholesomegoods.app.n8n.cloud/webhook-test/05276933-cda1-4390-81d0-f9f23b47ca38"

export const MainScreen = ({ response, setResponse, loading, setLoading, done, setDone, setActiveTab, setSharedData }) => {
  const [activeTab, setActiveTabLocal] = useState("Hook and CTA");
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("mainScreenFormData");
    return saved
      ? JSON.parse(saved)
      : {
          productUrl: "",
          winningAngle: "",
          targetAudience: "",
          brandTone: "",
          offerDetails: "",
          productTypes: "",
        };
  });

  // 🧩 Automatically save inputs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("mainScreenFormData", JSON.stringify(formData));
  }, [formData]);

  const inputFields = [
    { label: "Product URL", name: "productUrl",placeholder: "Enter product URL", required: true },
    { label: "Winning Angle", name: "winningAngle", placeholder: "Describe the winning angle", required: true },
    { label: "Target Audience", name: "targetAudience", placeholder: "Define target audience", required: true },
    { label: "Brand Tone", name: "brandTone", placeholder: "Describe brand tone", required: true },
    { label: "Offer Details", name: "offerDetails", placeholder: "Enter offer details" },
    { label: "Product Types", name: "productTypes", placeholder: "List product types", required: true },
  ];

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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
    console.log("Form data:", formData);
    const dataToSend = { ...formData, job_id, callback_url };

    console.log("Data sent to backend:", dataToSend);
    try {
      const res = await fetch(
        MainScreenURL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSend),
        }
      );
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
      <Button
        variant="secondary"
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
          transition: "all 0.3s",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.filter = "brightness(1.1)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.filter = "brightness(1)";
        }}
        onClick={() => {
          localStorage.removeItem("mainScreenFormData");
          setFormData({
            productUrl: "",
            winningAngle: "",
            targetAudience: "",
            brandTone: "",
            offerDetails: "",
            productTypes: "",
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
        {/* Inputs */}
        <div className="lg:col-span-1 space-y-6">
          <InputSection title="Input Text" fields={inputFields} onChange={handleInputChange} values={formData} errors={validationErrors} />
          
        </div>

        {/* Response — takes remaining 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Loading / Queue message */}
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
                Request received. Processing may take up to <strong>10-20 minutes</strong>.
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
          {response && !response.error && (
            <div
              className="mt-6 p-6 bg-card rounded-md shadow-soft text-sm text-muted-foreground"
              style={{
                maxHeight: "500px",   // height limit
                overflowY: "auto",    // enable vertical scroll
                overflowX: "hidden",
                whiteSpace: "pre-wrap",
              }}
              dangerouslySetInnerHTML={{ __html: response }}
            />
          )}

          {response && response.error && (
            <div className="mt-6 p-6 bg-card rounded-md shadow-soft text-sm text-red-500">
              {response.error}
            </div>
          )}
        </div>
      </div><br/>
        
      {/* Backend Submit Button */}
      {/* Backend Submit Button or Next Navigation */}
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
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <span className="h-4 w-4 border-t-transparent rounded-full animate-spin"></span>
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
          >
            Go to AIDA Script
          </Button>
        )}
      </div>
    </ScreenLayout>
  );
};