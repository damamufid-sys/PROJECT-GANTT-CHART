import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AnalysisResult,
  AssignmentDto,
  DependencyDto,
  HolidayDto,
  ProjectDto,
  ProjectSnapshot,
  ResourceDto,
  TaskDto,
} from '@gantt/shared';
import { apiRequest } from '../api/client';

const projectKey = (projectId: string) => ['project', projectId] as const;
const analysisKey = (projectId: string) => ['analysis', projectId] as const;

export function useProjectSnapshot(projectId: string) {
  return useQuery({
    queryKey: projectKey(projectId),
    queryFn: () => apiRequest<ProjectSnapshot>(`/projects/${projectId}`),
    enabled: projectId.length > 0,
  });
}

export function useAnalysis(projectId: string, enabled = true) {
  return useQuery({
    queryKey: analysisKey(projectId),
    queryFn: () => apiRequest<AnalysisResult>(`/projects/${projectId}/analysis`),
    enabled: projectId.length > 0 && enabled,
  });
}

/** Menerapkan daftar tugas terbaru dari server ke cache tanpa refetch penuh. */
function applyTasks(queryClient: QueryClient, projectId: string, tasks: TaskDto[]): void {
  queryClient.setQueryData<ProjectSnapshot>(projectKey(projectId), (old) =>
    old ? { ...old, tasks } : old,
  );
  void queryClient.invalidateQueries({ queryKey: analysisKey(projectId) });
}

function refreshSnapshot(queryClient: QueryClient, projectId: string): void {
  void queryClient.invalidateQueries({ queryKey: projectKey(projectId) });
  void queryClient.invalidateQueries({ queryKey: analysisKey(projectId) });
}

export function useProjectActions(projectId: string) {
  const queryClient = useQueryClient();

  const updateProject = useMutation({
    mutationFn: (input: { name?: string; description?: string | null; startDate?: string }) =>
      apiRequest<{ project: ProjectDto }>(`/projects/${projectId}`, { method: 'PATCH', body: input }),
    onSuccess: (data) => {
      queryClient.setQueryData<ProjectSnapshot>(projectKey(projectId), (old) =>
        old ? { ...old, project: data.project } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const createTask = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiRequest<{ tasks: TaskDto[]; task: TaskDto | null }>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (data) => applyTasks(queryClient, projectId, data.tasks),
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: Record<string, unknown> }) =>
      apiRequest<{ tasks: TaskDto[] }>(`/tasks/${taskId}`, { method: 'PATCH', body: input }),
    onSuccess: (data) => applyTasks(queryClient, projectId, data.tasks),
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<{ tasks: TaskDto[] }>(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: (data) => applyTasks(queryClient, projectId, data.tasks),
  });

  const moveTask = useMutation({
    mutationFn: ({ taskId, parentId, position }: { taskId: string; parentId: string | null; position: number }) =>
      apiRequest<{ tasks: TaskDto[] }>(`/tasks/${taskId}/move`, {
        method: 'POST',
        body: { parentId, position },
      }),
    onSuccess: (data) => applyTasks(queryClient, projectId, data.tasks),
  });

  const addDependency = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: { predecessorId: string; type: 'FS' | 'SS'; lagDays: number } }) =>
      apiRequest<{ tasks: TaskDto[]; dependency: DependencyDto }>(`/tasks/${taskId}/dependencies`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (data) => {
      applyTasks(queryClient, projectId, data.tasks);
      refreshSnapshot(queryClient, projectId);
    },
  });

  const updateDependency = useMutation({
    mutationFn: ({ dependencyId, input }: { dependencyId: string; input: { type?: 'FS' | 'SS'; lagDays?: number } }) =>
      apiRequest<{ tasks: TaskDto[]; dependency: DependencyDto }>(`/dependencies/${dependencyId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: (data) => {
      applyTasks(queryClient, projectId, data.tasks);
      refreshSnapshot(queryClient, projectId);
    },
  });

  const deleteDependency = useMutation({
    mutationFn: (dependencyId: string) =>
      apiRequest<{ tasks: TaskDto[] }>(`/dependencies/${dependencyId}`, { method: 'DELETE' }),
    onSuccess: (data) => {
      applyTasks(queryClient, projectId, data.tasks);
      refreshSnapshot(queryClient, projectId);
    },
  });

  const createResource = useMutation({
    mutationFn: (input: { name: string; email: string; role: string; salary: number }) =>
      apiRequest<{ resource: ResourceDto }>(`/projects/${projectId}/resources`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => refreshSnapshot(queryClient, projectId),
  });

  const updateResource = useMutation({
    mutationFn: ({ resourceId, input }: { resourceId: string; input: Record<string, unknown> }) =>
      apiRequest<{ resource: ResourceDto }>(`/resources/${resourceId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => refreshSnapshot(queryClient, projectId),
  });

  const deleteResource = useMutation({
    mutationFn: (resourceId: string) =>
      apiRequest<void>(`/resources/${resourceId}`, { method: 'DELETE' }),
    onSuccess: () => refreshSnapshot(queryClient, projectId),
  });

  const addAssignment = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: { resourceId: string; allocationPercent: number } }) =>
      apiRequest<{ assignment: AssignmentDto }>(`/tasks/${taskId}/assignments`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => refreshSnapshot(queryClient, projectId),
  });

  const updateAssignment = useMutation({
    mutationFn: ({ assignmentId, input }: { assignmentId: string; input: { allocationPercent: number } }) =>
      apiRequest<{ assignment: AssignmentDto }>(`/assignments/${assignmentId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => refreshSnapshot(queryClient, projectId),
  });

  const deleteAssignment = useMutation({
    mutationFn: (assignmentId: string) =>
      apiRequest<void>(`/assignments/${assignmentId}`, { method: 'DELETE' }),
    onSuccess: () => refreshSnapshot(queryClient, projectId),
  });

  const updateCalendar = useMutation({
    mutationFn: (weekendDays: number[]) =>
      apiRequest<{ project: ProjectDto; tasks: TaskDto[] }>(`/projects/${projectId}/calendar`, {
        method: 'PUT',
        body: { weekendDays },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<ProjectSnapshot>(projectKey(projectId), (old) =>
        old ? { ...old, project: data.project, tasks: data.tasks } : old,
      );
      void queryClient.invalidateQueries({ queryKey: analysisKey(projectId) });
    },
  });

  const addHoliday = useMutation({
    mutationFn: (input: { date: string; name: string }) =>
      apiRequest<{ holiday: HolidayDto; tasks: TaskDto[] }>(`/projects/${projectId}/holidays`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (data) => {
      applyTasks(queryClient, projectId, data.tasks);
      refreshSnapshot(queryClient, projectId);
    },
  });

  const deleteHoliday = useMutation({
    mutationFn: (holidayId: string) =>
      apiRequest<{ tasks: TaskDto[] }>(`/holidays/${holidayId}`, { method: 'DELETE' }),
    onSuccess: (data) => {
      applyTasks(queryClient, projectId, data.tasks);
      refreshSnapshot(queryClient, projectId);
    },
  });

  return {
    updateProject,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    addDependency,
    updateDependency,
    deleteDependency,
    createResource,
    updateResource,
    deleteResource,
    addAssignment,
    updateAssignment,
    deleteAssignment,
    updateCalendar,
    addHoliday,
    deleteHoliday,
  };
}
