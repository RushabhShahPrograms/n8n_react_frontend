import React, { useState, useEffect, useRef } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const Screen6URL = "https://wholesomegoods.app.n8n.cloud/webhook/64c4971c-3471-4759-b2ee-a9f6438f971a";
// const Screen6URL = "https://wholesomegoods.app.n8n.cloud/webhook-test/64c4971c-3471-4759-b2ee-a9f6438f971a";

export const Screen6 = ({ setActiveTab, sharedDataForScreen6, setSharedDataForScreen6 }) => {
  const [activeTab] = useState("Image to Multiple videos");
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("screen6FormData");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      imageUrl: "",
      videoCount: "1",
      animationPrompt: "",
    };
  });
  const [uploadedImage, setUploadedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [response, setResponse] = useState(null);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [loadingDownloads, setLoadingDownloads] = useState([]); // To track download status
  const JOB_STATE_KEY = "screen6JobState"; // { job_id, pollStartMs, loading, done }
  const RESPONSE_KEY = "screen6Response"; // stringified JSON or string
  const fileInputRef = useRef(null);

  // handle input
  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Auto-save to localStorage
  useEffect(() => {
    try { localStorage.setItem("screen6FormData", JSON.stringify(formData)); } catch (_) {}
  }, [formData]);

  // Persist response whenever it changes
  useEffect(() => {
    try {
      if (response && !response.error) {
        localStorage.setItem(
          RESPONSE_KEY,
          typeof response === "string" ? response : JSON.stringify(response)
        );
      }
    } catch (_) {}
  }, [response]);

  // handle image upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // send to backend
  const handleSubmit = async () => {
    setLoading(true);
    setResponse(null);
    setDone(false);
    setSelectedVideos([]);
    const job_id = generateJobId();
    const callback_url = `${window.location.origin}/callback`;
    const dataToSend = {
      imageUrl: formData.imageUrl,
      uploadedImage,
      videoCount: formData.videoCount,
      animationPrompt: formData.animationPrompt,
      job_id,
      callback_url,
    };

    console.log("📤 Data sent to backend:", dataToSend);

    try {
      const res = await fetch(Screen6URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      if (!res.ok) {
        throw new Error(`n8n returned ${res.status}`);
      }

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
      setResponse({ error: "Failed to connect to backend" });
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
    // Fast path: direct fetch
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('Direct fetch failed');
      const contentType = res.headers.get('content-type');
      if (!contentType?.startsWith('video/')) throw new Error('Invalid content type');
      return await res.blob();
    } catch (e) {
      console.warn("Direct fetch failed, trying proxies...", e);
      // Fallback path: try CORS proxies
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
      // Final fallback: open in new tab
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
      alert('An error occurred while creating the zip file. Please try downloading the videos individually.');
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

  // Resume polling/restore state on mount
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
              } catch (_) {}
              await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            }
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
          try { localStorage.removeItem("screen6FormData"); } catch (_) {}
          try { localStorage.removeItem(JOB_STATE_KEY); } catch (_) {}
          try { localStorage.removeItem(RESPONSE_KEY); } catch (_) {}
          setFormData({ imageUrl: "", videoCount: "1", animationPrompt: "" });
          setResponse(null);
          setDone(false);
          setUploadedImage(null);
          setSelectedVideos([]);
        }}
      >
        Clear Inputs
      </Button>
      <h1 className="text-2xl font-bold text-white mt-8 mb-4 bg-gradient-primary bg-clip-text text-transparent">
        {activeTab}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN — Inputs */}
        <div className="lg:col-span-1 space-y-6">
          <InputSection
            title="Image Source"
            fields={[
              {
                label: "Image URL",
                name: "imageUrl",
                placeholder: "Enter image URL",
              },
            ]}
            onChange={handleInputChange}
            values={formData}
          />

          {formData.imageUrl && (
            <div className="mt-3 border border-border/30 rounded-lg overflow-hidden">
              <img
                src={formData.imageUrl}
                alt="Preview"
                className="w-full h-auto max-h-40 object-contain"
              />
            </div>
          )}

          <div className="bg-muted/40 border border-border/30 rounded-xl p-4 mt-4">
            <h3 className="text-sm font-medium mb-2 text-foreground/80">
              📁 OR Upload Image
            </h3>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4
                         file:rounded-full file:border-0 file:text-sm file:font-semibold
                         file:bg-purple-600 file:text-white hover:file:bg-purple-700"
            />
            {uploadedImage && (
              <div className="mt-3">
                <div className="border border-border/30 rounded-lg overflow-hidden">
                  <img
                    src={uploadedImage}
                    alt="Uploaded"
                    className="w-full h-auto max-h-40 object-contain"
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUploadedImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = null;
                    }}
                  >
                    Remove uploaded image
                  </Button>
                </div>
              </div>
            )}
          </div>

          <InputSection
            title="Video Count"
            fields={[
              {
                label: "Amount of Videos to Generate",
                name: "videoCount",
                type: "select",
                options: [1, 2, 3, 4],
              },
            ]}
            onChange={handleInputChange}
            values={formData}
          />

          <InputSection
            title="Animation Prompt"
            fields={[
              {
                label: "Animation Prompt (Optional)",
                name: "animationPrompt",
                type: "textarea",
                placeholder: "e.g., cinematic, dolly zoom, slow motion, vibrant colors...",
              },
            ]}
            onChange={handleInputChange}
            values={formData}
          />
        </div>

        {/* RIGHT COLUMN — Preview or Result */}
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
              <style>{`
                @keyframes bounce {
                  from { transform: translateY(0); opacity: 1; }
                  to { transform: translateY(-6px); opacity: 0.7; }
                }
              `}</style>
            </div>
          )}
          {response && !response.error && response[0]?.videoUrlsArray?.length > 0 && (
            <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-foreground/80">
                  🎬 Generated Videos ({response[0].videoUrlsArray.length})
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videoUrlsArray.filter(url => typeof url === 'string' && url.startsWith('http')), 'select')}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response[0].videoUrlsArray, 'deselect')}>Deselect All</Button>
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
                {response[0].videoUrlsArray.map((videoUrl, i) => {
                  const isError = typeof videoUrl !== 'string' || !videoUrl.startsWith('http');

                  return (
                    <div key={i} className="relative flex flex-col items-center gap-2">
                      {isError ? (
                        <div
                          style={{ width: "160px", height: "160px" }}
                          className="rounded-lg border border-border/20 bg-red-100 flex flex-col items-center justify-center text-center p-2"
                        >
                          <span className="text-red-600 font-bold text-lg">Error</span>
                          <span className="text-red-500 text-xs mt-1">
                            Failed to generate video. (Details: {videoUrl})
                          </span>
                        </div>
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            checked={selectedVideos.includes(videoUrl)}
                            onChange={() => handleVideoSelection(videoUrl)}
                            className="absolute top-2 left-2 h-5 w-5 z-10 cursor-pointer"
                          />
                          <video
                            src={videoUrl}
                            controls
                            loop
                            playsInline
                            style={{ width: "160px", height: "160px", objectFit: "cover" }}
                            className="rounded-lg border border-border/20"
                          />
                          <button
                            onClick={() => downloadVideo(videoUrl, `video_${i + 1}.mp4`)}
                            className="px-3 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            disabled={loadingDownloads.includes(videoUrl)}
                          >
                            {loadingDownloads.includes(videoUrl) ? 'Downloading...' : 'Download'}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {response && response.error && (
            <div className="p-6 bg-card rounded-md shadow-soft text-sm text-red-500">
              {response.error}
            </div>
          )}
        </div>
      </div><br/>

      <div className="flex justify-center mt-10">
        {!done ? (
          <Button
            onClick={handleSubmit}
            disabled={loading || (!formData.imageUrl && !uploadedImage)}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "12px 16px",
              borderRadius: "9999px",
              fontWeight: 500,
              cursor: (loading || (!formData.imageUrl && !uploadedImage)) ? "not-allowed" : "pointer",
              transition: "all 0.3s",
              background: "linear-gradient(to right, #8b5cf6, #6366f1)",
              color: "white",
              border: "none",
              opacity: (loading || (!formData.imageUrl && !uploadedImage)) ? 0.6 : 1,
            }}
          >
            {loading ? "Processing..." : "✨ Generate Videos"}
          </Button>
        ) : (
          <Button
            onClick={() => setActiveTab("main")}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "12px 16px",
              borderRadius: "9999px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.3s",
              background: "linear-gradient(to right, #10b981, #34d399)",
              color: "white",
              border: "none",
            }}
          >
            Back to Hook and CTA
          </Button>
        )}
      </div>
    </ScreenLayout>
  );
};