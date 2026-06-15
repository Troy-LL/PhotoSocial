import { useCallback, useEffect, useRef, useState } from "react";

function attachStreamToVideo(video: HTMLVideoElement, media: MediaStream) {
  if (video.srcObject !== media) {
    video.srcObject = media;
  }
  void video.play().catch(() => {});
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mirror, setMirror] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [videoReady, setVideoReady] = useState(false);

  const markVideoReady = useCallback((video: HTMLVideoElement) => {
    setVideoReady(video.videoWidth > 0 && video.videoHeight > 0);
  }, []);

  const pollRef = useRef<ReturnType<typeof window.setInterval> | null>(null);

  const startReadyPoll = useCallback(
    (video: HTMLVideoElement) => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      let ticks = 0;
      pollRef.current = window.setInterval(() => {
        ticks++;
        if (video.videoWidth > 0) {
          markVideoReady(video);
          if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } else if (ticks >= 8) {
          if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      }, 250) as unknown as ReturnType<typeof window.setInterval>;
    },
    [markVideoReady]
  );

  const videoListenersCleanupRef = useRef<(() => void) | null>(null);

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoListenersCleanupRef.current?.();
      videoListenersCleanupRef.current = null;
      videoRef.current = node;

      if (!node) {
        setVideoReady(false);
        return;
      }

      const onReady = () => markVideoReady(node);
      node.addEventListener("loadeddata", onReady);
      node.addEventListener("loadedmetadata", onReady);
      node.addEventListener("resize", onReady);
      node.addEventListener("canplay", onReady);
      node.addEventListener("playing", onReady);
      node.addEventListener("timeupdate", onReady);
      videoListenersCleanupRef.current = () => {
        node.removeEventListener("loadeddata", onReady);
        node.removeEventListener("loadedmetadata", onReady);
        node.removeEventListener("resize", onReady);
        node.removeEventListener("canplay", onReady);
        node.removeEventListener("playing", onReady);
        node.removeEventListener("timeupdate", onReady);
        if (pollRef.current !== null) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };

      if (streamRef.current) {
        attachStreamToVideo(node, streamRef.current);
      }
      startReadyPoll(node);
      onReady();
    },
    [markVideoReady, startReadyPoll]
  );

  const mountedRef = useRef(true);
  const trackEndedCleanupRef = useRef<(() => void) | null>(null);
  const initRef = useRef<
    (facing?: "user" | "environment") => Promise<void>
  >(async () => {});

  const init = useCallback(async (facing: "user" | "environment" = "user") => {
    setError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = media;
      setStream(media);
      setVideoReady(false);
      setFacingMode(facing);
      if (videoRef.current) {
        attachStreamToVideo(videoRef.current, media);
        startReadyPoll(videoRef.current);
      }
      trackEndedCleanupRef.current?.();
      const onTrackEnded = () => {
        if (mountedRef.current) void initRef.current(facing);
      };
      const tracks = media.getVideoTracks();
      tracks.forEach((track) => track.addEventListener("ended", onTrackEnded));
      trackEndedCleanupRef.current = () => {
        tracks.forEach((track) =>
          track.removeEventListener("ended", onTrackEnded)
        );
      };
    } catch {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = media;
        setStream(media);
        setVideoReady(false);
        if (videoRef.current) {
          attachStreamToVideo(videoRef.current, media);
          startReadyPoll(videoRef.current);
        }
        trackEndedCleanupRef.current?.();
        const onTrackEnded = () => {
          if (mountedRef.current) void initRef.current(facing);
        };
        const tracks = media.getVideoTracks();
        tracks.forEach((track) => track.addEventListener("ended", onTrackEnded));
        trackEndedCleanupRef.current = () => {
          tracks.forEach((track) =>
            track.removeEventListener("ended", onTrackEnded)
          );
        };
      } catch {
        streamRef.current = null;
        setStream(null);
        setError("denied");
      }
    }
  }, [startReadyPoll]);

  useEffect(() => {
    initRef.current = init;
  }, [init]);

  useEffect(() => {
    mountedRef.current = true;
    void init("user");
    return () => {
      mountedRef.current = false;
      trackEndedCleanupRef.current?.();
      trackEndedCleanupRef.current = null;
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [init]);

  const capture = useCallback((): Blob | null => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return null;
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const byteString = atob(dataUrl.split(",")[1]!);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: "image/jpeg" });
  }, [mirror]);

  return {
    setVideoRef,
    stream,
    videoReady,
    error,
    mirror,
    setMirror,
    facingMode,
    init,
    capture,
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
