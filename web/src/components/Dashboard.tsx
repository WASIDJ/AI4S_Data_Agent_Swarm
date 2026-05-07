import TopBar from "./TopBar";
import AgentPanel from "./AgentPanel";
import KanbanBoard from "./KanbanBoard";
import DetailPanel from "./DetailPanel";
import StatusBar from "./StatusBar";
import AgentFormModal from "./modals/AgentFormModal";
import TaskFormModal from "./modals/TaskFormModal";
import NotificationContainer from "./NotificationContainer";
import ScreenGuard from "./ScreenGuard";
import UserProfileModal from "./modals/UserProfileModal";
import type { Agent, Task, Project } from "../types";
import type { UserProfile } from "../App";

interface Props {
  agents: Agent[];
  tasks: Task[];
  filteredAgents: Agent[];
  filteredTasks: Task[];
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  selectedAgent: Agent | null;
  selectedTask: Task | null;
  activeProject: string;
  agentCollapsed: boolean;
  detailCollapsed: boolean;
  showAgentModal: boolean;
  showTaskModal: boolean;
  editingAgent: Agent | null;
  editingTask: Task | null;
  preselectAgentId: string | null;
  runningCount: number;
  user: UserProfile;
  showUserModal: boolean;
  projects: Project[];
  wsConnected: boolean;
  onProjectChange: (id: string) => void;
  onNewProject: () => void;
  onToggleAgentCollapse: () => void;
  onToggleDetailCollapse: () => void;
  onSelectAgent: (id: string) => void;
  onSelectTask: (id: string) => void;
  onCreateAgent: () => void;
  onEditAgent: (agent: Agent) => void;
  onCreateTask: (agentId?: string) => void;
  onEditTask: (task: Task) => void;
  onSaveAgent: (agent: Agent, apiKey?: string) => void;
  onSaveTask: (task: Task) => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  setShowAgentModal: (v: boolean) => void;
  setShowTaskModal: (v: boolean) => void;
  setEditingAgent: (v: Agent | null) => void;
  setEditingTask: (v: Task | null) => void;
  setPreselectAgentId: (v: string | null) => void;
  setUser: (u: UserProfile) => void;
  setShowUserModal: (v: boolean) => void;
  onLogout: () => void;
}

export default function Dashboard(props: Props) {
  return (
    <ScreenGuard>
      <div
        className="h-screen flex flex-col"
        style={{ background: "var(--bg-void)" }}
      >
        <TopBar
          activeProject={props.activeProject}
          onProjectChange={props.onProjectChange}
          onNewProject={props.onNewProject}
          projects={props.projects}
          user={props.user}
          onOpenProfile={() => props.setShowUserModal(true)}
          onLogout={props.onLogout}
        />

        <div className="flex-1 flex overflow-hidden">
          <AgentPanel
            agents={props.filteredAgents}
            selectedAgentId={props.selectedAgentId}
            collapsed={props.agentCollapsed}
            onToggleCollapse={props.onToggleAgentCollapse}
            onSelectAgent={props.onSelectAgent}
            onCreateAgent={props.onCreateAgent}
            onEditAgent={props.onEditAgent}
          />

          <KanbanBoard
            tasks={props.filteredTasks}
            agents={props.agents}
            selectedTaskId={props.selectedTaskId}
            onSelectTask={props.onSelectTask}
            onCreateTask={props.onCreateTask}
            onEditTask={props.onEditTask}
            setTasks={props.setTasks}
          />

          <DetailPanel
            task={props.selectedTask}
            agent={props.selectedAgent}
            tasks={props.tasks}
            collapsed={props.detailCollapsed}
            onToggleCollapse={props.onToggleDetailCollapse}
            onSelectTask={props.onSelectTask}
            onSelectAgent={props.onSelectAgent}
            onEditTask={props.onEditTask}
            onEditAgent={props.onEditAgent}
            setTasks={props.setTasks}
          />
        </div>

        <StatusBar
          agentCount={props.agents.length}
          runningCount={props.runningCount}
          connected={props.wsConnected}
        />

        {props.showAgentModal && (
          <AgentFormModal
            agent={props.editingAgent}
            projects={props.projects}
            existingAgents={props.agents}
            onClose={() => {
              props.setShowAgentModal(false);
              props.setEditingAgent(null);
            }}
            onSave={props.onSaveAgent}
          />
        )}

        {props.showTaskModal && (
          <TaskFormModal
            task={props.editingTask}
            preselectAgentId={props.preselectAgentId}
            agents={props.agents}
            projects={props.projects}
            onClose={() => {
              props.setShowTaskModal(false);
              props.setEditingTask(null);
              props.setPreselectAgentId(null);
            }}
            onSave={props.onSaveTask}
          />
        )}

        {props.showUserModal && (
          <UserProfileModal
            user={props.user}
            onClose={() => props.setShowUserModal(false)}
            onSave={u => {
              props.setUser(u);
              props.setShowUserModal(false);
            }}
          />
        )}

        <NotificationContainer />
      </div>
    </ScreenGuard>
  );
}
