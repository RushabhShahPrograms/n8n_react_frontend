import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const Screen5URL = "https://wholesomegoods.app.n8n.cloud/webhook/2118f781-4da7-450f-8ecf-61b15e111c24";
const REGENERATION_URL = "https://wholesomegoods.app.n8n.cloud/webhook/2118f781-4da7-450f-8ecf-61b15e334c24";
const REGENERATING_VIDEOS_KEY = "screen5RegeneratingVideos";

// Reusable and robust polling function (adapted from Screen4)
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
          if (typeof parsedData === "string") {
            try {
              parsedData = JSON.parse(parsedData);
            } catch (e) {
              console.error("Failed to parse result data string:", parsedData);
              throw new Error("Received malformed data from server.");
            }
          }

          // Validate the structure for both initial and regeneration
          const isValid = Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0]?.videos;
          if (isValid) {
            return parsedData;
          } else {
            console.error("Parsed data does not have the expected structure:", parsedData);
            throw new Error("Received data with unexpected structure.");
          }
        }
      }
    } catch (pollError) {
      console.warn("Polling error:", pollError);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("Timed out waiting for result.");
};

export const Screen5 = ({ response, setResponse, sharedData, setActiveTab, setSharedDataForScreen6, clearSharedData }) => {
  const [activeTab] = useState("Text to video");
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("screen5FormData");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      currentScript: sharedData?.currentScript || "",
      winningAngle: sharedData?.winningAngle || "",
      inspiration: sharedData?.inspiration || "",
      boardInsights: "Please select an option",
      model: "Kling",
    };
  });

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [loadingDownloads, setLoadingDownloads] = useState([]);
  const JOB_STATE_KEY = "screen5JobState";
  const RESPONSE_KEY = "screen5Response";

  // START: Modal and Regeneration state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVideoForRegen, setSelectedVideoForRegen] = useState(null);
  const [editablePrompt, setEditablePrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // CORRECTED: Initialize state directly from localStorage to prevent race conditions
  const [regeneratingVideos, setRegeneratingVideos] = useState(() => {
    try {
      const saved = localStorage.getItem(REGENERATING_VIDEOS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to restore regenerating videos state from localStorage:", e);
    }
    return []; // Default to empty array if nothing found or on error
  });

  const [regenModel, setRegenModel] = useState("Kling");
  // END: Modal and Regeneration state

  useEffect(() => {
    if (sharedData && Object.keys(sharedData).length > 0) {
      setFormData((prev) => {
        const isFormEmpty = !prev.currentScript && !prev.winningAngle && !prev.inspiration;
        if (isFormEmpty) {
          return {
            ...prev,
            currentScript: sharedData.currentScript || "",
            winningAngle: sharedData.winningAngle || "",
            inspiration: sharedData.inspiration || "",
          };
        }
        return prev;
      });
      if (clearSharedData) {
        clearSharedData();
      }
    }
  }, [sharedData, clearSharedData]);

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    try { localStorage.setItem("screen5FormData", JSON.stringify(formData)); } catch (_) {}
  }, [formData]);

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

  // Persist the list of regenerating videos to localStorage whenever it changes
  useEffect(() => {
    try {
      if (regeneratingVideos.length > 0) {
        localStorage.setItem(REGENERATING_VIDEOS_KEY, JSON.stringify(regeneratingVideos));
      } else {
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
             localStorage.removeItem(RESPONSE_KEY);
          }
        } catch (e) {
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
      // REMOVED: Redundant loading logic is no longer needed here
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [validationErrors, setValidationErrors] = useState({});

  const handleSubmit = async () => {
    const errors = {};
    let hasErrors = false;
    inputFields.forEach(field => {
      if (field.require && (!formData[field.name] || formData[field.name].trim() === '')) {
        errors[field.name] = `${field.label} is required`;
        hasErrors = true;
      }
    });
    if (hasErrors) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setLoading(true);
    setResponse(null);
    setDone(false);
    setSelectedVideos([]);
    const job_id = generateJobId();
    const callback_url = `${window.location.origin}/callback`;
    const dataToSend = {
        ...formData,
        boardInsights: formData.boardInsights === 'Please select an option' ? '' : formData.boardInsights,
        job_id,
        callback_url,
    };
    console.log("📤 Data sent to backend:", dataToSend);
    try {
      const res = await fetch(Screen5URL, {
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

  // START: VIDEO DOWNLOAD FUNCTIONS
  const getFilenameFromUrl = (url) => {
    try {
      const pathname = new URL(url).pathname;
      const filename = pathname.split('/').pop();
      return filename || 'downloaded_video.mp4';
    } catch {
      return 'downloaded_video.mp4';
    }
  };

  const getVideoBlob = async (url) => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('Direct fetch failed');
      const contentType = res.headers.get('content-type');
      if (!contentType?.startsWith('video/')) throw new Error('Invalid content type');
      return await res.blob();
    } catch (e) {
      console.warn("Direct fetch failed, trying proxies...", e);
      const proxies = [
        { base: 'https://api.allorigins.win/raw?url=' },
        { base: 'https://corsproxy.io/?' },
        { base: 'https://api.codetabs.com/v1/proxy?quest=' }
      ];
      const proxyPromises = proxies.map(async ({ base }) => {
        try {
          const proxyUrl = base + encodeURIComponent(url);
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error(`Proxy ${base} failed`);
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
      saveAs(blob, filename);
    } catch (err) {
      console.error('All download methods failed:', err);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      alert("Could not download directly. The video has been opened in a new tab. Please right-click and 'Save Video As...'");
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
      await downloadVideo(url, getFilenameFromUrl(url));
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
          zip.file(`video_${i + 1}${ext}`, blob);
        } catch (err) {
          console.error(`Failed to fetch ${url} for zipping:`, err);
          zip.file(`FAILED_video_${i + 1}.txt`, `Could not download video from: ${url}`);
        }
      });

      await Promise.all(downloadPromises);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'selected_videos.zip');
    } catch (err) {
      console.error('Batch download failed:', err);
      alert('An error occurred while creating the zip file. Please try downloading them individually.');
    } finally {
      setLoadingDownloads(prev => prev.filter(item => item !== 'zip'));
    }
  };

  const handleVideoSelection = (url) => {
    setSelectedVideos((prev) =>
      prev.includes(url) ? prev.filter((videoUrl) => videoUrl !== url) : [...prev, url]
    );
  };

  const handleSelectAll = (urls, type) => {
    if (type === 'select') {
      setSelectedVideos((prev) => [...new Set([...prev, ...urls])]);
    } else {
      setSelectedVideos((prev) => prev.filter((url) => !urls.includes(url)));
    }
  };
  // END: VIDEO DOWNLOAD FUNCTIONS

  // START: REGENERATION MODAL HANDLERS
  const handleOpenRegenerateModal = (videoData) => {
    setSelectedVideoForRegen(videoData);
    setEditablePrompt(videoData.videoPrompt);
    setRegenModel("Kling"); // Reset to default model when opening
    setIsModalOpen(true);
  };

  const handleRegenerateSubmit = async () => {
    if (!selectedVideoForRegen) return;
    
    const originalVideoUrl = selectedVideoForRegen.videoUrl;
    setIsRegenerating(true);
    setRegeneratingVideos(prev => [...prev, originalVideoUrl]);
    setIsModalOpen(false);

    const dataToSend = {
      scriptText: selectedVideoForRegen.scriptText,
      prompt: editablePrompt,
      model: regenModel,
      job_id: generateJobId(),
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
        const newVideo = newVideoData[0].videos[0];
        const updatedVideos = prevResponse[0].videos.map(video => {
          if (video.videoUrl === originalVideoUrl) {
            return newVideo;
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
      setRegeneratingVideos(prev => prev.filter(url => url !== originalVideoUrl));
    }
  };
  // END: REGENERATION MODAL HANDLERS

  const inputFields = [
    { label: "Current Script", name: "currentScript", placeholder: "Enter Current Script", type: "textarea", require: true },
    { label: "Winning Angle", name: "winningAngle", placeholder: "Enter Winning Angle", type: "text", require: true },
    { label: "Inspiration (Optional)", name: "inspiration", placeholder: "Enter Inspiration", type: "textarea", require: false },
    {
      label: "Board Insights (Inspiration)",
      name: "boardInsights",
      type: "select",
      options: ["Please select an option", "nutra_scrape", "pattern_wellness", "pet_scrape", "pg-design", "pup_grade", "pw-transitions", "scrape_joint_support"],
      defaultValue: "Please select an option",
      require: false
    },
    {label:"Choose Model", name:"model", type:"select", options:["Kling", "Sora 2","Veo 3","Veo 3.1"], defaultValue: "Kling", require: true},
  ];

  return (
    <ScreenLayout>
      <Button
        variant="secondary"
        style={{
          display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "linear-gradient(to right, #3b82f6, #6366f1)", color: "white", fontWeight: "500", borderRadius: "9999px", border: "none", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", transition: "all 0.3s",
        }}
        onMouseOver={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
        onMouseOut={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
        onClick={() => {
          localStorage.removeItem("screen5FormData");
          localStorage.removeItem(JOB_STATE_KEY);
          localStorage.removeItem(RESPONSE_KEY);
          localStorage.removeItem(REGENERATING_VIDEOS_KEY);
          setFormData({ currentScript: "", winningAngle: "", inspiration: "", boardInsights: "Please select an option", model: "Kling" });
          setResponse(null);
          setDone(false);
          setSelectedVideos([]);
          setRegeneratingVideos([]); // Also clear the in-memory state
        }}
      >
        Clear Inputs
      </Button>
      <h1 className="text-2xl font-bold text-white mt-8 mb-4 bg-gradient-primary bg-clip-text text-transparent">
        {activeTab}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <InputSection
              fields={inputFields}
              onChange={handleInputChange}
              values={formData}
              errors={validationErrors}
            />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {loading && (
            <div className="mt-6 p-6 bg-card rounded-md shadow-soft text-sm text-muted-foreground" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", maxHeight: "200px" }}>
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
          {response && !response.error && response[0]?.videos?.length > 0 && (
            <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-foreground/80">🎬 Generated Videos</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videos.map(v => v.videoUrl).filter(url => typeof url === 'string' && url.startsWith('http')), 'select')}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videos.map(v => v.videoUrl), 'deselect')}>Deselect All</Button>
                  {selectedVideos.length > 0 && (
                    <Button variant="default" size="sm" onClick={downloadSelectedVideos} style={{ background: "#10b981", color: "white" }} disabled={loadingDownloads.includes('zip')}>
                      {loadingDownloads.includes('zip') ? 'Zipping...' : `Download Selected (${selectedVideos.length})`}
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                {response[0].videos.map((videoData, i) => {
                  const { videoUrl } = videoData;
                  const isError = typeof videoUrl !== 'string' || !videoUrl.startsWith('http');
                  const isCurrentlyRegenerating = regeneratingVideos.includes(videoUrl);

                  return (
                    <div key={videoUrl || i} className="relative flex flex-col items-center gap-2 bg-card/50 p-3 rounded-lg border border-border/20 w-full">
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
                        <div style={{ width: "100%", height: "160px" }} className="rounded-lg border border-border/20 bg-red-100 flex flex-col items-center justify-center text-center p-2">
                          <span className="text-red-600 font-bold text-lg">Error</span>
                          <span className="text-red-500 text-xs mt-1">Failed to generate video. (Details: {videoUrl})</span>
                        </div>
                      ) : (
                        <>
                          <input type="checkbox" checked={selectedVideos.includes(videoUrl)} onChange={() => handleVideoSelection(videoUrl)} className="absolute top-2 left-2 h-5 w-5 z-10 cursor-pointer" />
                          <video src={videoUrl} controls loop playsInline style={{ width: "100%", height: "160px", objectFit: "contain" }} className="rounded-lg border border-border/20" />
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => downloadVideo(videoUrl, `video_${i + 1}.mp4`)} className="px-3 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors" disabled={loadingDownloads.includes(videoUrl)}>
                              {loadingDownloads.includes(videoUrl) ? 'Downloading...' : 'Download'}
                            </button>
                            <button onClick={() => handleOpenRegenerateModal(videoData)} className="px-3 py-1 text-xs rounded-md bg-gray-500 text-white hover:bg-gray-600 transition-colors" disabled={isCurrentlyRegenerating}>
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

      <div className="flex justify-center mt-10">
        {!done ? (
        <Button onClick={handleSubmit} disabled={loading} variant="default" style={{ flex: 1, textAlign: "center", padding: "12px 16px", borderRadius: "9999px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.3s", background: "linear-gradient(to right, #3b82f6, #6366f1)", color: "white", border: "none", outline: "none" }}
        onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
        onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
        >
          {loading ? "Processing..." : "✨ Generate"}
        </Button>
        ) : (
        <Button onClick={() => {}} disabled={loading} variant="default" style={{ flex: 1, textAlign: "center", padding: "12px 16px", borderRadius: "9999px", fontWeight: 500, cursor: "pointer", transition: "all 0.3s", background: "linear-gradient(to right, #6366f1, #10b981)", color: "white", border: "none", outline: "none" }}
        onMouseOver={(e) => (e.currentTarget.style.filter = "brightness(1.5)")}
        onMouseOut={(e) => (e.currentTarget.style.filter = "brightness(1)")}
        >
          {loading ? "Processing..." : "Generation Complete"}
        </Button>
        )}
      </div>

      {/* Regeneration Modal */}
      {isModalOpen && selectedVideoForRegen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10, 10, 20, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: '#1a202c', color: '#e2e8f0', width: '90vw', height: '90vh', display: 'flex', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)', border: '1px solid #2d3748', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#2d3748', border: '1px solid #4a5568', color: 'white', fontSize: '1rem', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101 }}>
              &times;
            </button>

            <div style={{ flex: 2, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
               <h4 style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#a0aec0', alignSelf: 'flex-start' }}>Output Video</h4>
              <video key={selectedVideoForRegen.videoUrl} src={selectedVideoForRegen.videoUrl} controls autoPlay loop style={{ maxWidth: '100%', maxHeight: 'calc(100% - 40px)', borderRadius: '8px' }} />
            </div>

            <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
              <div>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#a0aec0' }}>Script Text</h4>
                <p style={{ background: '#2d3748', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                  {selectedVideoForRegen.scriptText}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#a0aec0' }}>Video Prompt</h4>
                <textarea value={editablePrompt} onChange={(e) => setEditablePrompt(e.target.value)} style={{ flexGrow: 1, width: '100%', background: '#2d3748', color: '#e2e8f0', border: '1px solid #4a5568', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', minHeight: '150px', resize: 'vertical' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="regenModelSelect" style={{ fontSize: '0.8rem', color: '#a0aec0', marginBottom: '0.5rem', display: 'block' }}>
                    Choose Model
                  </label>
                  <select id="regenModelSelect" value={regenModel} onChange={(e) => setRegenModel(e.target.value)} style={{ width: '100%', background: '#2d3748', color: '#e2e8f0', border: '1px solid #4a5568', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem' }}>
                    <option value="Kling">Kling</option>
                    <option value="Sora 2">Sora 2</option>
                    <option value="Veo 3">Veo 3</option>
                    <option value="Veo 3.1">Veo 3.1</option>
                  </select>
                </div>
                <Button onClick={handleRegenerateSubmit} disabled={isRegenerating} style={{ flex: 1, alignSelf: 'flex-end', padding: '12px', background: 'linear-gradient(to right, #3b82f6, #6366f1)', color: 'white', fontWeight: '600', borderRadius: '8px', border: 'none', cursor: isRegenerating ? 'not-allowed' : 'pointer' }}>
                  {isRegenerating ? 'Sending...' : 'Send for Regeneration'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ScreenLayout>
  );
};