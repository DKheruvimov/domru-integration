import React, { useEffect, useRef, useState } from "react";
import { SmartDevice, SmartCamera, AppCredentials } from "../../types";
import { Video, VideoOff, RefreshCw, Terminal, Lock, Unlock, PhoneForwarded, PhoneOff } from "lucide-react";
import AutoOpenConfigModal from "./AutoOpenConfigModal";
import SipLogsViewer from "./SipLogsViewer";
import { formatTimeInTimezone } from "../../lib/timezone";
import { getSocket } from "../../socket";

interface CctvPlayerProps {
  activeCamera: string;
  devices: SmartDevice[];
  cameras: SmartCamera[];
  credentials: AppCredentials;
  snapshotTime: number;
  playerMode: "stream" | "snapshot";
  setPlayerMode: (mode: "stream" | "snapshot") => void;
  hasStreamError: boolean;
  setHasStreamError: (val: boolean) => void;
  forceHlsJS: boolean;
  setForceHlsJS: (val: boolean) => void;
  streamUrl: string | null;
  streamType: string | null;
  loadingStream: boolean;
  streamLogs: string[];
  setStreamLogs: React.Dispatch<React.SetStateAction<string[]>>;
  addStreamLog: (msg: string) => void;
  onClose: () => void;
  selectedPlaceId?: number;
  openingDoorId: number | null;
  triggerOpenDoor: (id: number) => void;
  isDevModeEnabled?: boolean;
}

