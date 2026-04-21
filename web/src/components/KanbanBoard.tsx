import { useState } from "react";
import { useAppState, useAppDispatch } from "../store/AppContext";
import { TaskCard } from "./TaskCard";
import { TaskFormModal } from "./modals/TaskFormModal";
import type { Task, TaskStatus } from "../types";

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

interface Column {
  status: TaskStatus;
  label: string;
  icon: string;
}

const COLUMNS: Column[] = [
  { status: "Todo", label: "Todo", icon: "\u{1F4CB}" },
  { status: "Running", label: "Running", icon: "\u{1F504}" },
  { status: "Stuck", label: "Stuck", icon: "\u{1F7E1}" },
  { status: "Done", label: "Done", icon: "\u2705" },
];

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------

export function KanbanBoard() {
  const { tasks, activeProjectId } = useAppState();
  const dispatch = useAppDispatch();
  const [modalTask, setModalTask] = useState<Task | "create" | null>(null);

  // Filter tasks by active project
  const filteredTasks = activeProjectId
    ? [...tasks.values()].filter((t) => t.projectId === activeProjectId)
    : [...tasks.values()];

  // Group by status (Cancelled grouped with Done)
  const columnTasks = (status: TaskStatus): Task[] => {
    if (status === "Done") {
      return filteredTasks
        .filter((t) => t.status === "Done" || t.status === "Cancelled")
        .sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
    }
    return filteredTasks
      .filter((t) => t.status === status)
      .sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
  };

  return (
    <div className="kanban">
      <div className="kanban-header">
        <span className="kanban-title">Tasks</span>
        <button className="btn btn-small" onClick={() => setModalTask("create")}>
          + Task
        </button>
      </div>

      <div className="kanban-columns">
        {COLUMNS.map((col) => {
          const items = columnTasks(col.status);
          return (
            <div key={col.status} className="kanban-column">
              <div className="kanban-column-header">
                <span>
                  {col.icon} {col.label}
                </span>
                <span className="kanban-column-count">{items.length}</span>
              </div>
              <div className="kanban-column-body">
                {items.length === 0 ? (
                  <div className="kanban-empty">
                    <span>{col.status === "Todo" ? "\u{1F4CB}" : "\u2705"}</span>
                    <p>
                      {col.status === "Todo"
                        ? "没有待处理的任务"
                        : "暂无任务"}
                    </p>
                  </div>
                ) : (
                  items.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onSelect={(id) =>
                        dispatch({
                          type: "SET_SELECTED_TASK",
                          taskId: id,
                        })
                      }
                      onEdit={(t) => setModalTask(t)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalTask !== null && (
        <TaskFormModal
          task={modalTask === "create" ? undefined : modalTask}
          onClose={() => setModalTask(null)}
        />
      )}
    </div>
  );
}
