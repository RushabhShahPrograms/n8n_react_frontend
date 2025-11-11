import React, { useState, useEffect, useRef } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const SCREEN7_URL = "https://wholesomegoods.app.n8n.cloud/webhook/888561d0ce-f809-410d-af07-2d11cfa91c6a";
const REGENERATION_URL = "https://wholesomegoods.app.n8n.cloud/webhook/8a3ac29d-15d4-4e9c-aaad-e52199d94a34";
const REGENERATING_IMAGES_KEY = "screen7RegeneratingImages";

// Reusable polling function for the main generation
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
          if (typeof resultData === "string") return resultData;
          const isValid = Array.isArray(resultData) && resultData.length > 0 && resultData[0]?.images;
          if (isValid) return resultData;
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

// Dedicated polling function for regeneration
const pollForRegenResult = async (job_id) => {
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

        if (resultData && typeof resultData === 'string') {
          const parser = new DOMParser();
          const doc = parser.parseFromString(resultData, "text/html");
          const imageUrl = doc.querySelector('a')?.href;
          const prompt = doc.querySelector('div > div')?.textContent.trim();

          if (imageUrl && prompt) {
            console.log("Successfully polled and parsed regen result:", { imageUrl, prompt });
            return { imageUrl, prompt };
          }
        }
      }
    } catch (pollError) {
      console.warn("Polling error during regeneration:", pollError);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("Timed out waiting for regeneration result.");
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

export const Screen7 = ({ response, setResponse, setActiveTab, setSharedDataForScreen4 }) => {
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
  const [parsedResponse, setParsedResponse] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImageForRegen, setSelectedImageForRegen] = useState(null);
  const [editablePrompt, setEditablePrompt] = useState("");
  const [regenModel, setRegenModel] = useState("Image-Gen");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingImages, setRegeneratingImages] = useState([]);

  const JOB_STATE_KEY = "screen7JobState";
  const RESPONSE_KEY = "screen7Response";
  const fileInputRef = useRef(null);

  // Function to resume polling for an in-progress job
  const resumePolling = async (job_id) => {
    setLoading(true);
    setResponse(null);
    setDone(false);
    try {
      const resultData = await pollForResult(job_id);
      setResponse(resultData);
      setDone(true);
      localStorage.setItem(RESPONSE_KEY, resultData);
    } catch (err) {
      console.error("Error during resumed polling:", err);
      setResponse({ error: `Failed to retrieve result: ${err.message}` });
    } finally {
      setLoading(false);
      localStorage.removeItem(JOB_STATE_KEY);
    }
  };

  // Effect to restore state from localStorage on initial component mount
  useEffect(() => {
    try {
      const savedStateJSON = localStorage.getItem(JOB_STATE_KEY);
      const savedResponse = localStorage.getItem(RESPONSE_KEY);

      if (savedResponse && !response) {
        setResponse(savedResponse);
        setDone(true);
      }

      if (savedStateJSON) {
        const { job_id } = JSON.parse(savedStateJSON);
        if (job_id) {
          resumePolling(job_id);
        }
      }
      
      const savedRegenerating = localStorage.getItem(REGENERATING_IMAGES_KEY);
      if (savedRegenerating) {
        setRegeneratingImages(JSON.parse(savedRegenerating));
      }
    } catch (e) {
      console.error("Failed to restore state from localStorage", e);
      localStorage.removeItem(JOB_STATE_KEY);
      localStorage.removeItem(RESPONSE_KEY);
      localStorage.removeItem(REGENERATING_IMAGES_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to parse the HTML response whenever it changes
  useEffect(() => {
    if (response && typeof response === 'string' && !response.error) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(response, "text/html");
      const hooksData = [];
      const hookContainers = doc.querySelectorAll('div[style*="border: 2px solid"]');
      hookContainers.forEach(container => {
        const hookTitle = container.querySelector('h3')?.textContent || 'Untitled Hook';
        const images = [];
        const imageDivs = container.querySelectorAll('div[style*="border-left: 4px solid"]');
        imageDivs.forEach(imgDiv => {
          const imageUrl = imgDiv.querySelector('a')?.href;
          const prompt = imgDiv.querySelector('div[style*="background: #edf2f7"]')?.textContent.trim();
          if (imageUrl) {
            images.push({ imageUrl, prompt });
          }
        });
        if (images.length > 0) {
          hooksData.push({ hookTitle, images });
        }
      });
      setParsedResponse(hooksData);
    } else {
      setParsedResponse([]);
    }
  }, [response]);

  const handleInputChange = (name, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name.startsWith('hook')) {
        const filledHooks = [];
        for (let i = 1; i <= 6; i++) {
          const hookText = i === parseInt(name.replace('hook', '')) ? value.trim() : updated[`hook${i}`]?.trim();
          if (hookText) filledHooks.push(i);
        }
        if (filledHooks.length > 0) {
          const imagesPerHook = Math.floor(12 / filledHooks.length);
          filledHooks.forEach(hookNum => { updated[`numberOfImages${hookNum}`] = String(imagesPerHook); });
          for (let i = 1; i <= 6; i++) {
            if (!filledHooks.includes(i)) updated[`numberOfImages${i}`] = "";
          }
        }
      }
      if (name.startsWith('numberOfImages')) {
        const changedIndex = parseInt(name.replace('numberOfImages', ''));
        const newValue = parseInt(value) || 0;
        let currentTotal = 0;
        for (let i = 1; i <= 6; i++) {
          if (i !== changedIndex) currentTotal += parseInt(updated[`numberOfImages${i}`]) || 0;
        }
        const maxAllowed = 12 - currentTotal;
        if (newValue > maxAllowed) updated[name] = String(Math.max(0, maxAllowed));
      }
      return updated;
    });
  };

  useEffect(() => {
    try { localStorage.setItem("screen7FormData", JSON.stringify(formData)); } catch (_) {}
    let count = 0;
    for (let i = 1; i <= 6; i++) {
      const hook = formData[`hook${i}`]?.trim();
      const numImagesStr = formData[`numberOfImages${i}`];
      if (hook && numImagesStr) count += parseInt(numImagesStr, 10) || 0;
    }
    setTotalImageCount(count);
  }, [formData]);

  useEffect(() => {
    try {
      if (regeneratingImages.length > 0) {
        localStorage.setItem(REGENERATING_IMAGES_KEY, JSON.stringify(regeneratingImages));
      } else {
        localStorage.removeItem(REGENERATING_IMAGES_KEY);
      }
    } catch (e) {
      console.error("Failed to save regenerating images state:", e);
    }
  }, [regeneratingImages]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
        setImageUrl("");
        setImageUrlError("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUrlChange = (url) => {
    setImageUrl(url);
    setImageUrlError("");
    if (url.trim()) {
      const img = new Image();
      img.onload = () => {
        setUploadedImage(url);
        if (fileInputRef.current) fileInputRef.current.value = null;
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
    if (totalImages > 12) newValidationErrors.form = "The total number of generated images cannot exceed 12.";
    if (requests.length === 0 && Object.keys(newValidationErrors).length === 0) newValidationErrors.form = "Please enter at least one hook and the number of images to generate.";
    setValidationErrors(newValidationErrors);
    if (Object.keys(newValidationErrors).length > 0) return;

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
      inspirationImage: uploadedImage,
      job_id,
      callback_url,
    };

    console.log("📤 Data sent to backend:", dataToSend);

    try {
      localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ job_id, loading: true }));
      const res = await fetch(SCREEN7_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      if (!res.ok) throw new Error(`n8n returned ${res.status}`);
      
      const resultData = await pollForResult(job_id);
      setResponse(resultData);
      setDone(true);
      localStorage.setItem(RESPONSE_KEY, resultData);
    } catch (err) {
      console.error("Error during generation:", err);
      setResponse({ error: `Failed: ${err.message}` });
    } finally {
      setLoading(false);
      localStorage.removeItem(JOB_STATE_KEY);
    }
  };
  
  // START: ROBUST DOWNLOAD LOGIC (from Screen3.jsx)
  const proxies = [
    { base: 'https://api.allorigins.win/raw?url=' },
    { base: 'https://corsproxy.io/?' },
    { base: 'https://api.codetabs.com/v1/proxy?quest=' }
  ];

  const getImageBlob = async (url) => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('Direct fetch failed');
      const contentType = res.headers.get('content-type');
      if (!contentType?.startsWith('image/')) throw new Error('Invalid content type');
      return await res.blob();
    } catch (e) {
      console.warn("Direct fetch failed, trying proxies...", e);
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

  const downloadImage = async (url) => {
    setLoadingDownloads(prev => [...prev, url]);
    try {
      const blob = await getImageBlob(url);
      saveAs(blob, `image_${Date.now()}.png`);
    } catch (error) {
      console.error("All download methods failed:", error);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image_${Date.now()}.png`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      alert("Could not download directly. The image has been opened in a new tab. Please right-click and 'Save Image As...'");
    } finally {
      setLoadingDownloads(prev => prev.filter(u => u !== url));
    }
  };

  const downloadSelectedImages = async () => {
    if (selectedImages.length === 0) return;
    if (selectedImages.length === 1) {
      await downloadImage(selectedImages[0]);
      return;
    }
    const zip = new JSZip();
    setLoadingDownloads(prev => [...prev, 'zip']);
    await Promise.all(selectedImages.map(async (url, i) => {
      try {
        const blob = await getImageBlob(url);
        zip.file(`image_${i + 1}.png`, blob);
      } catch (e) {
        console.error(`Failed to fetch ${url} for zipping`, e);
        zip.file(`FAILED_to_download_${i + 1}.txt`, `Could not download image from: ${url}`);
      }
    }));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'selected_images.zip');
    setLoadingDownloads(prev => prev.filter(item => item !== 'zip'));
  };
  // END: ROBUST DOWNLOAD LOGIC

  const handleImageSelection = (url) => {
    setSelectedImages(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);
  };

  const handleSelectAll = (urls, type) => {
    setSelectedImages(prev => type === 'select' ? [...new Set([...prev, ...urls])] : prev.filter(url => !urls.includes(url)));
  };

  const handleOpenRegenerateModal = (imgData, hookTitle) => {
    setSelectedImageForRegen({ ...imgData, hookTitle });
    setEditablePrompt(imgData.prompt);
    setRegenModel("Image-Gen");
    setIsModalOpen(true);
  };

  const handleRegenerateSubmit = async () => {
    if (!selectedImageForRegen) return;

    const originalImageUrl = selectedImageForRegen.imageUrl;
    setIsRegenerating(true);
    setRegeneratingImages(prev => [...prev, originalImageUrl]);
    setIsModalOpen(false);

    const dataToSend = {
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

      const newImageData = await pollForRegenResult(dataToSend.job_id);

      setResponse(prevResponse => {
        if (typeof prevResponse !== 'string') return prevResponse;
        
        const updatedResponseHtml = prevResponse
          .replace(originalImageUrl, newImageData.imageUrl)
          .replace(selectedImageForRegen.prompt, newImageData.prompt);
        
        localStorage.setItem(RESPONSE_KEY, updatedResponseHtml);
        
        return updatedResponseHtml;
      });

    } catch (err) {
      console.error("Regeneration failed:", err);
      alert(`Regeneration failed: ${err.message}`);
    } finally {
      setIsRegenerating(false);
      setRegeneratingImages(prev => prev.filter(url => url !== originalImageUrl));
      setSelectedImageForRegen(null);
    }
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
        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "linear-gradient(to right, #3b82f6, #6366f1)", color: "white", fontWeight: "500", borderRadius: "9999px", border: "none", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", transition: "all 0.3s" }}
        onMouseOver={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
        onMouseOut={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
        onClick={() => {
          localStorage.removeItem("screen7FormData");
          localStorage.removeItem(JOB_STATE_KEY);
          localStorage.removeItem(RESPONSE_KEY);
          localStorage.removeItem(REGENERATING_IMAGES_KEY);
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
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground/90 mb-3">Hook Inputs</h3>
              {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="p-4 bg-muted/20 border border-border/20 rounded-lg space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                              <label htmlFor={`hook${i}`} className="text-sm font-medium text-foreground/80 mb-2 block">Hook {i}</label>
                              <input type="text" name={`hook${i}`} id={`hook${i}`} placeholder={`Enter hook text...`} value={formData[`hook${i}`]} onChange={(e) => handleInputChange(e.target.name, e.target.value)} className="w-full bg-input border border-border/30 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                          </div>
                          <div>
                              <label htmlFor={`numberOfImages${i}`} className="text-sm font-medium text-foreground/80 mb-2 block">Images</label>
                              <input type="number" name={`numberOfImages${i}`} id={`numberOfImages${i}`} min="1" max="12" placeholder="Auto" value={formData[`numberOfImages${i}`]} onChange={(e) => handleInputChange(e.target.name, e.target.value)} disabled={!formData[`hook${i}`]?.trim()} className="w-full bg-input border border-border/30 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed" />
                          </div>
                      </div>
                      {validationErrors[`hook${i}`] && <p className="text-red-500 text-xs mt-1">{validationErrors[`hook${i}`]}</p>}
                  </div>
              ))}
            </div>
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground/90 mb-3">Configuration</h3>
              <div className="p-4 bg-muted/20 border border-border/20 rounded-lg space-y-4">
                  {otherInputFields.map(field => (
                      <div key={field.name}>
                          <label htmlFor={field.name} className="text-sm font-medium text-foreground/80 mb-2 block">{field.label}</label>
                          <select name={field.name} id={field.name} value={formData[field.name]} onChange={(e) => handleInputChange(e.target.name, e.target.value)} className="w-full bg-input border border-border/30 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                              {field.options.map(option => <option key={option} value={option}>{option}</option>)}
                          </select>
                      </div>
                  ))}
              </div>
            </div>
           <div className="space-y-4">
              <h3 className="text-base font-semibold text-foreground/90 mb-3">Inspiration Image (Optional)</h3>
              <div className="p-4 bg-muted/20 border border-border/20 rounded-lg space-y-4">
                <div>
                  <label htmlFor="imageUrl" className="text-sm font-medium text-foreground/80 mb-2 block">Image URL</label>
                  <input type="text" id="imageUrl" placeholder="Enter image URL..." value={imageUrl} onChange={(e) => handleImageUrlChange(e.target.value)} className="w-full bg-input border border-border/30 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                   {imageUrlError && <p className="text-red-500 text-xs mt-1">{imageUrlError}</p>}
                </div>
                <div className="text-center text-xs text-foreground/60">OR</div>
                <div>
                  <label htmlFor="fileUpload" className="text-sm font-medium text-foreground/80 mb-2 block">Upload from computer</label>
                  <input type="file" id="fileUpload" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="block w-full text-sm text-foreground/70 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer cursor-pointer" />
                </div>
                {(uploadedImage || imageUrl) && (
                  <div className="mt-3 relative">
                    <div className="border border-border/30 rounded-lg overflow-hidden">
                      <img src={uploadedImage || imageUrl} alt="Image Preview" className="w-full h-auto max-h-40 object-contain" />
                    </div>
                    {uploadedImage && <button type="button" onClick={handleClearUpload} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors" aria-label="Remove image">×</button>}
                  </div>
                )}
              </div>
           </div>
          {validationErrors.form && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"><p className="text-red-500 text-sm">{validationErrors.form}</p></div>}
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
          {parsedResponse.length > 0 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center p-4 bg-muted/20 border border-border/20 rounded-lg">
                  <h3 className="text-sm font-medium text-foreground/80">🖼️ Generated Images</h3>
                  <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleSelectAll(parsedResponse.flatMap(res => res.images.map(img => img.imageUrl)), 'select')}>Select All</Button>
                      <Button variant="outline" size="sm" onClick={() => handleSelectAll(parsedResponse.flatMap(res => res.images.map(img => img.imageUrl)), 'deselect')}>Deselect All</Button>
                      {selectedImages.length > 0 && <Button className="text-black" variant="default" size="sm" onClick={downloadSelectedImages} disabled={loadingDownloads.includes('zip')}>{loadingDownloads.includes('zip') ? 'Zipping...' : `Download (${selectedImages.length})`}</Button>}
                  </div>
              </div>
              {parsedResponse.map((hookData, index) => (
                <div key={index} className="bg-muted/40 border border-border/30 rounded-xl p-4 shadow-sm">
                  <h4 className="text-md font-semibold text-foreground mb-4">{hookData.hookTitle}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hookData.images.map((imgData, i) => (
                      <div key={imgData.imageUrl || i} className="relative group">
                        {regeneratingImages.includes(imgData.imageUrl) && (
                           <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center z-20">
                             <div className="text-white font-bold text-sm text-center">Regenerating...</div>
                           </div>
                        )}
                        <input type="checkbox" checked={selectedImages.includes(imgData.imageUrl)} onChange={() => handleImageSelection(imgData.imageUrl)} className="absolute top-2 left-2 h-5 w-5 z-10" />
                        <img src={imgData.imageUrl} alt={`Generated for ${hookData.hookTitle} - ${i+1}`} className="w-full h-48 object-cover rounded-lg border border-border/20" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button className="text-black" size="sm" onClick={() => downloadImage(imgData.imageUrl)} disabled={loadingDownloads.includes(imgData.imageUrl)}>{loadingDownloads.includes(imgData.imageUrl) ? 'Downloading...' : 'Download'}</Button>
                          <Button size="sm" variant="secondary" onClick={() => handleOpenRegenerateModal(imgData, hookData.hookTitle)} disabled={regeneratingImages.includes(imgData.imageUrl)}>Regenerate</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {response && response.error && <div className="mt-6 p-6 bg-card rounded-md shadow-soft text-sm text-red-500">{response.error}</div>}
        </div>
      </div>
      <div className="flex justify-center mt-10">
        {!done ? (
          <Button onClick={handleSubmit} disabled={loading} variant="default" style={{ width: '100%', maxWidth: '28rem', textAlign: "center", padding: "12px 16px", borderRadius: "9999px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.3s", background: "linear-gradient(to right, #3b82f6, #6366f1)", color: "white", border: "none", outline: "none" }}>
            {loading ? "Processing..." : `✨ Generate Images (${totalImageCount}/12)`}
          </Button>
        ) : selectedImages.length > 0 ? (
          <Button
            onClick={() => {
              setSharedDataForScreen4({
                selectedImageUrls: selectedImages,
              });
              setActiveTab("screen4");
            }}
            variant="default"
            style={{ width: '100%', maxWidth: '28rem', textAlign: "center", padding: "12px 16px", borderRadius: "9999px", fontWeight: 500, cursor: "pointer", transition: "all 0.3s", background: "linear-gradient(to right, #6366f1, #10b981)", color: "white", border: "none", outline: "none" }}
          >
            Go to Images to videos
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading} variant="default" style={{ width: '100%', maxWidth: '28rem', textAlign: "center", padding: "12px 16px", borderRadius: "9999px", fontWeight: 500, cursor: "pointer", transition: "all 0.3s", background: "linear-gradient(to right, #3b82f6, #6366f1)", color: "white", border: "none", outline: "none" }}>
            {loading ? "Processing..." : "✨ Generate More"}
          </Button>
        )}
      </div>

      {isModalOpen && selectedImageForRegen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10, 10, 20, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setIsModalOpen(false)}>
          <div style={{ background: '#1a202c', color: '#e2e8f0', width: '60vw', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)', border: '1px solid #2d3748', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #2d3748', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Regenerate Image</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ display: 'flex', padding: '1.5rem', gap: '1.5rem', overflowY: 'auto' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h4 style={{ marginBottom: '0.5rem', fontWeight: '600', color: '#a0aec0' }}>Original Hook</h4>
                  <p style={{ background: '#2d3748', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>{selectedImageForRegen.hookTitle}</p>
                </div>
                <div>
                  <h4 style={{ marginBottom: '0.5rem', fontWeight: '600', color: '#a0aec0' }}>Generated Image</h4>
                  <img src={selectedImageForRegen.imageUrl} alt="Source for regeneration" style={{ width: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid #2d3748' }}/>
                </div>
              </div>
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <h4 style={{ marginBottom: '0.5rem', fontWeight: '600', color: '#a0aec0' }}>Animation Prompt</h4>
                  <textarea value={editablePrompt} onChange={(e) => setEditablePrompt(e.target.value)} style={{ flexGrow: 1, width: '100%', background: '#2d3748', color: '#e2e8f0', border: '1px solid #4a5568', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem', resize: 'vertical', minHeight: '200px' }}/>
                </div>
                <div>
                  <label htmlFor="regenModelSelect" style={{ fontSize: '0.8rem', color: '#a0aec0', marginBottom: '0.5rem', display: 'block' }}>Choose Model</label>
                  <select id="regenModelSelect" value={regenModel} onChange={(e) => setRegenModel(e.target.value)} style={{ width: '100%', background: '#2d3748', color: '#e2e8f0', border: '1px solid #4a5568', borderRadius: '8px', padding: '0.75rem', fontSize: '0.9rem' }}>
                    <option value="Image-Gen">Image-Gen</option>
                    <option value="Nano-Banana">Nano-Banana</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '1.5rem', borderTop: '1px solid #2d3748', display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={handleRegenerateSubmit} disabled={isRegenerating} style={{ background: 'linear-gradient(to right, #3b82f6, #6366f1)', color: 'white', fontWeight: '600', borderRadius: '8px', border: 'none', cursor: isRegenerating ? 'not-allowed' : 'pointer' }}>
                {isRegenerating ? 'Sending...' : 'Send for Regeneration'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ScreenLayout>
  );
};