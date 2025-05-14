// pages/index.tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

import successAnimation from "../public/animations/success.json";
import errorAnimation from "../public/animations/error.json";
import loadingAnimation from "../public/animations/loading.json";

export default function Home() {
  const [mainVideo, setMainVideo] = useState<File | null>(null);
  const [clipVideo, setClipVideo] = useState<File | null>(null);
  const [startTimestamp, setStartTimestamp] = useState("");
  const [endTimestamp, setEndTimestamp] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);

  const fileLimitMB = 200;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, setter: (file: File | null) => void) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.size / 1024 / 1024 <= fileLimitMB) {
      setter(file);
    } else {
      alert(`File must be smaller than ${fileLimitMB}MB.`);
    }
  };

  const handleSubmit = async () => {
    if (!mainVideo || !clipVideo || !startTimestamp || !endTimestamp) {
      alert("Please provide all inputs.");
      return;
    }

    setStatus("loading");
    setProgress(0);
    const formData = new FormData();
    formData.append("mainVideo", mainVideo);
    formData.append("clipVideo", clipVideo);
    formData.append("startTimestamp", startTimestamp);
    formData.append("endTimestamp", endTimestamp);

    try {
      const res = await fetch("/api/splice-videos", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      const data = JSON.parse(text);

      if (data.id) {
        let attempts = 0;
        const maxAttempts = 30;

        const poll = async () => {
          const statusRes = await fetch(`/api/check-status?id=${data.id}`);
          const result = await statusRes.json();

          if (result.status === "done") {
            setOutputUrl(result.url);
            setStatus("success");
          } else if (result.status === "failed") {
            setStatus("error");
          } else {
            setProgress(Math.min(100, Math.floor((attempts / maxAttempts) * 100)));
            if (++attempts <= maxAttempts) {
              setTimeout(poll, 2000);
            } else {
              setStatus("error");
            }
          }
        };

        poll();
      } else {
        console.error("Splicing error: No render ID returned", data);
        setStatus("error");
      }
    } catch (err) {
      console.error("Frontend error:", err);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-[#EF2850] px-4 flex items-center justify-center">
      <div className="w-full max-w-xl mx-auto bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-extrabold mb-8 text-center">⚡ Splice Your Videos</h1>

        {status === "idle" && (
          <div className="space-y-6">
            {[{ label: "Main Video", setter: setMainVideo, file: mainVideo }, { label: "Clip Video", setter: setClipVideo, file: clipVideo }].map(({ label, setter, file }) => (
              <div
                key={label}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, setter)}
                className="bg-white/30 border-2 border-dashed border-[#EF2850] rounded-xl p-6 text-center cursor-pointer hover:bg-white/40 transition"
              >
                <label className="cursor-pointer block">
                  <p className="mb-3 font-semibold text-white">Drop {label} Here or Click to Upload</p>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setter(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div className="bg-white text-black px-4 py-2 rounded border inline-block">Select File</div>
                </label>
                {file && <p className="text-sm mt-3 text-white">✅ {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>}
                <p className="text-xs text-gray-300 mt-2">Max Size: {fileLimitMB}MB</p>
              </div>
            ))}

            <input
              type="text"
              placeholder="Start Timestamp (e.g. 00:01:30)"
              value={startTimestamp}
              onChange={(e) => setStartTimestamp(e.target.value)}
              className="bg-white border border-[#C5D143] text-black p-4 rounded w-full"
            />

            <input
              type="text"
              placeholder="End Timestamp (e.g. 00:02:00)"
              value={endTimestamp}
              onChange={(e) => setEndTimestamp(e.target.value)}
              className="bg-white border border-[#C5D143] text-black p-4 rounded w-full"
            />

            <button
              onClick={handleSubmit}
              disabled={status === "loading"}
              className="bg-[#EF2850] text-white px-6 py-4 rounded-xl w-full font-semibold hover:bg-pink-700 transition"
            >
              Submit
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="text-center mt-12">
            <div className="bg-white/20 p-6 rounded-xl">
              <Lottie animationData={loadingAnimation} className="w-48 mx-auto" loop />
              <div className="bg-gray-700 mt-6 h-4 rounded-full overflow-hidden">
                <div
                  className="bg-[#EF2850] h-full"
                  style={{ width: `${progress}%`, transition: "width 0.5s" }}
                ></div>
              </div>
              <p className="mt-2 text-sm text-white">Processing... {progress}%</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="mt-8 text-center">
            <div className="bg-white/20 p-6 rounded-xl">
              <Lottie animationData={successAnimation} className="w-48 mx-auto" loop={false} />
              <video src={outputUrl} controls width="100%" className="mt-6 rounded-xl" />
              <a href={outputUrl} download target="_blank" className="text-[#EF2850] underline block mt-4">
                ⬇️ Download or View Final Video
              </a>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="mt-8 text-center">
            <div className="bg-white/20 p-6 rounded-xl">
              <Lottie animationData={errorAnimation} className="w-48 mx-auto" loop={false} />
              <p className="text-red-500 mt-4">Something went wrong. Please try again.</p>
              <button
                onClick={() => {
                  setStatus("idle");
                  setMainVideo(null);
                  setClipVideo(null);
                  setStartTimestamp("");
                  setEndTimestamp("");
                  setOutputUrl("");
                  setProgress(0);
                }}
                className="mt-4 bg-[#EF2850] text-white px-4 py-2 rounded hover:bg-pink-700"
              >
                🔁 Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}