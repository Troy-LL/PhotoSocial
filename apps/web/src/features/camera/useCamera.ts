import { useCallback, useEffect, useRef, useState } from "react";
import type { FilterKey } from "@passandpic/shared";

const FILTER_CSS: Record<FilterKey, string> = {
  none: "none",
  bw: "grayscale(1)",
  warm: "sepia(0.35) saturate(1.2)",
  cool: "hue-rotate(180deg) saturate(0.8)",
  fade: "contrast(0.9) brightness(1.1) saturate(0.7)",
};

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mirror, setMirror] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("none");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const init = useCallback(async (facing: "user" | "environment" = "user") => {
    setError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(media);
      setFacingMode(facing);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      }
    } catch {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(media);
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          await videoRef.current.play();
        }
      } catch {
        setError("denied");
      }
    }
  }, [stream]);

  useEffect(() => {
    void init("user");
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = useCallback((): Blob | null => {
    const video = videoRef.current;
    if (!video || !stream) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.filter = FILTER_CSS[filter];
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const byteString = atob(dataUrl.split(",")[1]!);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: "image/jpeg" });
  }, [stream, mirror, filter]);

  return {
    videoRef,
    stream,
    error,
    mirror,
    setMirror,
    filter,
    setFilter,
    facingMode,
    init,
    capture,
    filterCss: FILTER_CSS[filter],
  };
}

export function startCountdown(
  seconds: 3 | 5 | 10,
  onTick: (n: number) => void,
  onComplete: () => void
): () => void {
  let remaining = seconds;
  onTick(remaining);
  const id = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      onTick(remaining);
    } else {
      clearInterval(id);
      onComplete();
    }
  }, 1000);
  return () => clearInterval(id);
}
