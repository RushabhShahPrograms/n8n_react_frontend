import React, { useState, useEffect, useRef } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const SCREEN7_URL = "https://wholesomegoods.app.n8n.cloud/webhook-test/888561d0ce-f809-410d-af07-2d11cfa91c6a"; // Placeholder URL

// Reusable polling function (adapted from other screens)
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
            try { parsedData = JSON.parse(parsedData); } catch (e) {
              console.error("Failed to parse result data string:", parsedData);
              throw new Error("Received malformed data from server.");
            }
          }
          // Validate the structure for images
          const isValid = Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0]?.images;
          if (isValid) return parsedData;
          
          throw new Error("Received data with unexpected structure.");
        }
      }
    } catch (pollError) {
      console.warn("Polling error:", pollError);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("Timed out waiting for result.");
};

const initialFormData = {
    hook1: "", numberOfImages1: "",
    hook2: "", numberOfImages2: "",
    hook3: "", numberOfImages3: "",
    hook4: "", numberOfImages4: "",
    hook5: "", numberOfImages5: "",
    hook6: "", numberOfImages6: "",
    boardInsights: "Please select an option",
    model: "Image-Gen",
};

export const Screen7 = ({ response, setResponse }) => {
  const [activeTab] = useState("Hook to Image");
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("screen7FormData");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return initialFormData;
  });

  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrlError, setImageUrlError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loadingDownloads, setLoadingDownloads] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [totalImageCount, setTotalImageCount] = useState(0);
  
  const JOB_STATE_KEY = "screen7JobState";
  const RESPONSE_KEY = "screen7Response";
  const fileInputRef = useRef(null);

  // Regeneration State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImageForRegen, setSelectedImageForRegen] = useState(null);
  const [editablePrompt, setEditablePrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingImages, setRegeneratingImages] = useState([]);
  const [regenModel, setRegenModel] = useState("Image-Gen");

  const handleInputChange = (name, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      // If a hook field changed, auto-distribute image counts
      if (name.startsWith('hook')) {
        const filledHooks = [];
        for (let i = 1; i <= 6; i++) {
          const hookText = i === parseInt(name.replace('hook', '')) ? value.trim() : updated[`hook${i}`]?.trim();
          if (hookText) {
            filledHooks.push(i);
          }
        }
        
        // Auto-distribute images based on number of filled hooks
        if (filledHooks.length > 0) {
          const imagesPerHook = Math.floor(12 / filledHooks.length);
          filledHooks.forEach(hookNum => {
            updated[`numberOfImages${hookNum}`] = String(imagesPerHook);
          });
          
          // Clear image counts for empty hooks
          for (let i = 1; i <= 6; i++) {
            if (!filledHooks.includes(i)) {
              updated[`numberOfImages${i}`] = "";
            }
          }
        }
      }
      
      // If a numberOfImages field changed, ensure total doesn't exceed 12
      if (name.startsWith('numberOfImages')) {
        const changedIndex = parseInt(name.replace('numberOfImages', ''));
        const newValue = parseInt(value) || 0;
        
        // Calculate current total excluding the changed field
        let currentTotal = 0;
        for (let i = 1; i <= 6; i++) {
          if (i !== changedIndex) {
            const num = parseInt(updated[`numberOfImages${i}`]) || 0;
            currentTotal += num;
          }
        }
        
        // Cap the new value so total doesn't exceed 12
        const maxAllowed = 12 - currentTotal;
        if (newValue > maxAllowed) {
          updated[name] = String(Math.max(0, maxAllowed));
        }
      }
      
      return updated;
    });
  };

  useEffect(() => {
    try { localStorage.setItem("screen7FormData", JSON.stringify(formData)); } catch (_) {}
    
    // Calculate total images for UI feedback
    let count = 0;
    for (let i = 1; i <= 6; i++) {
        const hook = formData[`hook${i}`]?.trim();
        const numImagesStr = formData[`numberOfImages${i}`];
        if (hook && numImagesStr) {
            count += parseInt(numImagesStr, 10) || 0;
        }
    }
    setTotalImageCount(count);

  }, [formData]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result); // Store as base64
        setImageUrl(""); // Clear URL when file is uploaded
        setImageUrlError("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUrlChange = (url) => {
    setImageUrl(url);
    setImageUrlError("");
    
    if (url.trim()) {
      // Validate and load image from URL
      const img = new Image();
      img.onload = () => {
        setUploadedImage(url);
        if (fileInputRef.current) fileInputRef.current.value = null; // Clear file input
        setImageUrlError("");
      };
      img.onerror = () => {
        setImageUrlError("Invalid image URL or unable to load image");
        setUploadedImage(null);
      };
      img.src = url;
    } else {
      setUploadedImage(null);
    }
  };

  const handleClearUpload = () => {
    setUploadedImage(null);
    setImageUrl("");
    setImageUrlError("");
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const handleSubmit = async () => {
    const requests = [];
    let totalImages = 0;
    const newValidationErrors = {};

    for (let i = 1; i <= 6; i++) {
        const hook = formData[`hook${i}`].trim();
        const numImagesStr = formData[`numberOfImages${i}`];
        const numImages = numImagesStr ? parseInt(numImagesStr, 10) : 0;

        if (hook) {
            if (numImages > 0) {
                requests.push({ hook, numberOfImages: numImages });
                totalImages += numImages;
            } else {
                newValidationErrors[`hook${i}`] = "Please specify # of images.";
            }
        } else if (numImages > 0) {
            newValidationErrors[`hook${i}`] = "Hook text is required.";
        }
    }

    if (totalImages > 12) {
        newValidationErrors.form = "The total number of generated images cannot exceed 12.";
    }
    
    if (requests.length === 0 && Object.keys(newValidationErrors).length === 0) {
        newValidationErrors.form = "Please enter at least one hook and the number of images to generate.";
    }

    setValidationErrors(newValidationErrors);
    if (Object.keys(newValidationErrors).length > 0) {
        return;
    }

    setLoading(true);
    setResponse(null);
    setDone(false);
    setSelectedImages([]);

    const job_id = generateJobId();
    const callback_url = `${window.location.origin}/callback`;
    
    const dataToSend = {
      requests,
      boardInsights: formData.boardInsights === 'Please select an option' ? '' : formData.boardInsights,
      model: formData.model,
      inspirationImage: uploadedImage, // Send base64 image or URL
      job_id,
      callback_url,
    };

    console.log("📤 Data sent to backend:", dataToSend);

    try {
      const res = await fetch(SCREEN7_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      if (!res.ok) throw new Error(`n8n returned ${res.status}`);
      
      localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ job_id }));
      const resultData = await pollForResult(job_id);
      setResponse(resultData);
      setDone(true);
      localStorage.setItem(RESPONSE_KEY, JSON.stringify(resultData));
    } catch (err) {
      console.error("Error during generation:", err);
      setResponse({ error: `Failed: ${err.message}` });
    } finally {
      setLoading(false);
      localStorage.removeItem(JOB_STATE_KEY);
    }
  };
  
  const downloadImage = async (url) => {
    setLoadingDownloads(prev => [...prev, url]);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      saveAs(blob, `image_${Date.now()}.png`);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(url, '_blank');
    } finally {
      setLoadingDownloads(prev => prev.filter(u => u !== url));
    }
  };

  const downloadSelectedImages = async () => {
     if (selectedImages.length === 1) {
      await downloadImage(selectedImages[0]);
      return;
    }
    const zip = new JSZip();
    setLoadingDownloads(prev => [...prev, 'zip']);
    await Promise.all(selectedImages.map(async (url, i) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        zip.file(`image_${i + 1}.png`, blob);
      } catch (e) {
        console.error(`Failed to fetch ${url} for zipping`);
      }
    }));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'selected_images.zip');
    setLoadingDownloads(prev => prev.filter(item => item !== 'zip'));
  };

  const handleImageSelection = (url) => {
    setSelectedImages(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);
  };

  const handleSelectAll = (urls, type) => {
    setSelectedImages(prev => type === 'select' ? [...new Set([...prev, ...urls])] : prev.filter(url => !urls.includes(url)));
  };

  const otherInputFields = [
    {
      label: "Board Insights (Inspiration)",
      name: "boardInsights",
      type: "select",
      options: ["Please select an option", "nutra_scrape", "pattern_wellness", "pet_scrape", "pg-design", "pup_grade", "pw-transitions", "scrape_joint_support"],
    },
    { label: "Choose Model", name: "model", type: "select", options: ["Image-Gen", "Nano-Banana"] },
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
          localStorage.removeItem("screen7FormData");
          localStorage.removeItem(JOB_STATE_KEY);
          localStorage.removeItem(RESPONSE_KEY);
          setFormData(initialFormData);
          setResponse(null);
          setDone(false);
          setSelectedImages([]);
          handleClearUpload();
        }}
      >
        Clear Inputs
      </Button>
      <h1 className="text-2xl font-bold text-white mt-8 mb-4 bg-gradient-primary bg-clip-text text-transparent">
        {activeTab}
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
            {/* Hook Inputs Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground/90 mb-3">Hook Inputs</h3>
              {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="p-4 bg-muted/20 border border-border/20 rounded-lg space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                              <label htmlFor={`hook${i}`} className="text-sm font-medium text-foreground/80 mb-2 block">
                                Hook {i}
                              </label>
                              <input
                                  type="text"
                                  name={`hook${i}`}
                                  id={`hook${i}`}
                                  placeholder={`Enter hook text...`}
                                  value={formData[`hook${i}`]}
                                  onChange={(e) => handleInputChange(e.target.name, e.target.value)}
                                  className="w-full bg-input border border-border/30 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                          </div>
                          <div>
                              <label htmlFor={`numberOfImages${i}`} className="text-sm font-medium text-foreground/80 mb-2 block">
                                Images
                              </label>
                              <input
                                  type="number"
                                  name={`numberOfImages${i}`}
                                  id={`numberOfImages${i}`}
                                  min="1"
                                  max="12"
                                  placeholder="Auto"
                                  value={formData[`numberOfImages${i}`]}
                                  onChange={(e) => handleInputChange(e.target.name, e.target.value)}
                                  disabled={!formData[`hook${i}`]?.trim()}
                                  className="w-full bg-input border border-border/30 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                          </div>
                      </div>
                      {validationErrors[`hook${i}`] && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors[`hook${i}`]}</p>
                      )}
                  </div>
              ))}
            </div>

            {/* Configuration Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground/90 mb-3">Configuration</h3>
              <div className="p-4 bg-muted/20 border border-border/20 rounded-lg space-y-4">
                  {otherInputFields.map(field => (
                      <div key={field.name}>
                          <label htmlFor={field.name} className="text-sm font-medium text-foreground/80 mb-2 block">
                            {field.label}
                          </label>
                          <select
                              name={field.name}
                              id={field.name}
                              value={formData[field.name]}
                              onChange={(e) => handleInputChange(e.target.name, e.target.value)}
                              className="w-full bg-input border border-border/30 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                              {field.options.map(option => (
                                  <option key={option} value={option}>{option}</option>
                              ))}
                          </select>
                      </div>
                  ))}
              </div>
            </div>

           {/* Upload Section */}
           <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground/90 mb-3">Inspiration Image (Optional)</h3>
              <div className="p-4 bg-muted/20 border border-border/20 rounded-lg space-y-4">
                
                <div>
                  <label htmlFor="imageUrl" className="text-sm font-medium text-foreground/80 mb-2 block">
                    Image URL
                  </label>
                  <input
                    type="text"
                    id="imageUrl"
                    placeholder="Enter image URL..."
                    value={imageUrl}
                    onChange={(e) => handleImageUrlChange(e.target.value)}
                    className="w-full bg-input border border-border/30 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                   {imageUrlError && <p className="text-red-500 text-xs mt-1">{imageUrlError}</p>}
                </div>

                <div className="text-center text-xs text-foreground/60">OR</div>

                <div>
                  <label htmlFor="fileUpload" className="text-sm font-medium text-foreground/80 mb-2 block">
                    Upload from computer
                  </label>
                  <input 
                    type="file" 
                    id="fileUpload"
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="block w-full text-sm text-foreground/70
                      file:mr-4 file:py-2 file:px-4 
                      file:rounded-md file:border-0 
                      file:text-sm file:font-semibold 
                      file:bg-primary file:text-primary-foreground 
                      hover:file:bg-primary/90 file:cursor-pointer
                      cursor-pointer" 
                  />
                </div>

                {uploadedImage && (
                  <div className="mt-3 relative inline-block">
                    <img 
                      src={uploadedImage} 
                      alt="upload-preview" 
                      className="w-32 h-32 object-cover rounded-lg border-2 border-border/30" 
                    />
                    <button 
                      type="button" 
                      onClick={handleClearUpload} 
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
           </div>

          {validationErrors.form && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-500 text-sm">{validationErrors.form}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {loading && (
             <div className="mt-6 p-6 bg-card rounded-md shadow-soft text-sm text-muted-foreground flex flex-col items-center justify-center gap-2.5 max-h-52">
              <div className="text-lg font-bold">⏳ IN QUEUE</div>
              <div className="text-sm opacity-90 text-center">Request received. Processing may take up to <strong>5-10 minutes</strong>. Results will appear here when ready.</div>
              <div className="flex gap-2 mt-1.5">
                <div style={{ width: 8, height: 8, borderRadius: 8, background: "#3b82f6", animation: "bounce 0.6s infinite alternate" }} />
                <div style={{ width: 8, height: 8, borderRadius: 8, background: "#60a5fa", animation: "bounce 0.6s 0.15s infinite alternate" }} />
                <div style={{ width: 8, height: 8, borderRadius: 8, background: "#93c5fd", animation: "bounce 0.6s 0.3s infinite alternate" }} />
              </div>
              <style>{`@keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-6px); } }`}</style>
            </div>
          )}
          {response && !response.error && response[0]?.images?.length > 0 && (
            <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-foreground/80">🖼️ Generated Images</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response.flatMap(res => res.images.map(img => img.imageUrl)), 'select')}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={() => handleSelectAll(response.flatMap(res => res.images.map(img => img.imageUrl)), 'deselect')}>Deselect All</Button>
                  {selectedImages.length > 0 && (
                    <Button variant="default" size="sm" onClick={downloadSelectedImages} disabled={loadingDownloads.includes('zip')}>
                      {loadingDownloads.includes('zip') ? 'Zipping...' : `Download (${selectedImages.length})`}
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {response.flatMap(res => res.images).map((imgData, i) => (
                  <div key={i} className="relative group">
                    <input type="checkbox" checked={selectedImages.includes(imgData.imageUrl)} onChange={() => handleImageSelection(imgData.imageUrl)} className="absolute top-2 left-2 h-5 w-5 z-10" />
                    <img src={imgData.imageUrl} alt={`Generated ${i}`} className="w-full h-48 object-cover rounded-lg border border-border/20" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" onClick={() => downloadImage(imgData.imageUrl)} disabled={loadingDownloads.includes(imgData.imageUrl)}>
                        {loadingDownloads.includes(imgData.imageUrl) ? '...' : 'Download'}
                      </Button>
                      <Button size="sm" variant="secondary">Regenerate</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center mt-10">
        {!done ? (
            <Button onClick={handleSubmit} disabled={loading} variant="default" style={{ width: '100%', maxWidth: '28rem', textAlign: "center", padding: "12px 16px", borderRadius: "9999px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.3s", background: "linear-gradient(to right, #3b82f6, #6366f1)", color: "white", border: "none", outline: "none" }}>
              {loading ? "Processing..." : `✨ Generate Images (${totalImageCount}/12)`}
            </Button>
        ) : (
            <Button onClick={handleSubmit} disabled={loading} variant="default" style={{ width: '100%', maxWidth: '28rem', textAlign: "center", padding: "12px 16px", borderRadius: "9999px", fontWeight: 500, cursor: "pointer", transition: "all 0.3s", background: "linear-gradient(to right, #6366f1, #10b981)", color: "white", border: "none", outline: "none" }}>
              {loading ? "Processing..." : "Generation Complete"}
            </Button>
        )}
      </div>
    </ScreenLayout>
  );
};