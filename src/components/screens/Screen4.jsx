import React, { useState, useEffect, useRef } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const Screen4URL = "https://wholesomegoods.app.n8n.cloud/webhook/4cb69651-738b-4cb9-b38f-55e2eeb797ef";
const REGENERATION_URL = "https://wholesomegoods.app.n8n.cloud/webhook/d491aeb8-9f85-409c-9313-674acaa733f7";
const REGENERATING_VIDEOS_KEY = "screen4RegeneratingVideos";

// Reusable and robust polling function
const pollForResult = async (job_id) => {
  const pollTimeoutMs = 20 * 60 * 1000; // 20 minutes
  const pollIntervalMs = 2000;
  const pollStart = Date.now();

  while (Date.now() - pollStart < pollTimeoutMs) {
    try {
      const pollUrl = `${window.location.origin}/result/${job_id}`;
      const r = await fetch(pollUrl);
      if (r.status === 200) {
        const json = await r.json();
        const resultData = json?.result ?? null;
        
        if (resultData) {
          let parsedData = resultData;
          // Defensively parse if the result is a string
          if (typeof parsedData === "string") {
            try {
              parsedData = JSON.parse(parsedData);
            } catch (e) {
              console.error("Failed to parse result data string:", parsedData);
              throw new Error("Received malformed data from server.");
            }
          }

          // Validate the structure of the parsed data
          const isValid = 
            (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0]?.videos) || // For initial generation
            (typeof parsedData === 'object' && parsedData !== null && parsedData.videoUrl); // For regeneration

          if (isValid) {
            return parsedData;
          } else {
            console.error("Parsed data does not have the expected structure:", parsedData);
            throw new Error("Received data with unexpected structure.");
          }
        }
      }
    } catch (pollError) {
      // Ignore intermittent polling errors, but log them for debugging
      console.warn("Polling error:", pollError);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("Timed out waiting for result.");
};


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
  const [loadingDownloads, setLoadingDownloads] = useState([]);
  const JOB_STATE_KEY = "screen4JobState"; // { job_id, pollStartMs, loading, done }
  const RESPONSE_KEY = "screen4Response"; // stringified JSON or string
  const fileInputRef = useRef(null);

  // START: Modal and Regeneration state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVideoForRegen, setSelectedVideoForRegen] = useState(null);
  const [editablePrompt, setEditablePrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingVideos, setRegeneratingVideos] = useState([]); // Tracks regenerating items by imageUrl
  const [regenModel, setRegenModel] = useState("Veo3.1"); // NEW: State for the model in the regeneration modal
  // END: Modal and Regeneration state

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
    const errors = {};
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
      if (!res.ok) throw new Error(`n8n returned ${res.status}`);
      
      const pollStart = Date.now();
      try { localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ job_id, pollStartMs: pollStart, loading: true, done: false })); } catch (_) {}
      
      const resultData = await pollForResult(job_id);
      
      setResponse(resultData);
      setDone(true);
      try {
        localStorage.setItem(RESPONSE_KEY, JSON.stringify(resultData));
      } catch (_) {}

    } catch (err) {
      console.error("Error during generation:", err);
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
    setLoadingDownloads(prev => [...prev, url]);
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
    } finally {
      setLoadingDownloads(prev => prev.filter(item => item !== url));
    }
  };

  const downloadSelectedVideos = async () => {
    if (selectedVideos.length === 0) {
      alert("Please select at least one video to download.");
      return;
    }

    if (selectedVideos.length === 1) {
      const url = selectedVideos[0];
      const filename = getFilenameFromUrl(url);
      await downloadVideo(url, filename);
      return;
    }

    setLoadingDownloads(prev => [...prev, 'zip']);
    try {
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
    } catch (err) {
      console.error('Batch download failed:', err);
    } finally {
      setLoadingDownloads(prev => prev.filter(item => item !== 'zip'));
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

  // START: REGENERATION MODAL HANDLERS
  const handleOpenRegenerateModal = (videoData) => {
    console.log("Data received by modal:", videoData); 
    setSelectedVideoForRegen(videoData);
    setEditablePrompt(videoData.animationPrompt);
    setRegenModel("Veo3.1"); // Reset to default model when opening
    setIsModalOpen(true);
  };

  const handleRegenerateSubmit = async () => {
    if (!selectedVideoForRegen) return;
    
    const originalImageUrl = selectedVideoForRegen.imageUrl;
    setIsRegenerating(true);
    setRegeneratingVideos(prev => [...prev, originalImageUrl]);
    setIsModalOpen(false);

    const dataToSend = {
      imageUrl: originalImageUrl,
      prompt: editablePrompt,
      model: regenModel, // UPDATED: Send the selected model
      job_id: generateJobId(), // Send a job_id for polling
      callback_url: `${window.location.origin}/callback`,
    };

    try {
      console.log("📤 Sending regeneration request:", dataToSend);
      const res = await fetch(REGENERATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) throw new Error(`Regeneration webhook returned ${res.status}`);
      
      const newVideoData = await pollForResult(dataToSend.job_id);

      setResponse(prevResponse => {
        const updatedVideos = prevResponse[0].videos.map(video => {
          if (video.imageUrl === originalImageUrl) {
            return newVideoData[0].videos[0];
          }
          return video;
        });
        const newResponse = [{ ...prevResponse[0], videos: updatedVideos }];
        try { localStorage.setItem(RESPONSE_KEY, JSON.stringify(newResponse)); } catch (_) {}
        return newResponse;
      });

    } catch (err) {
      console.error("Regeneration failed:", err);
      alert(`Regeneration failed: ${err.message}`);
    } finally {
      setIsRegenerating(false);
      setRegeneratingVideos(prev => prev.filter(url => url !== originalImageUrl));
    }
  };
  // END: REGENERATION MODAL HANDLERS

  // This hook populates the form from sharedData
  useEffect(() => {
    const updates = {};
    if (sharedData?.currentScript && !formData.scripts) {
      updates.scripts = sharedData.currentScript;
    }
    if (sharedData?.selectedImageUrls && !formData.imgUrls) {
      updates.imgUrls = sharedData.selectedImageUrls.join('\n');
    }

    if (Object.keys(updates).length > 0) {
      setFormData((prev) => ({ ...prev, ...updates }));
    }
  }, [sharedData, formData.scripts, formData.imgUrls]);

  // Persist response when it changes
  useEffect(() => {
    try {
      if (response && !response.error) {
        localStorage.setItem(RESPONSE_KEY, JSON.stringify(response));
        setDone(true);
      } else {
        setDone(false);
      }
    } catch (_) {
      setDone(false);
    }
  }, [response]);

  // NEW: This hook persists the list of regenerating videos to localStorage
  useEffect(() => {
    try {
      if (regeneratingVideos.length > 0) {
        localStorage.setItem(REGENERATING_VIDEOS_KEY, JSON.stringify(regeneratingVideos));
      } else {
        // Clean up the key when no videos are regenerating
        localStorage.removeItem(REGENERATING_VIDEOS_KEY);
      }
    } catch (e) {
      console.error("Failed to save regenerating videos state:", e);
    }
  }, [regeneratingVideos]);

  // Resume polling/restore state on mount
  useEffect(() => {
    try {
      const savedResponse = localStorage.getItem(RESPONSE_KEY);
      if (savedResponse && !response) {
        try {
          const parsed = JSON.parse(savedResponse);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.videos) {
            setResponse(parsed);
            setDone(true);
          } else {
             console.warn("Cleared invalid response from localStorage.");
             localStorage.removeItem(RESPONSE_KEY);
          }
        } catch (e) {
          console.warn("Cleared malformed response from localStorage.");
          localStorage.removeItem(RESPONSE_KEY);
        }
      }
      const savedState = localStorage.getItem(JOB_STATE_KEY);
      if (savedState) {
        const { job_id } = JSON.parse(savedState);
        setLoading(true);
        setDone(false);
        (async () => {
          try {
            const resultData = await pollForResult(job_id);
            setResponse(resultData);
            setDone(true);
            localStorage.setItem(RESPONSE_KEY, JSON.stringify(resultData));
          } catch (err) {
            setResponse({ error: "Timed out waiting for result. Please try again." });
          } finally {
            setLoading(false);
            localStorage.removeItem(JOB_STATE_KEY);
          }
        })();
      }

      // NEW: Restore the regenerating videos state on mount
      const savedRegenerating = localStorage.getItem(REGENERATING_VIDEOS_KEY);
      if (savedRegenerating) {
        try {
          const parsedRegenerating = JSON.parse(savedRegenerating);
          if (Array.isArray(parsedRegenerating)) {
            setRegeneratingVideos(parsedRegenerating);
          }
        } catch (e) {
          console.warn("Cleared malformed regenerating videos state from localStorage.");
          localStorage.removeItem(REGENERATING_VIDEOS_KEY);
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
          try { localStorage.clear(); } catch (_) {}
          setFormData({ scripts: "", imgUrls: "", model: "Veo3.1" });
          setResponse(null);
          setDone(false);
          setSelectedVideos([]);
          setUploadedImages([]);
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
              <style>{`@keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-6px); } }`}</style>
            </div>
          )}

          {/* Video Previews */}
          {response && !response.error && response[0]?.videos?.length > 0 && (
            <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-foreground/80">🎬 Generated Videos</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videos.map(v => v.videoUrl).filter(url => url.startsWith('http')), 'select')}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videos.map(v => v.videoUrl), 'deselect')}>Deselect All</Button>
                  {selectedVideos.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={downloadSelectedVideos}
                      style={{ background: "#10b981", color: "white" }}
                      disabled={loadingDownloads.includes('zip')}
                    >
                      {loadingDownloads.includes('zip') ? 'Zipping...' : `Download Selected (${selectedVideos.length})`}
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                {response[0].videos.map((videoData, i) => {
                  const { videoUrl, imageUrl } = videoData;
                  const isError = typeof videoUrl !== 'string' || !videoUrl.startsWith('http');
                  const isCurrentlyRegenerating = regeneratingVideos.includes(imageUrl);

                  return (
                    <div key={imageUrl || i} className="relative flex flex-col items-center gap-2 bg-card/50 p-3 rounded-lg border border-border/20 w-full">
                      {isCurrentlyRegenerating && (
                        <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center z-20">
                          <div className="text-white font-bold">Regenerating...</div>
                           <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 8, background: "#3b82f6", animation: "bounce 0.6s infinite alternate" }} />
                              <div style={{ width: 8, height: 8, borderRadius: 8, background: "#60a5fa", animation: "bounce 0.6s 0.15s infinite alternate" }} />
                              <div style={{ width: 8, height: 8, borderRadius: 8, background: "#93c5fd", animation: "bounce 0.6s 0.3s infinite alternate" }} />
                            </div>
                        </div>
                      )}
                      {isError ? (
                        <div
                          style={{ width: "100%", height: "160px" }}
                          className="rounded-lg border border-border/20 bg-red-100 flex flex-col items-center justify-center text-center p-2"
                        >
                          <span className="text-red-500 text-xs font-semibold">Generation Failed</span>
                          <span className="text-red-500 text-xs mt-1">{videoUrl}</span>
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
                            style={{ width: "100%", height: "160px", objectFit: "cover" }}
                            className="rounded-lg border border-border/20"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => downloadVideo(videoUrl, `video_${i + 1}.mp4`)}
                              className="px-3 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                              disabled={loadingDownloads.includes(videoUrl)}
                            >
                              {loadingDownloads.includes(videoUrl) ? 'Downloading...' : 'Download'}
                            </button>
                            <button
                              onClick={() => handleOpenRegenerateModal(videoData)}
                              className="px-3 py-1 text-xs rounded-md bg-gray-500 text-white hover:bg-gray-600 transition-colors disabled:opacity-50"
                              disabled={isCurrentlyRegenerating}
                            >
                              Regenerate
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
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
            {loading ? "Uploading..." : "Go to Text to video"}
          </Button>
        )}
      </div>

      {/* Regeneration Modal */}
      {isModalOpen && selectedVideoForRegen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 10, 20, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: '#1a202c',
              color: '#e2e8f0',
              width: '90vw',
              height: '90vh',
              display: 'flex',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              border: '1px solid #2d3748',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#2d3748',
                border: '1px solid #4a5568',
                color: 'white',
                fontSize: '1rem',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 101,
              }}
            >
              &times;
            </button>

            <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
              <div>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#a0aec0' }}>Source Image</h4>
                <img
                  src={selectedVideoForRegen.imageUrl}
                  alt="Source for video"
                  style={{ width: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid #2d3748' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#a0aec0' }}>Animation Prompt</h4>
                <textarea
                  value={editablePrompt}
                  onChange={(e) => setEditablePrompt(e.target.value)}
                  style={{
                    flexGrow: 1,
                    width: '100%',
                    background: '#2d3748',
                    color: '#e2e8f0',
                    border: '1px solid #4a5568',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    minHeight: '150px',
                    resize: 'vertical',
                  }}
                />
              </div>
              {/* --- NEW CODE START --- */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="regenModelSelect" style={{ fontSize: '0.8rem', color: '#a0aec0', marginBottom: '0.5rem', display: 'block' }}>
                    Choose Model
                  </label>
                  <select
                    id="regenModelSelect"
                    value={regenModel}
                    onChange={(e) => setRegenModel(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#2d3748',
                      color: '#e2e8f0',
                      border: '1px solid #4a5568',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="Veo3.1">Veo3.1</option>
                    <option value="Veo3">Veo3</option>
                    <option value="Kling-2-1">Kling-2-1</option>
                  </select>
                </div>
                <Button
                  onClick={handleRegenerateSubmit}
                  disabled={isRegenerating}
                  style={{
                    flex: 1,
                    alignSelf: 'flex-end',
                    padding: '12px',
                    background: 'linear-gradient(to right, #3b82f6, #6366f1)',
                    color: 'white',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: isRegenerating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isRegenerating ? 'Sending...' : 'Send for Regeneration'}
                </Button>
              </div>
              {/* --- NEW CODE END --- */}
            </div>

            <div style={{ flex: 2, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
               <h4 style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#a0aec0', alignSelf: 'flex-start' }}>Output Video</h4>
              <video
                key={selectedVideoForRegen.videoUrl}
                src={selectedVideoForRegen.videoUrl}
                controls
                autoPlay
                loop
                style={{ maxWidth: '100%', maxHeight: 'calc(100% - 40px)', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>
      )}
    </ScreenLayout>
  );
};