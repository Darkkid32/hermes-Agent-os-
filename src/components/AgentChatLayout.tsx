import {
  Bot,
  BrainCircuit,
  ChevronDown,
  Code2,
  Copy,
  FileCode2,
  Globe2,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
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
  ChevronUp,
  ArrowDown,
  Bookmark,
  Pin,
  Download,
  RotateCcw,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import agentIcons from "../services/agentIcons";
import { getGreeting } from "../services/greeting";
import type { IntegrationSnapshot } from "../types";
import { ExecutionBus, type ExecutionBusEvent, type ExecutionEventType, subscribeExecutionEvents } from "../hermes/ExecutionEventBusBridge";
import { getResultsByAgent, onResultsUpdate, type ExecutionResult } from "../hermes/ExecutionResults";

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

// ── Streaming status messages ────────────────────────────────────────
const streamingMessages = [
  "Thinking...",
  "Planning...",
  "Generating...",
  "Processing...",
  "Analyzing..."
];

// ── Format timestamp ─────────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Runtime badge ────────────────────────────────────────────────────
function runtimeBadge(mode: string): { label: string; tone: string } {
  if (mode === "cli") return { label: "CLI", tone: "ok" };
  if (mode === "nvidia_fallback") return { label: "NVIDIA", tone: "ok" };
  return { label: "Unavailable", tone: "warn" };
}

// ── Format execution event for chat display ──────────────────────────
function formatExecutionEvent(event: ExecutionBusEvent): string | null {
  const prefix = getAgentEmoji(event.agentName);
  switch (event.type) {
    case "execution_created":
      return `${prefix} **${event.agentName}** — Task queued`;
    case "execution_started":
      return `${prefix} **${event.agentName}** — ${event.message}`;
    case "agent_started":
      return `${prefix} **${event.agentName}** — Starting...\n\n${event.message}`;
    case "agent_progress":
      return `${prefix} **${event.agentName}** — ${event.message}`;
    case "agent_stream":
      if (typeof event.metadata?.chunk === "string") {
        return `${prefix} **${event.agentName}** — ${event.metadata.chunk}`;
      }
      return null;
    case "agent_finished":
      return `${prefix} **${event.agentName}** — Finished${event.metadata?.tokens ? ` (${event.metadata.tokens} tokens, ${event.metadata.duration}ms)` : ""}`;
    case "review_started":
      return `\ud83d\udd0d **Code Review** — ${event.message}`;
    case "review_finished":
      return `\ud83d\udd0d **Code Review** — Complete${event.metadata?.tokens ? ` (${event.metadata.tokens} tokens)` : ""}`;
    case "qa_started":
      return `\u2713 **QA Pass** — ${event.message}`;
    case "qa_finished":
      return `\u2713 **QA Pass** — Complete`;
    case "workspace_updated":
      return `\ud83d\udcbe **Workspace** — ${event.message}`;
    case "artifact_created": {
      const name = event.metadata?.name as string | undefined;
      return name ? `\ud83d\udcce **Artifact** — ${name} created` : null;
    }
    case "execution_completed":
      return `\u2705 **${event.agentName}** — ${event.message}`;
    case "execution_failed":
      return `\u274c **${event.agentName}** — ${event.message}`;
    default:
      return null;
  }
}

function getAgentEmoji(agentName: string): string {
  const lower = agentName.toLowerCase();
  if (lower.includes("claude")) return "\ud83e\udd16";
  if (lower.includes("gemini")) return "\u2728";
  if (lower.includes("opencode") || lower.includes("openclaw")) return "\ud83d\udcbb";
  if (lower.includes("codex")) return "\ud83d\udcdd";
  if (lower.includes("brain")) return "\ud83e\udde0";
  return "\ud83d\udcac";
}

// ── Capability icon helper ───────────────────────────────────────────
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
  const [collapsed, setCollapsed] = useState(false);
  const codeText = typeof children === "string" ? children : String(children).trim();
  const lineCount = codeText.split("\n").length;
  const lang = props.className?.replace("language-", "") || "code";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Add line numbers
  const lines = codeText.split("\n");
  const numberedCode = lines.map((line: string, i: number) => (
    <span key={i} className="code-line">{line || " "}</span>
  )).join("");

  return (
    <div className="code-block-wrap">
      <div className="code-block-header">
        <span className="code-block-lang">{lang}</span>
        <div className="code-block-actions">
          {lineCount > 20 && (
            <button
              className="code-collapse-btn"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
          )}
          <button className="code-copy-btn" onClick={handleCopy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className={`code-block-pre ${collapsed ? "collapsed" : ""}`}>
        <code dangerouslySetInnerHTML={{ __html: numberedCode }} />
      </pre>
    </div>
  );
}

// ── Markdown lazy loader hook ────────────────────────────────────────
function useMarkdown() {
  const [md, setMd] = useState<any>(null);
  const [hl, setHl] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("react-markdown").then((m) => m.default).catch(() => null),
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
const MarkdownCodeOverride = memo(function MarkdownCodeOverride(props: any) {
  const { className, children, ...rest } = props;
  const isBlock = typeof className === "string" && className.startsWith("language-");
  if (isBlock) {
    return <CodeBlock className={className}>{children}</CodeBlock>;
  }
  return <code className="inline-code" {...rest}>{children}</code>;
});

const MarkdownPreOverride = ({ children }: any) => <>{children}</>;

const MARKDOWN_COMPONENTS = {
  code: MarkdownCodeOverride,
  pre: MarkdownPreOverride
};

function RenderedMarkdown({ content }: { content: string }) {
  const { MarkdownComp, mdHighlight } = useMarkdown();
  if (!MarkdownComp) return <p>{content}</p>;
  return (
    <div className="markdown-body">
      <MarkdownComp
        rehypePlugins={mdHighlight ? [mdHighlight] : []}
        components={MARKDOWN_COMPONENTS}
      >
        {content}
     </MarkdownComp>
   </div>
  );
}

// ── Chat Message Component ───────────────────────────────────────────
const ChatMessage = memo(function ChatMessage({
  entry,
  idx,
  isUser,
  integrationLabel,
  Icon,
  onCopy,
  copiedIdx,
  onRetry,
  onBookmark,
  onPin
}: {
  entry: { role: "user" | "assistant"; content: string; mode?: string; timestamp?: number };
  idx: number;
  isUser: boolean;
  integrationLabel: string;
  Icon: any;
  onCopy: (content: string, idx: number) => void;
  copiedIdx: number | null;
  onRetry?: () => void;
  onBookmark?: () => void;
  onPin?: () => void;
}) {
  return (
    <div className={`ac-msg ${isUser ? "ac-msg-user" : "ac-msg-assistant"}`}>
      {!isUser && (
        <div className="ac-msg-avatar">
          <Icon size={16} />
       </div>
      )}
      <div className={`ac-msg-card ${isUser ? "ac-msg-card-user" : "ac-msg-card-assistant"}`}>
        <div className="ac-msg-header">
          <span className="ac-msg-label">
            {isUser ? "You" : integrationLabel}
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
              onClick={() => onCopy(entry.content, idx)}
              title="Copy"
            >
              <span className="ac-msg-action-icon">
                {copiedIdx === idx ? <Check size={13} /> : <Copy size={13} />}
             </span>
              {copiedIdx === idx ? "Copied" : "Copy"}
           </button>
            {onRetry && (
              <button className="ac-msg-action" onClick={onRetry} title="Retry">
                <span className="ac-msg-action-icon"><RotateCcw size={13} /></span>
                Retry
             </button>
            )}
            {onBookmark && (
              <button className="ac-msg-action" onClick={onBookmark} title="Bookmark">
                <span className="ac-msg-action-icon"><Bookmark size={13} /></span>
                Save
             </button>
            )}
            {onPin && (
              <button className="ac-msg-action" onClick={onPin} title="Pin">
                <span className="ac-msg-action-icon"><Pin size={13} /></span>
                Pin
             </button>
            )}
            <button className="ac-msg-action" title="Export">
              <span className="ac-msg-action-icon"><Download size={13} /></span>
              Export
           </button>
         </div>
        )}
     </div>
   </div>
  );
});

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
  const [streamingMsg, setStreamingMsg] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const chatAreaRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrollingRef = useRef(false);
  const streamingMsgIdx = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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

  // ── Auto-scroll logic ──────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  const isNearBottom = useCallback(() => {
    const el = chatAreaRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, []);

  // Handle scroll events
  useEffect(() => {
    const el = chatAreaRef.current;
    if (!el) return;

    const handleScroll = () => {
      const nearBottom = isNearBottom();
      setShowScrollBtn(!nearBottom);
      isUserScrollingRef.current = !nearBottom;
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isNearBottom]);

  // Auto-scroll when new messages arrive (only if near bottom)
  useEffect(() => {
    if (chatHistory.length > 0 && isNearBottom()) {
      scrollToBottom();
    }
  }, [chatHistory, isNearBottom, scrollToBottom]);

  // ── Streaming message animation ────────────────────────────────
  useEffect(() => {
    if (!busy) {
      setStreamingMsg("");
      streamingMsgIdx.current = 0;
      return;
    }

    const interval = setInterval(() => {
      streamingMsgIdx.current = (streamingMsgIdx.current + 1) % streamingMessages.length;
      setStreamingMsg(streamingMessages[streamingMsgIdx.current]);
    }, 1500);

    return () => clearInterval(interval);
  }, [busy]);

  // ── Abort in-flight requests on unmount ──────────────────────
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // ── ExecutionEventBus subscription ────────────────────────────
  // Subscribes to live execution events and renders them as system
  // messages in the chat, so the user can see every step of the
  // pipeline (queued, executing, agent_progress, agent_finished,
  // review_started, qa_started, completed/failed) without leaving
  // the chat page.
  useEffect(() => {
    const trackedExecutionIds = new Set<string>();

    const unsubscribe = subscribeExecutionEvents((event) => {
      // Track new executions
      if (!trackedExecutionIds.has(event.executionId)) {
        trackedExecutionIds.add(event.executionId);
      }

      // Only show events relevant to this agent's chain
      const isRelevantAgent =
        event.agentName.toLowerCase().includes("claude") ||
        event.agentName.toLowerCase().includes("gemini") ||
        event.agentName.toLowerCase().includes("opencode") ||
        event.agentName.toLowerCase().includes("openclaw") ||
        event.agentName.toLowerCase().includes("codex") ||
        event.agentName.toLowerCase().includes("brain");

      if (!isRelevantAgent) return;

      setChatHistory((current) => {
        // Format event into a system message
        const systemMsg = formatExecutionEvent(event);
        if (!systemMsg) return current;

        // Avoid duplicate messages by checking for latest event of same type+execution
        const lastMsg = current[current.length - 1];
        if (
          lastMsg &&
          lastMsg.role === "assistant" &&
          lastMsg.content === systemMsg &&
          lastMsg.timestamp &&
          Date.now() - lastMsg.timestamp < 500
        ) {
          return current;
        }

        const next = [...current, {
          role: "assistant" as const,
          content: systemMsg,
          timestamp: Date.now()
        }];
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Restore completed executions from shared runtime ─────────
  // On mount, reads ExecutionResults for this agent and merges any
  // completed executions into chatHistory. Preserves existing local
  // history and prevents duplicates.
  useEffect(() => {
    const agentResults = getResultsByAgent(id);
    if (agentResults.length === 0) return;

    setChatHistory((current) => {
      const existing = [...current];
      const existingPrompts = new Set(
        existing
          .filter((m) => m.role === "user")
          .map((m) => m.content.slice(0, 80))
      );

      for (const result of agentResults) {
        if (existingPrompts.has(result.prompt.slice(0, 80))) continue;

        existing.push(
          { role: "user", content: result.prompt, timestamp: result.timestamp },
          {
            role: "assistant",
            content: result.rawResponse || "(no output)",
            mode: "pipeline",
            timestamp: result.timestamp + 1
          }
        );
        existingPrompts.add(result.prompt.slice(0, 80));
      }

      existing.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      try {
        window.localStorage.setItem(storageKey, JSON.stringify(existing));
      } catch {}
      return existing;
    });

    const unsubscribe = onResultsUpdate((allResults) => {
      const agentResults = allResults.filter((r) => r.agentId === id);
      if (agentResults.length === 0) return;

      setChatHistory((current) => {
        const existing = [...current];
        const existingPrompts = new Set(
          existing
            .filter((m) => m.role === "user")
            .map((m) => m.content.slice(0, 80))
        );

        let changed = false;
        for (const result of agentResults) {
          if (existingPrompts.has(result.prompt.slice(0, 80))) continue;
          existing.push(
            { role: "user", content: result.prompt, timestamp: result.timestamp },
            {
              role: "assistant",
              content: result.rawResponse || "(no output)",
              mode: "pipeline",
              timestamp: result.timestamp + 1
            }
          );
          existingPrompts.add(result.prompt.slice(0, 80));
          changed = true;
        }

        if (!changed) return current;

        existing.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(existing));
        } catch {}
        return existing;
      });
    });

    return () => { unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Auto-growing textarea ──────────────────────────────────────
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  }, []);

  // ── Send message ───────────────────────────────────────────────
  async function send() {
    if (!message.trim() || busy) return;
    const userText = message;
    setMessage("");
    setBusy(true);

    // Abort any in-flight request
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setChatHistory((current) => {
      const next = [...current, { role: "user" as const, content: userText, timestamp: Date.now() }];
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      const { think } = await import("../hermes/HermesBrain");
      const { loadAgents } = await import("../hermes/AgentStore");
      const { getState } = await import("../hermes/IntegrationManager");
      const { executeTask } = await import("../hermes/BusinessAgentRuntime");

      const agents = loadAgents();
      const plan = think(userText, agents);
      const state = getState();

      let agent = agents.find((a) => a.id === integration!.id);
      if (!agent) {
        agent = agents[0] || agents.find((a) => a.id === "claude");
      }

      if (!agent) {
        throw new Error("No agent available to execute this task.");
      }

      const executionPromise = executeTask(agent, plan, state, { autoApprove: true });

      const timeoutMs = 120000;
      const result = await Promise.race([
        executionPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs / 1000}s`)), timeoutMs)
        )
      ]);

      const replyContent = result.output || "(no output)";
      setChatHistory((current) => {
        const next = [
          ...current,
          {
            role: "assistant" as const,
            content: replyContent,
            mode: "pipeline",
            timestamp: Date.now()
          }
        ];
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      const errText = err instanceof Error ? err.message : "Dispatch failed";
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

  // ── Copy message ───────────────────────────────────────────────
  function handleCopyMessage(content: string, idx: number) {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  // ── Clear chat ─────────────────────────────────────────────────
  function clearChat() {
    setChatHistory([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {}
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      send();
    }
    // Ctrl+Enter also sends
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      send();
    }
  }

  // ── Drag & Drop ────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Handle file drops if needed
  }

  if (!integration) {
    return (
      <main className="ac-layout">
        <div className="ac-empty-state">
          <p>Connector not found.</p>
        </div>
      </main>
    );
  }

  // ── Derived data ───────────────────────────────────────────────
  const Icon = agentIcons[id] || Bot;
  const badge = runtimeBadge(executionMode);
  const capabilities = integration.capabilities || ["chat"];
  const greeting = getGreeting();

  // ── Chat layout ────────────────────────────────────────────────
  return (
    <main className="ac-layout">
      {/* ── Left column: chat ── */}
      <div className="ac-chat-col">
        {/* ── Header ── */}
        <div className="ac-header">
          <div className="ac-header-left">
            <div className="ac-agent-icon">
              <Icon size={18} />
            </div>
            <div className="ac-header-info">
              <h1 className="ac-header-name">{integration.label}</h1>
              <div className="ac-header-meta">
                <span className={`ac-status-dot ${integration.status === "connected" ? "connected" : ""}`} />
                <span className="ac-status-text">
                  {integration.status === "connected" ? "Connected" : integration.status}
                </span>
                <span className="ac-meta-sep">·</span>
                <span>{badge.label}</span>
              </div>
            </div>
          </div>
          <div className="ac-header-right">
            <div className="ac-capabilities">
              {capabilities.slice(0, 4).map((cap) => {
                const CapIcon = capabilityIcon(cap);
                return (
                  <span key={cap} className="ac-cap-chip">
                    <CapIcon size={11} />
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
        <div className="ac-chat-area" ref={chatAreaRef}>
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
            <div className="ac-messages" aria-live="polite">
              {chatHistory.map((entry, idx) => (
                <ChatMessage
                  key={entry.timestamp ?? idx}
                  entry={entry}
                  idx={idx}
                  isUser={entry.role === "user"}
                  integrationLabel={integration.label}
                  Icon={Icon}
                  onCopy={handleCopyMessage}
                  copiedIdx={copiedIdx}
                  onRetry={() => {}}
                  onBookmark={() => {}}
                  onPin={() => {}}
                />
              ))}
              {busy && (
                <div className="ac-msg ac-msg-assistant">
                  <div className="ac-msg-avatar">
                    <Icon size={16} />
                  </div>
                  <div className="ac-msg-card ac-msg-card-assistant">
                    <div className="ac-streaming-status">
                      <span className="ac-streaming-dot" />
                      <span>{streamingMsg || "Thinking..."}</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* ── Scroll to bottom button ── */}
        <button
          className={`ac-scroll-bottom ${showScrollBtn ? "" : "ac-scroll-bottom-hidden"}`}
          onClick={() => {
            scrollToBottom();
            isUserScrollingRef.current = false;
          }}
        >
          <ArrowDown size={14} />
          Scroll to latest
        </button>

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
                  <ActionIcon size={13} />
                  {action.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Composer ── */}
        <div
          className="ac-composer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="ac-composer-toolbar">
            <button className="ac-composer-tool" title="Attach file">
              <Paperclip size={16} />
            </button>
            <button className="ac-composer-tool" title="Add image">
              <ImageIcon size={16} />
            </button>
          </div>
          <div className="ac-composer-input-wrap">
            <textarea
              ref={textareaRef}
              className="ac-composer-input"
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${integration.label}... (Shift+Enter for newline)`}
              rows={1}
            />
          </div>
          <button
            className="ac-composer-send"
            onClick={send}
            disabled={busy || !message.trim()}
            title="Send (Enter)"
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
                <Gauge size={13} />
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
                <MessageSquare size={13} />
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
                <Sparkles size={13} />
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
                <Zap size={13} />
                <span>Actions</span>
              </div>
              <div className="ac-sidebar-actions">
                <button className="ac-sidebar-action-btn" onClick={onOpenPlugins}>
                  <Gauge size={13} />
                  Plugin matrix
                </button>
                <button className="ac-sidebar-action-btn" onClick={clearChat}>
                  <Trash2 size={13} />
                  Clear chat
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}
