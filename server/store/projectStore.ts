import type { Project } from "./types.js";
import { projectsStore } from "./index.js";

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const projects = new Map<string, Project>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function persist(): void {
  projectsStore.save({
    _schema_version: 1,
    projects: Array.from(projects.values()),
  });
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function getAllProjects(): Project[] {
  return Array.from(projects.values());
}

export function getProjectById(id: string): Project | undefined {
  return projects.get(id);
}

export function createProject(project: Project): Project {
  projects.set(project.id, project);
  persist();
  return project;
}

export function updateProject(
  id: string,
  patch: Partial<Omit<Project, "id" | "createdAt">>,
): Project | undefined {
  const existing = projects.get(id);
  if (!existing) return undefined;

  const updated: Project = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };
  projects.set(id, updated);
  persist();
  return updated;
}

export function deleteProject(id: string): boolean {
  const deleted = projects.delete(id);
  if (deleted) persist();
  return deleted;
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/** Load projects from disk into memory. Call once at startup. */
export function loadProjects(): void {
  const data = projectsStore.getData();
  const list = (data.projects as Project[]) ?? [];
  projects.clear();
  for (const project of list) {
    projects.set(project.id, project);
  }
}
