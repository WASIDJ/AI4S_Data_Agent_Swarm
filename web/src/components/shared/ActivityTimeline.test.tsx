import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ActivityTimeline from "./ActivityTimeline";

// Mock the EventApi module
vi.mock("../../api", () => ({
  EventApi: {
    list: vi.fn(),
  },
}));

import { EventApi } from "../../api";
const mockEventApiList = vi.mocked(EventApi.list);

describe("ActivityTimeline", () => {
  beforeEach(() => {
    mockEventApiList.mockReset();
  });

  it("shows loading state", () => {
    mockEventApiList.mockReturnValue(new Promise(() => {})); // Never resolves
    render(<ActivityTimeline taskId="task-1" />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("shows empty state when no events", async () => {
    mockEventApiList.mockResolvedValueOnce([]);
    render(<ActivityTimeline taskId="task-1" />);
    await waitFor(() => {
      expect(screen.getByText("暂无活动记录")).toBeInTheDocument();
    });
  });

  it("renders event list", async () => {
    mockEventApiList.mockResolvedValueOnce([
      {
        id: "e1",
        taskId: "task-1",
        type: "task_created",
        data: {},
        createdAt: Date.now() - 1000,
      },
      {
        id: "e2",
        taskId: "task-1",
        type: "task_started",
        data: {},
        createdAt: Date.now() - 500,
      },
    ]);
    render(<ActivityTimeline taskId="task-1" />);
    await waitFor(() => {
      expect(screen.getByText("任务创建")).toBeInTheDocument();
      expect(screen.getByText("任务开始")).toBeInTheDocument();
    });
  });
});
