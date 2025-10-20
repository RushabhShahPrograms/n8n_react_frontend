import React, { useState, useEffect, useRef } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const Screen4URL = "https://wholesomegoods.app.n8n.cloud/webhook/60ce0ddc-7e2e-42ef-b5f0-ac2511363667";
// const Screen4URL = "https://wholesomegoods.app.n8n.cloud/webhook-test/60ce0ddc-7e2e-42ef-b5f0-ac2511363667";

export const Screen4 = ({ response, setResponse, sharedData, setActiveTab, setSharedDataForScreen5 }) => {
  const [activeTab] = useState("Images to videos");
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("screen4FormData");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      scripts: sharedData?.currentScript || "",
      imgUrls:"",
      model: sharedData?.model || "Veo3.1",
    };
  });
  console.log("Shared Data:", sharedData);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const JOB_STATE_KEY = "screen4JobState"; // { job_id, pollStartMs, loading, done }
  const RESPONSE_KEY = "screen4Response"; // stringified JSON or string
  const fileInputRef = useRef(null);

  // Handle manual text input
  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto-save to localStorage
  useEffect(() => {
    try { localStorage.setItem("screen4FormData", JSON.stringify(formData)); } catch (_) {}
  }, [formData]);

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

  const handleRemoveUploadedImage = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAllUploaded = () => {
    setUploadedImages([]);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const [validationErrors, setValidationErrors] = useState({});

  const handleSubmit = async () => {

    // Validate form fields
    const errors = {};
    // Only validate required fields (scripts and model)
    const requiredFields = ['scripts'];
    requiredFields.forEach((key) => {
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
      setResponse({ error: `Failed: ${err.message}` });
    } finally {
      setLoading(false);
      try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
    }
  };

  // START: VIDEO DOWNLOAD FUNCTION
  const getFilenameFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename || 'downloaded_video.mp4';
    } catch {
      return 'downloaded_video.mp4';
    }
  };

  const getVideoBlob = async (url) => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error();
      const contentType = res.headers.get('content-type');
      if (!contentType?.startsWith('video/')) throw new Error();
      return await res.blob();
    } catch {
      const proxyPromises = [
        { base: 'https://api.allorigins.win/raw?url=' },
        { base: 'https://corsproxy.io/?' },
        { base: 'https://api.codetabs.com/v1/proxy?quest=' }
      ].map(async ({ base }) => {
        try {
          const proxyUrl = base + encodeURIComponent(url);
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error();
          const contentType = res.headers.get('content-type');
          if (!contentType?.startsWith('video/')) throw new Error();
          return await res.blob();
        } catch {
          throw new Error('Proxy failed');
        }
      });
      return await Promise.any(proxyPromises);
    }
  };

  const downloadVideo = async (url, filename) => {
    try {
      const blob = await getVideoBlob(url);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Video download failed:', err);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const downloadSelectedVideos = async () => {
    if (selectedVideos.length === 0) {
      alert("Please select at least one video to download.");
      return;
    }
    try {
      if (selectedVideos.length === 1) {
        const url = selectedVideos[0];
        const filename = getFilenameFromUrl(url);
        await downloadVideo(url, filename);
      } else {
        const zip = new JSZip();
        const downloadPromises = selectedVideos.map(async (url, i) => {
          try {
            const blob = await getVideoBlob(url);
            const filename = getFilenameFromUrl(url);
            const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : '.mp4';
            const name = `video_${i + 1}${ext}`;
            zip.file(name, blob);
          } catch (err) {
            console.error(`Failed to add ${url}:`, err);
          }
        });
        await Promise.all(downloadPromises);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'selected_videos.zip');
      }
    } catch (err) {
      console.error('Batch download failed:', err);
    }
  };

  const handleVideoSelection = (url) => {
    setSelectedVideos((prev) =>
      prev.includes(url) ? prev.filter((img) => img !== url) : [...prev, url]
    );
  };

  const handleSelectAll = (urls, type) => {
    if (type === 'select') {
      setSelectedVideos((prev) => [...new Set([...prev, ...urls])]);
    } else {
      setSelectedVideos((prev) => prev.filter((url) => !urls.includes(url)));
    }
  };
  // END: VIDEO DOWNLOAD FUNCTION

  // This hook populates the form from sharedData, but is careful not to overwrite
  // existing data that might have been restored from localStorage or user input.
  useEffect(() => {
    const updates = {};
    if (sharedData?.currentScript && !formData.scripts) {
      updates.scripts = sharedData.currentScript;
    }
    if (sharedData?.selectedImageUrls && !formData.imgUrls) {
      updates.imgUrls = sharedData.selectedImageUrls.join('\n');
    }

    if (Object.keys(updates).length > 0) {
      setFormData((prev) => ({
        ...prev,
        ...updates,
      }));
    }
  }, [sharedData, formData.scripts, formData.imgUrls]);

  // Persist response when it changes and sync the 'done' state
  useEffect(() => {
    try {
      if (response && !response.error) {
        localStorage.setItem(
          RESPONSE_KEY,
          typeof response === "string" ? response : JSON.stringify(response)
        );
        setDone(true);
      } else {
        setDone(false);
      }
    } catch (_) {
      setDone(false);
    }
  }, [response]);

  // Resume polling/restore done+response on mount
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
          const pollTimeoutMs = 20 * 60 * 1000;
          const pollIntervalMs = 2000;
          const pollStart = pollStartMs || Date.now();
          setLoading(true);
          setDone(false);
          (async () => {
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
                  break;
                }
              } catch (_) {}
              await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
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
          try { localStorage.removeItem("screen4FormData"); } catch (_) {}
          try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
          try { localStorage.removeItem(RESPONSE_KEY); } catch (_) {}
          setFormData({
            scripts: "",
            imgUrls: "",
            model: "Veo3.1",
          });
          setResponse(null);
          setDone(false);
          setSelectedVideos([]);
        }}
      >
        Clear Inputs
      </Button>
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
              {label:"Choose Model", name:"model", type:"select", options:["Veo3.1", "Veo3", "Kling-2-1"]},
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
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4
                         file:rounded-full file:border-0 file:text-sm file:font-semibold
                         file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
            {uploadedImages.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-foreground/70">{uploadedImages.length} selected</span>
                  <Button variant="outline" size="sm" onClick={handleClearAllUploaded}>Clear all</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uploadedImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img
                        src={img}
                        alt={`upload-${i}`}
                        style={{ width: "120px", height: "120px", objectFit: "cover" }}
                        className="w-20 h-20 object-cover rounded-lg border border-border/20"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveUploadedImage(i)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
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
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-foreground/80">🎬 Generated Videos</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videoUrlsArray.filter(url => url.startsWith('http')), 'select')}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videoUrlsArray, 'deselect')}>Deselect All</Button>
                  {selectedVideos.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={downloadSelectedVideos}
                      style={{ background: "#10b981", color: "white" }}
                    >
                      Download Selected ({selectedVideos.length})
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 justify-items-center">
                {response[0].videoUrlsArray.map((videoUrl, i) => {
                  const isError = typeof videoUrl !== 'string' || !videoUrl.startsWith('http');
                  return (
                    <div key={i} className="relative flex flex-col items-center gap-2">
                      {isError ? (
                        <div
                          style={{ width: "160px", height: "160px", objectFit: "cover" }}
                          className="rounded-lg border border-border/20 bg-red-100 flex flex-col items-center justify-center text-center p-2"
                        >
                          <span className="text-red-500 text-xs">{videoUrl}</span>
                        </div>
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            checked={selectedVideos.includes(videoUrl)}
                            onChange={() => handleVideoSelection(videoUrl)}
                            className="absolute top-2 left-2 h-5 w-5 z-10"
                          />
                          <video
                            src={videoUrl}
                            controls
                            style={{ width: "160px", height: "160px", objectFit: "cover" }}
                            className="rounded-lg border border-border/20"
                          />
                          <button
                            onClick={() => downloadVideo(videoUrl, `video_${i + 1}.mp4`)}
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
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* {response && !response.error && response[0]?.videoUrlsArray?.length > 0 && (
            <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-foreground/80">🎬 Generated Videos</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videoUrlsArray, 'select')}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videoUrlsArray, 'deselect')}>Deselect All</Button>
                  {selectedVideos.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={downloadSelectedVideos}
                      style={{ background: "#10b981", color: "white" }}
                    >
                      Download Selected ({selectedVideos.length})
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 justify-items-center">
                {response[0].videoUrlsArray.map((videoUrl, i) => (
                  <div key={i} className="relative flex flex-col items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedVideos.includes(videoUrl)}
                      onChange={() => handleVideoSelection(videoUrl)}
                      className="absolute top-2 left-2 h-5 w-5 z-10"
                    />
                    <video
                      src={videoUrl}
                      controls
                      style={{ width: "160px", height: "160px", objectFit: "cover" }}
                      className="rounded-lg border border-border/20"
                    />
                    <button
                      onClick={() => downloadVideo(videoUrl, `video_${i + 1}.mp4`)}
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
          )} */}
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
            {loading ? "Uploading..." : "Go to Text to video"}
          </Button>
        )}
      </div>
    </ScreenLayout>
  );
};