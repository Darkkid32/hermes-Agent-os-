import {
  Bot,
  BrainCircuit,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Cpu,
  FileCode2,
  Gem,
  Globe2,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  PlugZap,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TerminalSquare,
  Video,
  Zap,
  Check,
  CircleDot,
  Gauge,
  ChevronUp
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { sendAgentMessage } from "../api";
import type { IntegrationSnapshot } from "../types";

// ── Markdown fallback ────────────────────────────────────────────────
const MarkdownFallback = ({ children }: { children: string }) => <p>{children}</p>;

// ── Agent icon mapping ───────────────────────────────────────────────
const agentIcons: Record<string, any> = {
  claude: TerminalSquare,
  openclaw: Bot,
  openclaude: Sparkles,
  gemini: Gem,
  codex: Code2,
  opencode: FileCode2,
  "free-claude-code": PlugZap
};

// ── Quick action chips ───────────────────────────────────────────────
const quickActions = [
  { label: "Goals", icon: CircleDot, prompt: "Help me set and track my goals" },
  { label: "SEO", icon: Search, prompt: "Analyze my website for SEO improvements" },
  { label: "Image", icon: ImageIcon, prompt: "Generate an image of " },
  { label: "Video", icon: Video, prompt: "Create a video about " },
  { label: "Research", icon: Globe2, prompt: "Research the latest trends in " },
  { label: "Code Review", icon: TerminalSquare, prompt: "Review the code for best practices and potential issues" },
  { label: "Debug", icon: Zap, prompt: "Help me debug and fix the issue with " },
  { label: "Refactor", icon: RefreshCw, prompt: "Refactor this code for better readability and performance" },
  { label: "Generate UI", icon: Sparkles, prompt: "Generate a modern UI component for " },
  { label: "Marketing", icon: MessageSquare, prompt: "Create marketing copy for " },
  { label: "Blog", icon: FileCode2, prompt: "Write a blog post about " },
  { label: "Documentation", icon: Code2, prompt: "Write documentation for " },
  { label: "Workflow", icon: Zap, prompt: "Design an automated workflow for " },
  { label: "API", icon: Globe2, prompt: "Design a REST API for " },
  { label: "Scraper", icon: Search, prompt: "Build a web scraper for " }
];

// ── Time-of-day greeting ─────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Good Night";
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ── Format timestamp ─────────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Runtime badge ────────────────────────────────────────────────────
function runtimeBadge(mode: string): { label: string; tone: string } {
  if (mode === "cli") return { label: "CLI", tone: "ok" };
  if (mode === "nvidia_fallback") return { label: "NVIDIA Fallback", tone: "ok" };
  return { label: "Unavailable", tone: "warn" };
}

// ── Capability chip helper ───────────────────────────────────────────
function capabilityIcon(cap: string): any {
  const lower = cap.toLowerCase();
  if (lower.includes("code") || lower.includes("terminal")) return Code2;
  if (lower.includes("chat")) return MessageSquare;
  if (lower.includes("file")) return TerminalSquare;
  if (lower.includes("mcp")) return Globe2;
  if (lower.includes("memory")) return BrainCircuit;
  if (lower.includes("skill")) return Sparkles;
  return Zap;
}

// ── Markdown Code Block ──────────────────────────────────────────────
function CodeBlock({ children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const codeText = typeof children === "string" ? children : String(children).trim();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrap">
      <div className="code-block-header">
        <span className="code-block-lang">{props.className?.replace("language-", "") || "code"}</span>
        <button className="code-copy-btn" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="code-block-pre">
        <code {...props}>{children}</code>
      </pre>
    </div>
  );
}

// ── Markdown lazy loader hook ─────────────────────────────────────────
function useMarkdown() {
  const [md, setMd] = useState<any>(null);
  const [hl, setHl] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("react-markdown").then((m) => m.default).catch(() => MarkdownFallback),
      import("rehype-highlight").then((m) => m.default).catch(() => null)
    ]).then(([markdown, highlight]) => {
      if (!cancelled) {
        setMd(() => markdown);
        setHl(() => highlight);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { MarkdownComp: md, mdHighlight: hl };
}

// ── Markdown Renderer ────────────────────────────────────────────────
function RenderedMarkdown({ content }: { content: string }) {
  const { MarkdownComp, mdHighlight } = useMarkdown();
  if (!MarkdownComp) return <p>{content}</p>;
  return (
    <div className="markdown-body">
      <MarkdownComp
        rehypePlugins={mdHighlight ? [mdHighlight] : []}
        components={{
          code: (props: any) => {
            const { className, children, ...rest } = props;
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return <code className="inline-code" {...rest}>{children}</code>;
          },
          pre: ({ children }: any) => <>{children}</>
        }}
      >
        {content}
      </MarkdownComp>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────
export default function AgentChatLayout({
  id,
  snapshot,
  onOpenPlugins
}: {
  id: string;
  snapshot: IntegrationSnapshot | null;
  onOpenPlugins: () => void;
}) {
  const integration = useMemo(() => {
    return snapshot?.integrations.find((item) => item.id === id) || null;
  }, [id, snapshot]);

  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const storageKey = `hermes-chat-${id}`;
  const [chatHistory, setChatHistory] = useState<
    { role: "user" | "assistant"; content: string; mode?: string; timestamp?: number }[]
  >(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const executionMode = useMemo(
    () =>
      integration
        ? ((): string => {
            if (integration.status === "connected") return "cli";
            const hasNvidia = snapshot?.integrations.some(
              (i) => i.id === "provider-nvidia" && i.status === "connected"
            );
            if (hasNvidia) return "nvidia_fallback";
            return "unavailable";
          })()
        : "unavailable",
    [integration, snapshot]
  );

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  if (!integration) {
    return (
      <main className="ac-layout">
        <div className="ac-empty-state">
          <p>Connector not found.</p>
        </div>
      </main>
    );
  }

  // ── Functions (preserved from original) ──────────────────────────
  async function send() {
    if (!message.trim()) return;
    const userText = message;
    setMessage("");
    setBusy(true);
    setChatHistory((current) => {
      const next = [...current, { role: "user" as const, content: userText, timestamp: Date.now() }];
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    try {
      const result = await sendAgentMessage(
        integration!.id === "free-claude-code" ? "claude" : integration!.id,
        userText
      );
      setReply(result.reply);
      setChatHistory((current) => {
        const next = [
          ...current,
          {
            role: "assistant" as const,
            content: result.reply || "(no reply)",
            mode: result.mode,
            timestamp: Date.now()
          }
        ];
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch (err) {
      const errText = err instanceof Error ? err.message : "Dispatch failed";
      setReply(errText);
      setChatHistory((current) => {
        const next = [
          ...current,
          { role: "assistant" as const, content: errText, mode: "error", timestamp: Date.now() }
        ];
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function handleCopyMessage(content: string, idx: number) {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  // ── Derived data ─────────────────────────────────────────────────
  const Icon = agentIcons[id] || Bot;
  const badge = runtimeBadge(executionMode);
  const capabilities = integration.capabilities || ["chat"];
  const greeting = getGreeting();

  // ── Chat-first layout (all agents) ──────────────────────────────
  return (
    <main className="ac-layout">
      {/* ── Left column: chat ── */}
      <div className="ac-chat-col">
        {/* ── Compact Header ── */}
        <div className="ac-header">
          <div className="ac-header-left">
            <div className="ac-agent-icon">
              <Icon size={20} />
            </div>
            <div className="ac-header-info">
              <h1 className="ac-header-name">{integration.label}</h1>
              <div className="ac-header-meta">
                <span className={`ac-status-dot ${integration.status === "connected" ? "connected" : ""}`} />
                <span className="ac-status-text">
                  {integration.status === "connected" ? "Connected" : integration.status}
                </span>
                <span className="ac-meta-sep">·</span>
                <span className="ac-provider-label">
                  Provider: <strong>{integration.label}</strong>
                </span>
                <span className="ac-meta-sep">·</span>
                <span className="ac-runtime-label">
                  Runtime: <strong>{badge.label}</strong>
                </span>
              </div>
            </div>
          </div>
          <div className="ac-header-right">
            <div className="ac-capabilities">
              {capabilities.slice(0, 6).map((cap) => {
                const CapIcon = capabilityIcon(cap);
                return (
                  <span key={cap} className="ac-cap-chip">
                    <CapIcon size={12} />
                    {cap}
                  </span>
                );
              })}
            </div>
            <button
              className="ac-sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle sidebar"
            >
              {sidebarOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className="ac-chat-area">
          {chatHistory.length === 0 ? (
            /* ── Empty state ── */
            <div className="ac-empty-state">
              <div className="ac-empty-greeting">{greeting}</div>
              <div className="ac-empty-agent">{integration.label}</div>
              <p className="ac-empty-subtitle">What would you like to build today?</p>
              <div className="ac-empty-actions">
                {["Review Code", "Debug", "Build API", "Explain Repository", "Fix Bug", "Generate UI"].map(
                  (action) => (
                    <button
                      key={action}
                      className="ac-empty-action-btn"
                      onClick={() => setMessage(action + " ")}
                    >
                      {action}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
            /* ── Messages ── */
            <div className="ac-messages">
              {chatHistory.map((entry, idx) => {
                const isUser = entry.role === "user";
                return (
                  <div key={idx} className={`ac-msg ${isUser ? "ac-msg-user" : "ac-msg-assistant"}`}>
                    {!isUser && (
                      <div className="ac-msg-avatar">
                        <Icon size={18} />
                      </div>
                    )}
                    <div className={`ac-msg-card ${isUser ? "ac-msg-card-user" : "ac-msg-card-assistant"}`}>
                      <div className="ac-msg-header">
                        <span className="ac-msg-label">
                          {isUser ? "You" : integration.label}
                        </span>
                        {entry.mode && entry.mode !== "nvidia_fallback" && (
                          <span className="ac-msg-mode">{entry.mode}</span>
                        )}
                        {entry.timestamp && (
                          <span className="ac-msg-time">{formatTime(new Date(entry.timestamp))}</span>
                        )}
                      </div>
                      <div className="ac-msg-body">
                        {isUser ? (
                          <p className="ac-msg-text">{entry.content}</p>
                        ) : (
                          <RenderedMarkdown content={entry.content} />
                        )}
                      </div>
                      {!isUser && (
                        <div className="ac-msg-actions">
                          <button
                            className="ac-msg-action"
                            onClick={() => handleCopyMessage(entry.content, idx)}
                            title="Copy"
                          >
                            {copiedIdx === idx ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {busy && (
                <div className="ac-msg ac-msg-assistant">
                  <div className="ac-msg-avatar">
                    <Icon size={18} />
                  </div>
                  <div className="ac-msg-card ac-msg-card-assistant">
                    <div className="ac-typing-indicator">
                      <span className="ac-typing-dot" />
                      <span className="ac-typing-dot" />
                      <span className="ac-typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* ── Quick actions ── */}
        {chatHistory.length === 0 && (
          <div className="ac-quick-actions">
            {quickActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.label}
                  className="ac-quick-chip"
                  onClick={() => setMessage(action.prompt)}
                >
                  <ActionIcon size={14} />
                  {action.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Composer ── */}
        <div className="ac-composer">
          <div className="ac-composer-toolbar">
            <button className="ac-composer-tool" title="Attach file">
              <Paperclip size={16} />
            </button>
            <button className="ac-composer-tool" title="Add image">
              <ImageIcon size={16} />
            </button>
            <button className="ac-composer-tool" title="Record voice">
              <Mic size={16} />
            </button>
          </div>
          <div className="ac-composer-input-wrap">
            <textarea
              className="ac-composer-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy && message.trim()) send();
                }
              }}
              placeholder={`Ask ${integration.label}...`}
              rows={1}
            />
          </div>
          <button
            className="ac-composer-send"
            onClick={send}
            disabled={busy || !message.trim()}
            title="Send"
          >
            {busy ? <Loader2 className="ac-spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* ── Right sidebar ── */}
      {sidebarOpen && (
        <aside className="ac-sidebar">
          <div className="ac-sidebar-scroll">
            {/* Agent Status */}
            <div className="ac-sidebar-section">
              <div className="ac-sidebar-section-head">
                <Gauge size={14} />
                <span>Agent Status</span>
              </div>
              <div className="ac-sidebar-status">
                <div className="ac-status-row">
                  <span className="ac-status-label">Connection</span>
                  <span className={`ac-status-value ${integration.status === "connected" ? "ac-status-ok" : "ac-status-warn"}`}>
                    {integration.status === "connected" ? "Connected" : integration.status}
                  </span>
                </div>
                <div className="ac-status-row">
                  <span className="ac-status-label">Runtime</span>
                  <span className="ac-status-value">{badge.label}</span>
                </div>
                <div className="ac-status-row">
                  <span className="ac-status-label">Mode</span>
                  <span className="ac-status-value">{executionMode}</span>
                </div>
              </div>
            </div>

            {/* Chat Stats */}
            <div className="ac-sidebar-section">
              <div className="ac-sidebar-section-head">
                <MessageSquare size={14} />
                <span>Chat Stats</span>
              </div>
              <div className="ac-sidebar-status">
                <div className="ac-status-row">
                  <span className="ac-status-label">Messages</span>
                  <span className="ac-status-value">{chatHistory.length}</span>
                </div>
                <div className="ac-status-row">
                  <span className="ac-status-label">Last activity</span>
                  <span className="ac-status-value">
                    {chatHistory.length > 0 && chatHistory[chatHistory.length - 1].timestamp
                      ? formatTime(new Date(chatHistory[chatHistory.length - 1].timestamp!))
                      : "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            <div className="ac-sidebar-section">
              <div className="ac-sidebar-section-head">
                <Sparkles size={14} />
                <span>Capabilities</span>
              </div>
              <div className="ac-sidebar-capabilities">
                {capabilities.map((cap) => (
                  <span key={cap} className="ac-cap-tag">{cap}</span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="ac-sidebar-section">
              <div className="ac-sidebar-section-head">
                <Zap size={14} />
                <span>Actions</span>
              </div>
              <div className="ac-sidebar-actions">
                <button className="ac-sidebar-action-btn" onClick={onOpenPlugins}>
                  <Gauge size={14} />
                  Plugin matrix
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}
