import {
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { AutodataGroup } from "../../api";
import { AutodataApi } from "../../api";
import { showToast } from "../NotificationContainer";

interface Props {
  group: AutodataGroup;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { icon: typeof RotateCcw; color: string; label: string }
> = {
  running: { icon: Loader2, color: "text-blue-400", label: "运行中" },
  accepted: { icon: CheckCircle, color: "text-green-400", label: "已通过" },
  rejected: { icon: XCircle, color: "text-red-400", label: "已拒绝" },
  error: { icon: AlertTriangle, color: "text-yellow-400", label: "错误" },
};

export default function AutodataGroupCard({ group, onRefresh }: Props) {
  const config = STATUS_CONFIG[group.status] ?? STATUS_CONFIG.error;
  const StatusIcon = config.icon;

  const handleRetry = async () => {
    try {
      await AutodataApi.retry(group.groupId);
      showToast("success", "已重新启动迭代");
      onRefresh();
    } catch (err: any) {
      showToast("error", err.message || "重试失败");
    }
  };

  const currentRound = group.currentRound;
  const hasScores = group.rounds.some(r => r.scores);

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={`w-4 h-4 ${config.color} ${group.status === "running" ? "animate-spin" : ""}`}
          />
          <span className="text-sm font-medium text-white">
            Pipeline {group.groupId.slice(0, 8)}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${config.color} bg-zinc-900`}
          >
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            R{currentRound}/{group.maxRounds}
          </span>
          {(group.status === "error" || group.status === "rejected") && (
            <button
              onClick={handleRetry}
              className="p-1 text-zinc-400 hover:text-white transition-colors"
              title="重试"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Round Scores */}
      {hasScores && (
        <div className="space-y-1.5">
          {group.rounds
            .filter(r => r.scores)
            .map(round => (
              <div
                key={round.round}
                className="flex items-center gap-3 text-xs bg-zinc-900/50 rounded px-3 py-1.5"
              >
                <span className="text-zinc-500 w-12">R{round.round}</span>
                <span className="text-orange-400">
                  W: {round.scores!.weakScore}%
                </span>
                <span className="text-green-400">
                  S: {round.scores!.strongScore}%
                </span>
                <span
                  className={
                    round.scores!.gap >= 20 ? "text-blue-400" : "text-zinc-500"
                  }
                >
                  Gap: {round.scores!.gap}%
                </span>
                {round.scores!.passed ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 ml-auto" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 ml-auto" />
                )}
              </div>
            ))}
        </div>
      )}

      {/* Failure Reason */}
      {group.lastFailureReason && group.status === "running" && (
        <p className="text-xs text-zinc-500 italic">
          {group.lastFailureReason}
        </p>
      )}

      {/* Input Files */}
      <div className="text-xs text-zinc-600 truncate">
        {group.inputFiles.length} file(s): {group.inputFiles[0]}
        {group.inputFiles.length > 1 && ` +${group.inputFiles.length - 1}`}
      </div>
    </div>
  );
}
