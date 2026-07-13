import { Bot, Code2, FileCode2, Gem, PlugZap, Sparkles, TerminalSquare, Zap } from "lucide-react";

const agentIcons: Record<string, typeof TerminalSquare> = {
  claude: TerminalSquare,
  openclaw: Bot,
  openclaude: Sparkles,
  gemini: Sparkles,
  codex: Zap,
  opencode: TerminalSquare,
  "free-claude-code": PlugZap
};

export default agentIcons;
