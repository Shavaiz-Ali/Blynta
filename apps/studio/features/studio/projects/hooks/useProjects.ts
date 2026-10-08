"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@blynta/auth/react";
import { toast } from "sonner";
import { studioApi, studioKeys, studioRequest } from "../../api";
import type { Project } from "../../types";
export function useProjects() {
  const { data: session } = useSession();
  const client = useQueryClient();
  const key = studioKeys.projects(session?.user.id || "");
  const query = useQuery({
    queryKey: key,
    queryFn: studioApi.list,
    enabled: !!session,
    refetchOnWindowFocus: true,
  });
  const projects = query.data || [];
  async function update(next: Project[]) {
    try {
      for (const old of projects) {
        const p = next.find((p) => p.id === old.id);
        if (!p) {
          await studioRequest(`projects/${old.id}`, "DELETE");
          client.removeQueries({
            queryKey: studioKeys.project(old.id, session?.user.id || ""),
          });
        } else if (p.name !== old.name) {
          await studioRequest(`projects/${old.id}`, "PATCH", {
            name: p.name,
            revision: old.revision,
          });
          await client.invalidateQueries({
            queryKey: studioKeys.project(old.id, session?.user.id || ""),
          });
        }
      }
      await client.invalidateQueries({ queryKey: key });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update project",
      );
      throw error;
    }
  }
  function prepare(project: Project) {
    // List documents lack the editor's playable URLs: warm the full detail query.
    if (!session?.user.id) return;
    void client.prefetchQuery({
      queryKey: studioKeys.project(project.id, session.user.id),
      queryFn: () => studioApi.project(project.id),
    });
  }
  return {
    projects,
    ready: !!query.data,
    error: query.error?.message || "",
    update,
    retry: () => {
      void query.refetch();
    },
    retrying: query.isFetching,
    prepare,
  };
}
