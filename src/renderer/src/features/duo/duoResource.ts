import { readDuoResource } from "../../../../shared/readDuoResource";
import { duoWorkspace } from "./duoWorkspaceRuntime";

/** The host exposes a bounded, explicit resource API, never arbitrary renderer IPC. */
export async function duoResource<T>(channel: string, args: unknown[] = []): Promise<T> {
  const workspace = duoWorkspace.get().reply?.state.workspaceId;
  return readDuoResource(async (name, parameters) => {
    if (!workspace || duoWorkspace.get().reply?.state.workspaceId !== workspace) throw Error("Duo workspace changed.");
    const reply = await window.canvasTTY.duo.command({action: "resource", channel: name, args: parameters});
    if (reply.state.workspaceId !== workspace || duoWorkspace.get().reply?.state.workspaceId !== workspace) {
      throw Error("Duo workspace changed.");
    }
    return reply.snapshot?.result;
  }, channel, args);
}
