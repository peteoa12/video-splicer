"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import Image from "next/image";

import successAnimation from "../public/animations/success.json";
import errorAnimation from "../public/animations/error.json";
import loadingAnimation from "../public/animations/loading.json";
import logo from "../public/logo.svg";

export default function Home() {
  const [mainVideo, setMainVideo] = useState<File | null>(null);
  const [clipVideo, setClipVideo] = useState<File | null>(null);
  const [startTimestamp, setStartTimestamp] = useState("");
  const [endTimestamp, setEndTimestamp] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [resolution, setResolution] = useState("mobile");

  const fileLimitMB = 200;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (file: File | null) => void) => {
    const file = e.target.files?.[0];
    if (file && file.size / 1024 / 1024 <= fileLimitMB) setter(file);
    else alert(`File must be smaller than ${fileLimitMB}MB.`);
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
    formData.append("resolution", resolution);

    try {
      const res = await fetch("/api/splice-videos", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
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
            if (++attempts <= maxAttempts) setTimeout(poll, 2000);
            else setStatus("error");
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
    <div className="font-sans min-h-screen relative overflow-hidden text-white px-4 py-10 flex items-center justify-center">
      <div className="absolute inset-0 z-0 animate-[backgroundMove_30s_linear_infinite] bg-gradient-to-br from-black via-gray-900 to-black bg-[length:400%_400%]" />

      <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-white/10 backdrop-blur-xl shadow-[0_0_60px_rgba(255,255,255,0.05)] p-8">
      <div className="flex justify-center mb-8">
        <Image
          src={logo}
          alt="App Logo"
          width={200}
          height={48}
          className="h-12 w-auto"
          priority
        />
      </div>

        {(status === "idle" || status === "error") && (
          <div className="space-y-5">
            {[{ label: "Main Video", setter: setMainVideo, file: mainVideo }, { label: "Clip Video", setter: setClipVideo, file: clipVideo }].map(({ label, setter, file }) => (
              <div key={label} className="bg-white/20 rounded-xl p-5 border border-[#EF2850]/30">
                <p className="text-white font-semibold mb-2">{label}</p>
                <input type="file" accept="video/*" onChange={(e) => setter(e.target.files?.[0] || null)} className="block w-full" />
                {file && <p className="text-sm mt-2 text-white/80">✅ {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>}
              </div>
            ))}

            <input
              type="text"
              placeholder="Start Timestamp (e.g. 00:01:30)"
              value={startTimestamp}
              onChange={(e) => setStartTimestamp(e.target.value)}
              className="bg-white/20 text-white placeholder-white/60 px-4 py-3 rounded-xl w-full"
            />

            <input
              type="text"
              placeholder="End Timestamp (e.g. 00:02:00)"
              value={endTimestamp}
              onChange={(e) => setEndTimestamp(e.target.value)}
              className="bg-white/20 text-white placeholder-white/60 px-4 py-3 rounded-xl w-full"
            />

            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="bg-white/20 text-white px-4 py-3 rounded-xl w-full"
            >
              <option value="mobile">9:16 (Mobile Portrait)</option>
              <option value="hd">16:9 (HD Landscape)</option>
              <option value="square">1:1 (Square)</option>
            </select>

            <button
              onClick={handleSubmit}
              disabled={status === "loading"}
              className="bg-[#EF2850] text-white px-6 py-4 rounded-xl w-full font-bold hover:bg-pink-700 transition"
            >
              SPLICE
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="text-center py-16">
            <Lottie animationData={loadingAnimation} className="w-40 mx-auto" loop />
            <div className="bg-gray-700 mt-6 h-4 rounded-full overflow-hidden">
              <div
                className="bg-[#EF2850] h-full"
                style={{ width: `${progress}%`, transition: "width 0.5s" }}
              ></div>
            </div>
            <p className="mt-2 text-sm text-white/80">Processing... {progress}%</p>
          </div>
        )}

        {status === "success" && (
          <div className="mt-8 text-center">
            <Lottie animationData={successAnimation} className="w-40 mx-auto" loop={false} />
            <div className={`mx-auto mt-6 rounded-xl overflow-hidden ${
              resolution === "mobile" ? "aspect-[9/16]" :
              resolution === "square" ? "aspect-square" :
              "aspect-video"
            }`}>
              <video src={outputUrl} controls className="w-full h-full object-contain" />
            </div>
            <a
              href={outputUrl}
              download
              target="_blank"
              className="text-[#EF2850] underline block mt-4"
            >
              ⬇️ Download or View Final Video
            </a>
          </div>
        )}

        {status === "error" && (
          <div className="mt-8 text-center">
            <Lottie animationData={errorAnimation} className="w-40 mx-auto" loop={false} />
            <p className="text-red-400 mt-4">Something went wrong. Please try again.</p>
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
        )}
      </div>

      <style jsx>{`
        @keyframes backgroundMove {
          0% { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
      `}</style>
    </div>
  );
}