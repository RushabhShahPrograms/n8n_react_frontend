import React, { useState, useEffect } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import { InputSection } from "@/components/InputSection";
import { Button } from "@/components/ui/button";
import { generateJobId } from "@/lib/utils";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const Screen3URL = "https://wholesomegoods.app.n8n.cloud/webhook/4528c8ee-e405-4e5d-92f3-3c01be2a9f9a";
const REGENERATION_URL = "https://wholesomegoods.app.n8n.cloud/webhook/e0c78210-35ad-4564-9042-31eb8fa51959";
const REGENERATING_IMAGES_KEY = "screen3RegeneratingImages";


// START: NEW POLLING FUNCTION FOR REGENERATION
// This function is specifically designed to parse the simple HTML from the regeneration workflow
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
        const resultData = json?.result ?? null; // This will be the raw HTML string

        if (resultData && typeof resultData === 'string') {
          const parser = new DOMParser();
          const doc = parser.parseFromString(resultData, "text/html");

          // Extract the data from the simple HTML structure
          const outputUrl = doc.querySelector('a')?.href;
          const prompt = doc.querySelector('div > div')?.textContent.trim();

          if (outputUrl && prompt) {
            // Successfully parsed the required data
            console.log("Successfully polled and parsed regen result:", { outputUrl, prompt });
            return { outputUrl, prompt };
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
// END: NEW POLLING FUNCTION FOR REGENERATION


export const Screen3 = ({ response, setResponse, sharedData, setActiveTab, setSharedDataForScreen4, clearSharedData }) => {
  const [activeTab] = useState("Images/Voice");
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("screen3FormData");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      scripts: sharedData?.currentScriptIndex || "",
      insightsMatch: sharedData?.insightsMatch || "",
      imgUrl: sharedData?.imgUrl || "",
      voiceStyle: "Rachel-American-calm-young-female",
      voiceSpeed: "1.0",
      model: sharedData?.model || "Image-Gen",
      lifestyleImagesCount: 1,
      productImagesCount: 1,
    };
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [isWaitingToDisplay, setIsWaitingToDisplay] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loadingDownloads, setLoadingDownloads] = useState([]);
  const JOB_STATE_KEY = "screen3JobState";
  const RESPONSE_KEY = "screen3Response";

  // START: NEW STATE FOR PARSED IMAGE DATA
  const [productImages, setProductImages] = useState([]);
  const [lifestyleImages, setLifestyleImages] = useState([]);
  const [voiceUrl, setVoiceUrl] = useState(null);
  // END: NEW STATE FOR PARSED IMAGE DATA

  // START: MODAL AND REGENERATION STATE
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImageForRegen, setSelectedImageForRegen] = useState(null);
  const [editablePrompt, setEditablePrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingImages, setRegeneratingImages] = useState([]); // Tracks regenerating items by imageUrl
  const [regenModel, setRegenModel] = useState("Image-Gen");
  // END: MODAL AND REGENERATION STATE

  const voiceStyle = [
    "Rachel-American-calm-young-female",
    "Drew-American-well-rounded-middle_aged-male",
    "Clyde-American-war_veteran-middle_aged-male",
    "Paul-American-authoritative-middle_aged-male",
    "Aria-American-husky-middle_aged-female",
    "Domi-American-strong-young-female",
    "Dave-British-conversational-young-male",
    "Roger-confident-middle_aged-male",
    "Fin-Irish-sailor-old-male",
    "Sarah-American-professional-young-female"
  ];
  const voiceSpeed = ["1.0", "1.1", "1.2"];
  const imageCountOptions = [1, 2, 3, 4, 5, 6, 7];

  const proxies = [
    { base: 'https://api.allorigins.win/raw?url=' },
    { base: 'https://corsproxy.io/?' },
    { base: 'https://api.codetabs.com/v1/proxy?quest=' }
  ];

  const inputFields = [
    { label: "Image URL", name: "imgUrl", placeholder: "Image URL from previous screen", required: true },
    { label: "Scripts", type: "textarea", name: "scripts", placeholder: "Script from previous screen", required: true },
    { label: "Insights", type: "textarea", name: "insightsMatch", placeholder: "Insights from previous screen", required: true },
    { label: "Choose Model", name: "model", type: "select", options: ["Image-Gen", "Nano-Banana"] },
    { label: "VOICE STYLE", name: "voiceStyle", type: "select", options: voiceStyle, required: true },
    { label: "VOICE SPEED", name: "voiceSpeed", type: "select", options: voiceSpeed, required: true },
    { label: "Number of Lifestyle Images", name: "lifestyleImagesCount", type: "select", options: imageCountOptions, required: true },
    { label: "Number of Product Images", name: "productImagesCount", type: "select", options: imageCountOptions, required: true },
  ];

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (sharedData && Object.keys(sharedData).length > 0) {
      setFormData((prev) => {
        const isFormEmpty = !prev.scripts && !prev.insightsMatch && !prev.imgUrl;
        if (isFormEmpty) {
          return {
            ...prev,
            scripts: sharedData.currentScriptIndex || "",
            insightsMatch: sharedData.insightsMatch || "",
            imgUrl: sharedData.imgUrl || "",
          };
        }
        return prev;
      });
      if (clearSharedData) clearSharedData();
    }
  }, [sharedData, clearSharedData]);

  useEffect(() => {
    try { localStorage.setItem("screen3FormData", JSON.stringify(formData)); } catch (_) {}
  }, [formData]);

  useEffect(() => {
    try {
      if (response && !response.error) {
        localStorage.setItem(RESPONSE_KEY, typeof response === "string" ? response : JSON.stringify(response));
      }
    } catch (_) {}
  }, [response]);

  const getFilenameFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename || 'downloaded_file';
    } catch {
      return 'downloaded_file';
    }
  };

  const getAudioBlob = async (url) => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error();
      const contentType = res.headers.get('content-type');
      if (!contentType?.startsWith('audio/')) throw new Error();
      return await res.blob();
    } catch {
      const proxyPromises = proxies.map(async ({ base }) => {
        try {
          const proxyUrl = base + encodeURIComponent(url);
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error();
          const contentType = res.headers.get('content-type');
          if (!contentType?.startsWith('audio/')) throw new Error();
          return await res.blob();
        } catch { throw new Error('Proxy failed'); }
      });
      return await Promise.any(proxyPromises);
    }
  };

  const downloadAudio = async (url, filename) => {
    setLoadingDownloads(prev => [...prev, url]);
    try {
      const blob = await getAudioBlob(url);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Audio download failed:', err);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setLoadingDownloads(prev => prev.filter(item => item !== url));
    }
  };

  const getImageBlob = async (url) => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error();
      const contentType = res.headers.get('content-type');
      if (!contentType?.startsWith('image/')) throw new Error();
      return await res.blob();
    } catch {
      const proxyPromises = proxies.map(async ({ base }) => {
        try {
          const proxyUrl = base + encodeURIComponent(url);
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error();
          const contentType = res.headers.get('content-type');
          if (!contentType?.startsWith('image/')) throw new Error();
          return await res.blob();
        } catch { throw new Error('Proxy failed'); }
      });
      return await Promise.any(proxyPromises);
    }
  };

  const downloadImage = async (url, filename) => {
    setLoadingDownloads(prev => [...prev, url]);
    try {
      const blob = await getImageBlob(url);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setLoadingDownloads(prev => prev.filter(item => item !== url));
    }
  };

  const downloadSelectedImages = async () => {
    if (selectedImages.length === 0) {
      alert("Please select at least one image to download.");
      return;
    }
    setLoadingDownloads(prev => [...prev, 'zip']);
    try {
      if (selectedImages.length === 1) {
        const url = selectedImages[0];
        const filename = getFilenameFromUrl(url);
        await downloadImage(url, filename);
      } else {
        const zip = new JSZip();
        const downloadPromises = selectedImages.map(async (url, i) => {
          try {
            const blob = await getImageBlob(url);
            const filename = getFilenameFromUrl(url);
            const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : '.png';
            const name = `image_${i + 1}${ext}`;
            zip.file(name, blob);
          } catch (err) { console.error(`Failed to add ${url}:`, err); }
        });
        await Promise.all(downloadPromises);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'selected_images.zip');
      }
    } catch (err) {
      console.error('Batch download failed:', err);
    } finally {
      setLoadingDownloads(prev => prev.filter(item => item !== 'zip'));
    }
  };

  const handleImageSelection = (url) => {
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((img) => img !== url) : [...prev, url]
    );
  };

  const handleSelectAll = (urls, type) => {
    if (type === 'select') {
      setSelectedImages((prev) => [...new Set([...prev, ...urls])]);
    } else {
      setSelectedImages((prev) => prev.filter((url) => !urls.includes(url)));
    }
  };

  const resumePolling = async (job_id, existingPollStartMs) => {
    const pollTimeoutMs = 20 * 60 * 1000;
    const pollIntervalMs = 2000;
    const pollStart = existingPollStartMs || Date.now();

    setLoading(true);
    setDone(false);

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
            setResponse(resultData);
            setDone(true);
            setIsWaitingToDisplay(true);
            try { localStorage.setItem(RESPONSE_KEY, typeof resultData === "string" ? resultData : JSON.stringify(resultData)); } catch (_) {}

            const waitStart = Date.now();
            try {
              localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ job_id, pollStartMs: pollStart, loading: false, done: true, waiting: true, waitStartMs: waitStart }));
            } catch (_) {}

            setTimeout(() => {
              setIsWaitingToDisplay(false);
              setShowResult(true);
              try {
                const savedState = JSON.parse(localStorage.getItem(JOB_STATE_KEY));
                if (savedState && savedState.job_id === job_id) {
                  localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ ...savedState, waiting: false }));
                }
              } catch (_) {}
            }, 60000);
          }
          break;
        }
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    setLoading(false);
  };

  useEffect(() => {
    try {
      const savedStateJSON = localStorage.getItem(JOB_STATE_KEY);
      const savedResponse = localStorage.getItem(RESPONSE_KEY);

      if (savedResponse && !response) {
        try {
          setResponse(JSON.parse(savedResponse));
        } catch (_) {
          setResponse(savedResponse);
        }
        setDone(true);
      }

      if (savedStateJSON) {
        const savedState = JSON.parse(savedStateJSON);
        const { job_id, pollStartMs, loading: wasLoading, done: wasDone, waiting: wasWaiting, waitStartMs } = savedState;

        if (wasLoading && !wasDone) {
          resumePolling(job_id, pollStartMs);
        } else if (wasDone && wasWaiting) {
          const elapsed = Date.now() - waitStartMs;
          const remaining = 60000 - elapsed;

          if (remaining > 0) {
            setIsWaitingToDisplay(true);
            setTimeout(() => {
              setIsWaitingToDisplay(false);
              setShowResult(true);
              try {
                localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ ...savedState, waiting: false }));
              } catch (_) {}
            }, remaining);
          } else {
            setIsWaitingToDisplay(false);
            setShowResult(true);
          }
        } else if (wasDone && !wasWaiting) {
          setShowResult(true);
        }
      } else if (savedResponse) {
        setShowResult(true);
      }
       // Restore regenerating images state
      const savedRegenerating = localStorage.getItem(REGENERATING_IMAGES_KEY);
      if (savedRegenerating) {
        setRegeneratingImages(JSON.parse(savedRegenerating));
      }
    } catch (_) {}
  }, []);

  const getHtmlFromResponse = (resp) => {
    if (!resp) return "";
    // The main workflow returns a stringified JSON array, so we handle that first.
    if (typeof resp === "string") {
        try {
            const parsed = JSON.parse(resp);
            if (Array.isArray(parsed) && parsed[0]?.formattedOutput) {
                return parsed[0].formattedOutput;
            }
        } catch (e) {
            // If parsing fails, it might be a direct HTML string (like from regeneration)
            return resp;
        }
    }
    // Handle object-based responses
    if (resp && typeof resp === "object") {
        if (Array.isArray(resp) && resp[0]?.formattedOutput) return resp[0].formattedOutput;
        if (typeof resp.formattedOutput === "string") return resp.formattedOutput;
        if (typeof resp.html === "string") return resp.html;
    }
    return String(resp);
  };

  const [validationErrors, setValidationErrors] = useState({});

  const handleSubmit = async () => {
    const errors = {};
    inputFields.forEach((field) => {
      if (field.required && !formData[field.name]) {
        errors[field.name] = `${field.label} is required`;
      }
    });
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setResponse(null);
    setDone(false);
    setShowResult(false);
    setIsWaitingToDisplay(false);
    setSelectedImages([]);
    const job_id = generateJobId();
    const callback_url = `${window.location.origin}/callback`;
    const dataToSend = {
      ...formData,
      job_id,
      callback_url,
      model: formData?.model || "Image-Gen",
    };

    console.log("Data sent to backend:", dataToSend);
    try {
      const res = await fetch(Screen3URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      if (!res.ok) throw new Error(`n8n returned ${res.status}`);

      const pollStart = Date.now();
      try { localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ job_id, pollStartMs: pollStart, loading: true, done: false })); } catch (_) {}
      const pollTimeoutMs = 20 * 60 * 1000;
      const pollIntervalMs = 2000;
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
        } catch (pollError) {}
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      if (resultData == null) {
        setResponse({ error: "Timed out waiting for result. Please try again." });
      } else {
        setResponse(resultData);
        setDone(true);
        setIsWaitingToDisplay(true);
        try { localStorage.setItem(RESPONSE_KEY, typeof resultData === "string" ? resultData : JSON.stringify(resultData)); } catch (_) {}

        const waitStart = Date.now();
        try {
          localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ job_id, pollStartMs: pollStart, loading: false, done: true, waiting: true, waitStartMs: waitStart }));
        } catch (_) {}

        setTimeout(() => {
          setIsWaitingToDisplay(false);
          setShowResult(true);
          try {
            const savedState = JSON.parse(localStorage.getItem(JOB_STATE_KEY));
            if (savedState && savedState.job_id === job_id) {
              localStorage.setItem(JOB_STATE_KEY, JSON.stringify({ ...savedState, waiting: false }));
            }
          } catch (_) {}
        }, 60000);
      }
    } catch (err) {
      console.error("Error calling backend:", err);
      setResponse({ error: `Failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // This effect parses the raw HTML response into structured data
  useEffect(() => {
    if (response && !response.error) {
      setDone(true);
      const html = getHtmlFromResponse(response);
      if (!html || typeof html !== "string") return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Parse Product Images
      const productSection = Array.from(doc.querySelectorAll('h3')).find(h3 => h3.textContent.includes('Product Image'));
      const productList = productSection ? productSection.nextElementSibling.querySelector('ul') : null;
      if (productList) {
        const items = Array.from(productList.querySelectorAll('li')).map(li => {
          const links = Array.from(li.querySelectorAll('a'));
          const outputUrl = links.length > 0 ? links[0].href : null;
          const referenceImage = links.length > 1 ? links[1].href : null;
          const prompt = li.querySelector('div')?.textContent.trim();
          return { outputUrl, prompt, referenceImage, type: 'product' };
        });
        setProductImages(items.filter(item => item.outputUrl));
      }

      // Parse Lifestyle Images
      const lifestyleSection = Array.from(doc.querySelectorAll('h3')).find(h3 => h3.textContent.includes('LifeStyle Image'));
      const lifestyleList = lifestyleSection ? lifestyleSection.nextElementSibling.querySelector('ul') : null;
      if (lifestyleList) {
        const items = Array.from(lifestyleList.querySelectorAll('li')).map(li => {
          const outputUrl = li.querySelector('a')?.href;
          const prompt = li.querySelector('div')?.textContent.trim();
          return { outputUrl, prompt, type: 'lifestyle' };
        });
        setLifestyleImages(items.filter(item => item.outputUrl));
      }

      // Parse Voice URL
      const voiceSection = Array.from(doc.querySelectorAll('h3')).find(h3 => h3.textContent.includes('Voice URL'));
      const voiceLink = voiceSection ? voiceSection.nextElementSibling.querySelector('a') : null;
      if (voiceLink) {
        setVoiceUrl(voiceLink.href);
      }

    } else {
      setDone(false);
      setShowResult(false);
    }
  }, [response]);

  // START: REGENERATION MODAL HANDLERS
  const handleOpenRegenerateModal = (imageData) => {
    setSelectedImageForRegen(imageData);
    setEditablePrompt(imageData.prompt);
    setRegenModel("Image-Gen"); // Reset to default
    setIsModalOpen(true);
  };

  const handleRegenerateSubmit = async () => {
    if (!selectedImageForRegen) return;

    const originalImageUrl = selectedImageForRegen.outputUrl;
    setIsRegenerating(true);
    setRegeneratingImages(prev => [...prev, originalImageUrl]);
    setIsModalOpen(false);

    const dataToSend = {
      prompt: editablePrompt,
      model: regenModel,
      job_id: generateJobId(),
      callback_url: `${window.location.origin}/callback`,
      tag: selectedImageForRegen.type,
      ...(selectedImageForRegen.referenceImage && { referenceImage: selectedImageForRegen.referenceImage }),
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

      // Update the correct image list
      const updateList = (prevList) =>
        prevList.map(image =>
          image.outputUrl === originalImageUrl
            ? { ...image, outputUrl: newImageData.outputUrl, prompt: newImageData.prompt }
            : image
        );

      if (selectedImageForRegen.type === 'product') {
        setProductImages(updateList);
      } else {
        setLifestyleImages(updateList);
      }

    } catch (err) {
      console.error("Regeneration failed:", err);
      alert(`Regeneration failed: ${err.message}`);
    } finally {
      setIsRegenerating(false);
      setRegeneratingImages(prev => prev.filter(url => url !== originalImageUrl));
    }
  };
  // END: REGENERATION MODAL HANDLERS

  // Persist regenerating images state to localStorage
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
          try {
            localStorage.removeItem("screen3FormData");
            localStorage.removeItem(JOB_STATE_KEY);
            localStorage.removeItem(RESPONSE_KEY);
            localStorage.removeItem(REGENERATING_IMAGES_KEY);
          } catch (_) {}
          setFormData({
            scripts: "",
            insightsMatch: "",
            imgUrl: "",
            voiceStyle: "Rachel-American-calm-young-female",
            voiceSpeed: "1.0",
            model: "Image-Gen",
            lifestyleImagesCount: 1,
            productImagesCount: 1,
          });
          setResponse(null);
          setDone(false);
          setShowResult(false);
          setIsWaitingToDisplay(false);
          setSelectedImages([]);
          setProductImages([]);
          setLifestyleImages([]);
          setVoiceUrl(null);
        }}
      >
        Clear Inputs
      </Button>
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
            errors={validationErrors}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {loading ? (
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
          ) : isWaitingToDisplay ? (
            <div className="mt-6 p-6 bg-card rounded-md shadow-soft text-sm text-muted-foreground text-center">
              <div style={{ fontSize: 18, fontWeight: 700 }}>✅ Processing Complete!</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: '8px' }}>
                Displaying results in 1 minute...
              </div>
            </div>
          ) : showResult && response && !response.error ? (
            <>
              {productImages.length > 0 && (
                <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 shadow-sm">
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                    <h3 className="text-sm font-medium text-foreground/80">🖼️ Product Images</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleSelectAll(productImages.map(img => img.outputUrl), 'select')}>Select All</Button>
                      <Button variant="outline" size="sm" onClick={() => handleSelectAll(productImages.map(img => img.outputUrl), 'deselect')}>Deselect All</Button>
                      {selectedImages.length > 0 && (
                        <Button variant="default" size="sm" onClick={downloadSelectedImages} style={{ background: "#10b981", color: "white" }} disabled={loadingDownloads.includes('zip')}>
                          {loadingDownloads.includes('zip') ? 'Zipping...' : `Download Selected (${selectedImages.length})`}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {productImages.map((imgData, index) => (
                      <div key={imgData.outputUrl || index} className="relative flex flex-col items-center gap-2 bg-card/50 p-2 rounded-lg border border-border/20">
                        {regeneratingImages.includes(imgData.outputUrl) && (
                           <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center z-20">
                             <div className="text-white font-bold text-sm text-center">Regenerating...</div>
                           </div>
                        )}
                        <input type="checkbox" checked={selectedImages.includes(imgData.outputUrl)} onChange={() => handleImageSelection(imgData.outputUrl)} className="absolute top-2 left-2 h-5 w-5 z-10"/>
                        <img src={imgData.outputUrl} alt={`Product ${index + 1}`} className="w-full aspect-square object-cover rounded-lg border border-border/30 shadow-md"/>
                        <div className="flex flex-wrap justify-center gap-2 mt-1">
                          <button onClick={() => downloadImage(imgData.outputUrl, `product_image_${index + 1}.png`)} className="px-2 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600" disabled={loadingDownloads.includes(imgData.outputUrl)}>
                            {loadingDownloads.includes(imgData.outputUrl) ? '...' : 'Download'}
                          </button>
                          <button onClick={() => handleOpenRegenerateModal(imgData)} className="px-2 py-1 text-xs rounded-md bg-gray-500 text-white hover:bg-gray-600" disabled={regeneratingImages.includes(imgData.outputUrl)}>
                            Regenerate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lifestyleImages.length > 0 && (
                 <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 shadow-sm">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                      <h3 className="text-sm font-medium text-foreground/80">🌟 Lifestyle Images</h3>
                       <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleSelectAll(lifestyleImages.map(img => img.outputUrl), 'select')}>Select All</Button>
                        <Button variant="outline" size="sm" onClick={() => handleSelectAll(lifestyleImages.map(img => img.outputUrl), 'deselect')}>Deselect All</Button>
                        {selectedImages.length > 0 && (
                          <Button variant="default" size="sm" onClick={downloadSelectedImages} style={{ background: "#10b981", color: "white" }} disabled={loadingDownloads.includes('zip')}>
                            {loadingDownloads.includes('zip') ? 'Zipping...' : `Download Selected (${selectedImages.length})`}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {lifestyleImages.map((imgData, index) => (
                        <div key={imgData.outputUrl || index} className="relative flex flex-col items-center gap-2 bg-card/50 p-2 rounded-lg border border-border/20">
                           {regeneratingImages.includes(imgData.outputUrl) && (
                              <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center z-20">
                                <div className="text-white font-bold text-sm text-center">Regenerating...</div>
                              </div>
                           )}
                          <input type="checkbox" checked={selectedImages.includes(imgData.outputUrl)} onChange={() => handleImageSelection(imgData.outputUrl)} className="absolute top-2 left-2 h-5 w-5 z-10"/>
                          <img src={imgData.outputUrl} alt={`Lifestyle ${index + 1}`} className="w-full aspect-square object-cover rounded-lg border border-border/30 shadow-md"/>
                          <div className="flex flex-wrap justify-center gap-2 mt-1">
                            <button onClick={() => downloadImage(imgData.outputUrl, `lifestyle_image_${index + 1}.png`)} className="px-2 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600" disabled={loadingDownloads.includes(imgData.outputUrl)}>
                              {loadingDownloads.includes(imgData.outputUrl) ? '...' : 'Download'}
                            </button>
                            <button onClick={() => handleOpenRegenerateModal(imgData)} className="px-2 py-1 text-xs rounded-md bg-gray-500 text-white hover:bg-gray-600" disabled={regeneratingImages.includes(imgData.outputUrl)}>
                              Regenerate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
              )}

              {voiceUrl && (
                <div className="mt-4 bg-muted/40 border border-border/30 rounded-xl p-4 text-center shadow-sm">
                  <h3 className="text-sm font-medium mb-2 text-foreground/80">🎤 VoiceOver</h3>
                  <audio controls className="w-full mt-2">
                    <source src={voiceUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                  <button onClick={() => downloadAudio(voiceUrl, getFilenameFromUrl(voiceUrl))} className="mt-2 px-3 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600" disabled={loadingDownloads.includes(voiceUrl)}>
                    {loadingDownloads.includes(voiceUrl) ? 'Downloading...' : 'Download Voice'}
                  </button>
                </div>
              )}
            </>
          ) : response && response.error ? (
            <div className="mt-6 p-6 bg-card rounded-md shadow-soft text-sm text-red-500">
              {response.error}
            </div>
          ) : null}
        </div>
      </div><br/>

      <div className="flex justify-center mt-10">
        {!done ? (
          <Button onClick={handleSubmit} disabled={loading} style={{ flex: 1, textAlign: "center", padding: "12px 16px", borderRadius: "9999px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.3s", background: "linear-gradient(to right, #3b82f6, #6366f1)", color: "white", border: "none", outline: "none" }}>
            {loading ? "Generating..." : "✨ Generate Content"}
          </Button>
        ) : (
          <Button
            onClick={() => {
              setSharedDataForScreen4({
                currentScript: formData.scripts,
                selectedImageUrls: selectedImages,
              });
              setActiveTab("screen4");
            }}
            variant="default"
            style={{ flex: 1, textAlign: "center", padding: "12px 16px", borderRadius: "9999px", fontWeight: 500, cursor: "pointer", transition: "all 0.3s", background: "linear-gradient(to right, #6366f1, #10b981)", color: "white", border: "none", outline: "none" }}
          >
            Go to Images to videos
          </Button>
        )}
      </div>

      {/* Regeneration Modal */}
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
                  <h4 style={{ marginBottom: '0.5rem', fontWeight: '600', color: '#a0aec0' }}>Source Image</h4>
                  <img src={selectedImageForRegen.outputUrl} alt="Source for regeneration" style={{ width: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid #2d3748' }}/>
                </div>
                {selectedImageForRegen.referenceImage && (
                  <div>
                    <h4 style={{ marginBottom: '0.5rem', fontWeight: '600', color: '#a0aec0' }}>Reference Image</h4>
                    <img src={selectedImageForRegen.referenceImage} alt="Reference" style={{ width: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid #2d3748' }}/>
                  </div>
                )}
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