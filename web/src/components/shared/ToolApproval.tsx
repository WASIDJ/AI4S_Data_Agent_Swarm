import { useState } from "react";
import { Shield, Check, X } from "lucide-react";
import { ToolApprovalApi } from "../../api";
import { showToast } from "../NotificationContainer";

interface Props {
  taskId: string;
}

export default function ToolApproval({ taskId }: Props) {
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );

  const handleApprove = async () => {
    try {
      await ToolApprovalApi.approve(taskId);
      setDecision("approved");
      showToast("success", "工具调用已批准");
    } catch (err) {
      showToast("error", `审批失败: ${err}`);
    }
  };

  const handleReject = async () => {
    try {
      await ToolApprovalApi.reject(taskId);
      setDecision("rejected");
      showToast("info", "工具调用已拒绝");
    } catch (err) {
      showToast("error", `拒绝失败: ${err}`);
    }
  };

  if (decision !== "pending") {
    return (
      <div
        className="rounded-xl p-3 flex items-center gap-2"
        style={{
          background:
            decision === "approved"
              ? "rgba(61,220,132,0.06)"
              : "rgba(239,68,68,0.06)",
          border: `1px solid ${decision === "approved" ? "rgba(61,220,132,0.12)" : "rgba(239,68,68,0.12)"}`,
        }}
      >
        <Check
          size={12}
          style={{
            color:
              decision === "approved"
                ? "var(--accent-green)"
                : "var(--accent-red)",
          }}
        />
        <span
          className="text-[10px]"
          style={{
            color:
              decision === "approved"
                ? "var(--accent-green)"
                : "var(--accent-red)",
          }}
        >
          {decision === "approved" ? "工具调用已批准" : "工具调用已拒绝"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background:
          "linear-gradient(175deg, rgba(255,162,122,0.04) 0%, rgba(200,149,108,0.02) 100%)",
        border: "1px solid rgba(255,162,122,0.1)",
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Shield size={12} style={{ color: "#ffa27a" }} />
        <span
          className="text-[10px] font-medium tracking-wider uppercase"
          style={{ color: "#ffa27a" }}
        >
          工具调用审批
        </span>
      </div>
      <p
        className="text-[10px] leading-relaxed mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        智能体请求使用需要审批的工具。是否批准继续执行？
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] transition-all"
          style={{
            background: "rgba(61,220,132,0.1)",
            color: "var(--accent-green)",
            border: "1px solid rgba(61,220,132,0.15)",
          }}
        >
          <Check size={11} /> 批准
        </button>
        <button
          onClick={handleReject}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] transition-all"
          style={{
            background: "rgba(239,68,68,0.08)",
            color: "var(--accent-red)",
            border: "1px solid rgba(239,68,68,0.12)",
          }}
        >
          <X size={11} /> 拒绝
        </button>
      </div>
    </div>
  );
}
