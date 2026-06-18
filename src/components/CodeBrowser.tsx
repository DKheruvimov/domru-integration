import { useState, useEffect } from "react";
import { LibraryFile } from "../types";
import { FolderCode, FileText, RefreshCw, Layers, Terminal, AlertTriangle } from "lucide-react";

export default function CodeBrowser() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [activeFile, setActiveFile] = useState<LibraryFile | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load the inspectable file list
  const loadFileList = async () => {
    try {
      setError("");
      setLoading(true);
      const res = await fetch("/api/code/list");
      if (!res.ok) throw new Error("Could not load inspectable code files");
      const list = await res.json();
      setFiles(list);
      // Select client.ts by default if found
      const defaultFile = list.find((f: LibraryFile) => f.name === "client.ts") || list[0] || null;
      setActiveFile(defaultFile);
    } catch (err: any) {
      setError(err.message || "Failed to list files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFileList();
  }, []);

  // Load contents of active file
  useEffect(() => {
    if (!activeFile) return;

    const loadContent = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/code/read?path=${encodeURIComponent(activeFile.path)}`);
        if (!res.ok) throw new Error(`Could not read file: ${activeFile.name}`);
        const data = await res.json();
        setContent(data.content);
      } catch (err: any) {
        setError(err.message || "Failed to load file contents");
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [activeFile]);

  // Organize files by category
  const categories = {
    core: { label: "Core Library", files: files.filter((f) => f.category === "core") },
    api: { label: "API Handlers", files: files.filter((f) => f.category === "api") },
    http: { label: "HTTP Transport", files: files.filter((f) => f.category === "http") },
    interfaces: { label: "Types & Examples", files: files.filter((f) => f.category === "interfaces") },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="code_browser_wrapper">
      {/* File Sidebar */}
      <div className="lg:col-span-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50 font-semibold text-sm">
            <FolderCode className="w-5 h-5 text-teal-600" />
            <span>Файлы библиотеки</span>
          </div>
          <button
            onClick={loadFileList}
            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
            title="Reload source file index"
            id="code_refresh_btn"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <nav className="space-y-4" id="code_browser_nav">
          {Object.entries(categories).map(([key, group]) => {
            if (group.files.length === 0) return null;
            return (
              <div key={key}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-1.5 px-2">
                  {group.label}
                </span>
                <div className="space-y-0.5">
                  {group.files.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => setActiveFile(file)}
                      className={`w-full text-left text-xs px-2.5 py-2 rounded-lg flex items-center gap-2 font-mono transition-colors ${
                        activeFile?.path === file.path
                          ? "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 font-semibold"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                      id={`file_btn_${file.name.replace(/[^a-zA-Z0-9]/g, "_")}`}
                    >
                      <FileText className="w-3.5 h-3.5 opacity-70" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Code Viewer Panel */}
      <div className="lg:col-span-3 bg-zinc-950 text-zinc-100 border border-zinc-900 rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[750px] min-h-[500px]" id="code_viewer_panel">
        <div className="bg-zinc-900 border-b border-zinc-950 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-teal-500" />
            <span className="font-mono text-xs text-zinc-400">
              {activeFile ? activeFile.path : "No file selected"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-auto font-mono text-xs leading-relaxed max-h-[650px]" id="code_box_inner">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-950/20 border border-red-900/40 text-red-400 rounded-xl mb-4">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3 text-zinc-500">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
              <p className="text-sm">Загрузка структуры кода и содержимого…</p>
            </div>
          ) : content ? (
            <pre className="whitespace-pre overflow-x-auto selection:bg-teal-800 select-text">
              <code>{content}</code>
            </pre>
          ) : (
            <div className="text-center text-zinc-500 py-32">Выберите файл, чтобы посмотреть его код</div>
          )}
        </div>

        <div className="bg-zinc-900 px-6 py-2 border-t border-zinc-950 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>Спецификация TypeScript (ESNext)</span>
          <span>S0yora/domru-js</span>
        </div>
      </div>
    </div>
  );
}
