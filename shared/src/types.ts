/**
 * Tipe dasar yang dipakai bersama server dan client.
 * Semua tanggal disimpan sebagai string ISO `YYYY-MM-DD`.
 */

import type { OverallocationWarning, ResourceCost, TaskCost } from './cost.js';
import type { CpmTask } from './cpm.js';
import type { PertNetwork } from './pert.js';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export type DependencyType = 'FS' | 'SS';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  startDate: string;
  weekendDays: string;
  createdAt: string;
}

export interface HolidayDto {
  id: string;
  projectId: string;
  date: string;
  name: string;
}

export interface TaskDto {
  id: string;
  projectId: string;
  parentId: string | null;
  position: number;
  name: string;
  description: string | null;
  durationDays: number;
  startDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  priority: Priority;
  color: string;
  progress: number;
  optimisticDays: number | null;
  pessimisticDays: number | null;
}

export interface DependencyDto {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ResourceDto {
  id: string;
  projectId: string;
  name: string;
  email: string;
  role: string;
  salary: number;
}

export interface AssignmentDto {
  id: string;
  taskId: string;
  resourceId: string;
  allocationPercent: number;
}

/** Snapshot lengkap satu proyek (respons GET /api/projects/:id). */
export interface ProjectSnapshot {
  project: ProjectDto;
  tasks: TaskDto[];
  dependencies: DependencyDto[];
  resources: ResourceDto[];
  assignments: AssignmentDto[];
  holidays: HolidayDto[];
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Respons standar setiap mutasi yang mengubah jadwal. */
export interface TasksResponse {
  tasks: TaskDto[];
}

export interface AnalysisSummary {
  startDate: string;
  endDate: string;
  totalWorkingDays: number;
  totalCost: number;
  totalTasks: number;
  criticalTaskCount: number;
}

/** Respons GET /api/projects/:id/analysis. */
export interface AnalysisResult {
  summary: AnalysisSummary;
  cpm: CpmTask[];
  criticalPaths: string[][];
  criticalPathNames: string[][];
  pert: PertNetwork;
  costs: {
    total: number;
    tasks: TaskCost[];
    resources: Array<ResourceCost & { name: string; email: string; role: string }>;
  };
  overallocations: OverallocationWarning[];
}