export default function CctvPlayer({
  activeCamera,
  devices,
  cameras,
  credentials,
  snapshotTime,
  playerMode,
  setPlayerMode,
  hasStreamError,
  setHasStreamError,
  forceHlsJS,
  setForceHlsJS,
  streamUrl,
  streamType,
  loadingStream,
  streamLogs,
  setStreamLogs,
  addStreamLog,
  onClose,
  selectedPlaceId,
  openingDoorId,
  triggerOpenDoor,
  isDevModeEnabled = false,
}: CctvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [autoOpenState, setAutoOpenState] = useState<number | boolean>(false);
  const [isGlobalAutoOpen, setIsGlobalAutoOpen] = useState<boolean>(false);
  const [isTogglingAutoOpen, setIsTogglingAutoOpen] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  const matchingDevice = devices.find(
    (d) => d.externalCameraId === activeCamera || String(d.id) === activeCamera
  );

  useEffect(() => {
    const fetchStatus = () => {
      fetch("/api/domru/sip/auto-open/status", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data && matchingDevice) {
            setAutoOpenState(data[matchingDevice.id] || false);
            setIsGlobalAutoOpen(!!data["global"]);
          }
        })
        .catch(err => console.error("Failed to fetch auto-open status", err));
    };

    fetchStatus();

    const socket = getSocket();
    socket.on("auto_open_status_changed", fetchStatus);

    return () => {
      socket.off("auto_open_status_changed", fetchStatus);
    };
  }, [matchingDevice?.id]);

  const buildSnapshotUrl = (
    placeId: number | string | undefined,
    deviceId: number | string
  ) => {
    if (!placeId) return "";
    const params = new URLSearchParams();
    params.set("t", String(snapshotTime));
    if (credentials.isDemo) {
      params.set("demo", "true");
    } else {
      if (credentials.login) params.set("login", credentials.login);
      if (credentials.password) params.set("password", credentials.password);
      if (credentials.token) params.set("token", credentials.token);
      if (credentials.operatorId) params.set("operatorId", String(credentials.operatorId));
      if (credentials.refreshToken) params.set("refreshToken", credentials.refreshToken);
    }
    return `/api/domru/snapshot/${placeId}/${deviceId}?${params.toString()}`;
  };

  const toggleAutoOpen = async (durationMinutes?: number, maxOpens?: number | null) => {
    if (!selectedPlaceId || !matchingDevice) return;
    setIsTogglingAutoOpen(true);
    const newState = !autoOpenState;
    try {
      const res = await fetch("/api/domru/sip/auto-open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-domru-token": credentials?.token || "",
          "x-domru-refresh-token": credentials?.refreshToken || "",
        },
        body: JSON.stringify({
          placeId: selectedPlaceId,
          deviceId: matchingDevice.id,
          enabled: newState,
          durationMinutes,
          maxOpens
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAutoOpenState(newState ? (data.expiresAt || true) : false);
      } else {
        const errData = await res.json();
        alert(`Ошибка авто-открытия: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Сетевая ошибка: ${err.message || err}`);
    } finally {
      setIsTogglingAutoOpen(false);
    }
  };

  // HLS/FLV/WebRTC stream player handler using Ref
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl || !streamType) return;

    addStreamLog("--- ИНИЦИАЛИЗАЦИЯ ВИДЕОПОТОКА ---");

    if (streamType === "mjpeg") {
      addStreamLog("MJPEG-поток инициализирован.");
      return;
    }

    const nativeHlsSupported = video.canPlayType("application/vnd.apple.mpegurl") !== "";
    const handlePlaying = () => addStreamLog("▶ HTML5 Video: Воспроизведение успешно началось!");
    const handleVideoError = () => {
      const err = video.error;
      addStreamLog(`⛔ Ошибка HTML5 Video: Код ${err ? err.code : "неизвестно"}`);
      setHasStreamError(true);
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("error", handleVideoError);

    let hlsInstance: any = null;
    let mpegtsPlayer: any = null;
    let pc: RTCPeerConnection | null = null;
    let ws: WebSocket | null = null;

    if (streamType === "go2rtc") {
      addStreamLog("⚡ Запуск WebRTC стриминга через go2rtc...");
      try {
        pc = new RTCPeerConnection({
          iceServers: [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }]
        });

        pc.ontrack = (event) => {
          addStreamLog("▶ WebRTC: Получен медиа-трек потока!");
          try {
            const remoteStream = event.streams && event.streams[0]
              ? event.streams[0]
              : new MediaStream([event.track]);
            video.srcObject = remoteStream;
          } catch (trackErr: any) {
            addStreamLog(`⛔ Ошибка привязки трека: ${trackErr.message}`);
          }
        };

        try {
          const localTracks: MediaStreamTrack[] = [];
          const videoTransceiver = pc.addTransceiver("video", { direction: "recvonly" });
          if (videoTransceiver && videoTransceiver.receiver && videoTransceiver.receiver.track) {
            localTracks.push(videoTransceiver.receiver.track);
          }

          try {
            const audioTransceiver = pc.addTransceiver("audio", { direction: "recvonly" });
            if (audioTransceiver && audioTransceiver.receiver && audioTransceiver.receiver.track) {
              localTracks.push(audioTransceiver.receiver.track);
            }
          } catch (audioErr) {
            addStreamLog("⚠️ Предупреждение WebRTC аудио: не удалось добавить ресивер.");
          }

          if (localTracks.length > 0) {
            video.srcObject = new MediaStream(localTracks);
          }
        } catch (transceiverErr: any) {
          addStreamLog(`⚠️ addTransceiver не поддерживается: ${transceiverErr.message}. Ожидание ontrack.`);
        }

        let wsUrl = streamUrl;
        if (window.location.protocol === "https:" && wsUrl.startsWith("ws://")) {
          wsUrl = wsUrl.replace("ws://", "wss://");
          addStreamLog("🔒 Переключено на безопасное соединение wss:// для соответствия HTTPS протоколу");
        }

        ws = new WebSocket(wsUrl);

        ws.addEventListener("open", () => {
          addStreamLog("🔌 Сигнальное WebSocket-соединение с go2rtc открыто.");

          pc?.addEventListener("icecandidate", ev => {
            if (!ev.candidate) return;
            const msg = { type: "webrtc/candidate", value: ev.candidate.candidate };
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(msg));
            }
          });

          pc?.createOffer()
            .then(offer => {
              if (pc) return pc.setLocalDescription(offer);
            })
            .then(() => {
              addStreamLog("📡 Отправка WebRTC SDP Offer в go2rtc...");
              if (pc && pc.localDescription) {
                const msg = { type: "webrtc/offer", value: pc.localDescription.sdp };
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(msg));
                }
              }
            })
            .catch(err => {
              addStreamLog(`⛔ Ошибка создания SDP Offer: ${err.message}`);
            });
        });

        ws.addEventListener("message", ev => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "webrtc/candidate") {
              pc?.addIceCandidate({ candidate: msg.value, sdpMid: "0" }).catch(e => {
                console.warn("ICE candidate error:", e);
              });
            } else if (msg.type === "webrtc/answer") {
              addStreamLog("✅ Получен WebRTC SDP Answer от go2rtc.");
              pc?.setRemoteDescription({ type: "answer", sdp: msg.value }).catch(e => {
                addStreamLog(`⛔ Ошибка remote description: ${e.message}`);
              });
            }
          } catch (err: any) {
            console.error(err);
          }
        });

        ws.addEventListener("close", () => {
          addStreamLog("🔌 Сигнальное WebSocket-соединение закрыто.");
        });

        ws.addEventListener("error", () => {
          addStreamLog("⛔ Сигнальное WebSocket-соединение завершилось ошибкой.");
        });

      } catch (webrtcErr: any) {
        addStreamLog(`⛔ Ошибка инициализации WebRTC: ${webrtcErr.message}`);
        setHasStreamError(true);
      }
    } else {
      // Legacy streaming fallback
      const isHls = streamType === "hls" || streamUrl.includes(".m3u8");
      const isFlv = streamType === "flv" || streamUrl.includes(".flv");

      if (isFlv) {
        const loadMpegts = async () => {
          if (!(window as any).mpegts) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js";
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Не удалось загрузить mpegts.js"));
              document.head.appendChild(script);
            });
          }
          const mpegts = (window as any).mpegts;
          if (mpegts && mpegts.isSupported()) {
            mpegtsPlayer = mpegts.createPlayer({ type: "flv", isLive: true, url: streamUrl, cors: true });
            mpegtsPlayer.attachMediaElement(video);
            mpegtsPlayer.load();
            mpegtsPlayer.play().catch((e: any) => console.log("Auto-start blocked", e));
          } else {
            video.src = streamUrl;
          }
        };
        loadMpegts().catch((e) => console.error(e));
      } else if (isHls) {
        if (nativeHlsSupported && !forceHlsJS) {
          video.src = streamUrl;
        } else {
          const loadHls = async () => {
            if (!(window as any).Hls) {
              await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js";
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Не удалось загрузить Hls.js"));
                document.head.appendChild(script);
              });
            }
            const Hls = (window as any).Hls;
            if (Hls && Hls.isSupported()) {
              hlsInstance = new Hls({ lowLatencyMode: true, maxBufferLength: 10 });
              hlsInstance.loadSource(streamUrl);
              hlsInstance.attachMedia(video);
            } else {
              video.src = streamUrl;
            }
          };
          loadHls().catch((e) => console.error(e));
        }
      } else {
        video.src = streamUrl;
      }
    }

    return () => {
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("error", handleVideoError);
      if (hlsInstance) hlsInstance.destroy();
      if (mpegtsPlayer) mpegtsPlayer.destroy();
      if (pc) pc.close();
      if (ws) ws.close();
      video.srcObject = null;
      video.src = "";
    };
  }, [streamUrl, streamType, forceHlsJS, addStreamLog, setHasStreamError, activeCamera]);

  return (
    <div
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 rounded-[2rem] shadow-xl flex flex-col space-y-4 animate-fade-in max-w-3xl mx-auto"
      id="cctv_visualizer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-[#E30613] animate-pulse" />
          <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
            {cameras.find((c) => c.id === activeCamera)?.name ||
              matchingDevice?.name ||
              "Просмотр видеопотока"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 bg-[#E30613]/10 text-[#E30613] font-bold rounded-xl hover:bg-[#E30613]/20 transition text-xs cursor-pointer"
          id="close_cctv_btn"
        >
          <VideoOff className="w-3.5 h-3.5 inline mr-1" />
          Закрыть
        </button>
      </div>

      {matchingDevice && (
        <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-xs">
          <div className="flex gap-1.5">
            <button
              onClick={() => setPlayerMode("stream")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                playerMode === "stream"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-zinc-800"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
              }`}
            >
              📡 Трансляция
            </button>
            <button
              onClick={() => setPlayerMode("snapshot")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                playerMode === "snapshot"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-zinc-800"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
              }`}
            >
              📸 Снимки
            </button>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mr-2 hidden sm:block font-bold">
            {playerMode === "stream"
              ? "Рекомендуется H.264"
              : `Обновление ~1.5с • ${formatTimeInTimezone(snapshotTime, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </div>
        </div>
      )}

      <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-950 rounded-2xl overflow-hidden relative flex items-center justify-center border border-zinc-200 dark:border-zinc-800 group">
        {matchingDevice && matchingDevice.allowOpen && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2 opacity-100 transition-opacity">
             <button
               onClick={() => {
                 if (autoOpenState) toggleAutoOpen(); // turn off
                 else if (isGlobalAutoOpen) alert("Авто-открытие активировано расписанием из вкладки 'Люди'. Измените или удалите правило там, чтобы отключить.");
                 else setIsConfigModalOpen(true); // show modal
               }}
               disabled={isTogglingAutoOpen}
               title="Авто-открытие при звонке курьера"
               className={`px-3 py-1.5 text-[10px] font-bold rounded-full border transition flex items-center gap-1 shadow-sm cursor-pointer backdrop-blur-md ${
                 autoOpenState || isGlobalAutoOpen
                   ? "bg-emerald-500/90 text-white border-emerald-400"
                   : "bg-black/60 text-zinc-200 border-white/20 hover:bg-black/80"
               }`}
             >
               {autoOpenState || isGlobalAutoOpen ? <PhoneForwarded className="w-3.5 h-3.5" /> : <PhoneOff className="w-3.5 h-3.5" />}
               <span className="hidden sm:inline">
                 {autoOpenState || isGlobalAutoOpen 
                   ? (typeof autoOpenState === "number" 
                       ? `Жду гостей/курьера (до ${formatTimeInTimezone(autoOpenState as number, { hour: "2-digit", minute: "2-digit" })})` 
                       : "Авто-открытие активно") 
                   : "Авто-открытие"}
               </span>
             </button>

             <button
               onClick={() => triggerOpenDoor(matchingDevice.id)}
               disabled={openingDoorId !== null}
               className={`p-2.5 rounded-full transition-all duration-300 shadow-md cursor-pointer backdrop-blur-md border ${
                 openingDoorId === matchingDevice.id
                   ? "bg-emerald-500/90 text-white border-emerald-400 cursor-default"
                   : "bg-[#E30613]/90 hover:bg-[#c20510]/90 text-white border-white/20 active:scale-90"
               }`}
             >
               {openingDoorId === matchingDevice.id ? (
                 <Unlock className="w-4 h-4 animate-pulse" />
               ) : (
                 <Lock className="w-4 h-4" />
               )}
             </button>
          </div>
        )}

        {playerMode === "snapshot" && matchingDevice ? (
          <div className="w-full h-full relative">
            <img
              key={snapshotTime}
              src={buildSnapshotUrl(selectedPlaceId, matchingDevice.id)}
              alt="Кадр с домофона"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={() => {
                addStreamLog("⛔ Сбой загрузки снимка с домофона.");
              }}
            />
            <div className="absolute top-3 left-3 bg-black/75 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider flex items-center gap-1.5 text-white">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              РЕЖИМ СНАПШОТОВ (1.5С)
            </div>
          </div>
        ) : loadingStream ? (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
            <span>Подключение к IP-потоку Dom.ru…</span>
          </div>
        ) : streamUrl ? (
          streamUrl.toLowerCase().startsWith("rtsp://") ? (
            <div className="text-xs text-zinc-500 dark:text-zinc-400 p-8 text-center max-w-md flex flex-col items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-xl">
                <VideoOff className="w-6 h-6" />
              </div>
              <p className="font-extrabold text-zinc-900 dark:text-white text-sm">
                Протокол RTSP не поддерживается браузерами напрямую
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
                Экраны домофонов Dom.ru выдают сырой RTSP-адрес. Скопируйте ссылку ниже и
                запустите в плеере (например, VLC).
              </p>
            </div>
          ) : streamType === "mjpeg" ? (
            <img
              src={streamUrl}
              alt="MJPEG Stream"
              className="w-full h-full object-cover"
              onError={() => {
                addStreamLog("⛔ Сбой загрузки MJPEG-потока.");
              }}
            />
          ) : (
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              loop
              muted
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 p-8 text-center">
            <p className="font-semibold text-zinc-400">Поток временно недоступен</p>
          </div>
        )}
      </div>

      {hasStreamError && playerMode === "stream" && matchingDevice && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-[#D97706] dark:text-amber-400 p-3.5 rounded-2xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div>
            <p className="font-bold">⚠️ Проблемы с воспроизведением видео-потока</p>
            <p className="text-[11px] text-zinc-650 dark:text-zinc-400 mt-1 leading-normal">
              Ваш браузер или соединение не могут принять HLS-видео. Рекомендуем переключиться
              на режим снимков.
            </p>
          </div>
          <button
            onClick={() => setPlayerMode("snapshot")}
            className="shrink-0 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            На снапшоты
          </button>
        </div>
      )}

      {streamUrl && isDevModeEnabled && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-[10px] text-zinc-500 dark:text-zinc-400 font-mono border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <span>Состояние: Подключено</span>
            <div className="flex items-center gap-2">
              {streamType !== "go2rtc" && (
                <button
                  onClick={() => setForceHlsJS(!forceHlsJS)}
                  className="hover:text-[#E30613] bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg font-sans font-bold transition border border-zinc-200 dark:border-zinc-700 cursor-pointer text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750"
                >
                  🔧 {forceHlsJS ? "Авто-плеер" : "Hls.js"}
                </button>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(streamUrl || "");
                  addStreamLog("📋 Ссылка скопирована!");
                }}
                className="hover:text-[#E30613] bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg transition border border-zinc-200 dark:border-zinc-700 cursor-pointer text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750"
              >
                Скопировать URL
              </button>
            </div>
          </div>

          <details className="group mt-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/10 overflow-hidden animate-fade-in">
            <summary className="px-4 py-2.5 text-[10px] font-bold tracking-wider text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer flex items-center justify-between font-sans select-none list-none">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#E30613]" />
                Техническая диагностика потока (Dev-логи)
              </span>
              <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-500 dark:text-zinc-400 font-mono">
                {streamLogs.length} событий
              </span>
            </summary>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-[11px] leading-relaxed select-text shadow-inner">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-2 text-zinc-550 dark:text-zinc-400">
                <span>Журнал событий плеера</span>
                <button
                  onClick={() => setStreamLogs([])}
                  className="text-[9px] text-[#E30613] font-bold cursor-pointer"
                >
                  Очистить
                </button>
              </div>
              <div
                className="bg-white dark:bg-black/30 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 h-48 overflow-y-auto space-y-1 text-zinc-600 dark:text-zinc-400 font-mono text-[10px]"
                id="video_logs_scroller"
              >
                {streamLogs.length > 0 ? (
                  streamLogs.map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-zinc-400 dark:text-zinc-600 mt-16">
                    Логи пусты
                  </div>
                )}
              </div>
            </div>
          </details>

          <SipLogsViewer />
        </div>
      )}

      <AutoOpenConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onEnable={(durationMinutes, maxOpens) => toggleAutoOpen(durationMinutes, maxOpens)}
      />
    </div>
  );
}
