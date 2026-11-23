import { IPC } from './contracts.ts';
/** Explicit capabilities. Window/camera, arbitrary IPC, credentials and destructive app settings are absent. */
export const DUO_FILE_READ_CHANNELS = new Set<string>([IPC.filesList, IPC.filesRead, IPC.filesSearch]);
export const DUO_READ_CHANNELS = new Set<string>([
  ...DUO_FILE_READ_CHANNELS,
  IPC.materialsSnapshot,IPC.browserGetState,IPC.pluginsList,
  IPC.authorThemesList,IPC.authorThemesPreview,IPC.wallpapersList,IPC.wallpapersRead,IPC.pixelSkinsList,IPC.pixelSkinsReadAsset,
  IPC.terminalBorderSkinsList,IPC.terminalBorderSkinsGet,IPC.mediaRead,IPC.pluginsStorageGet,
  IPC.pluginsMediaListLibraries,IPC.pluginsPlaylistsList,IPC.pluginsPlaylistsRead
]);
export const DUO_WRITE_CHANNELS = new Set<string>([
  IPC.filesLocations,IPC.filesListRoots,IPC.filesRegisterRoot,IPC.filesResolvePath,IPC.filesCloseRoot,
  IPC.materialsAddPaths,IPC.materialsSetBounds,IPC.materialsSetBoundsBatch,IPC.materialsRemove,IPC.materialsPinVersion,
  IPC.materialsAddRemark,IPC.materialsUpdateRemark,IPC.materialsDeleteRemark,
  IPC.browserOpen,IPC.browserClose,IPC.browserNewTab,IPC.browserSelectTab,IPC.browserCloseTab,IPC.browserCloseAllTabs,
  IPC.browserNavigate,IPC.browserBack,IPC.browserForward,IPC.browserReload,
  IPC.pluginsStorageSet,IPC.pluginsFilesRequest,IPC.pluginsServiceRequest,IPC.pluginsOpenBrowser,
  IPC.pluginsMediaScanLibrary,IPC.pluginsPlaylistsWrite,IPC.pluginsFileDropText
]);
export const DUO_LOCAL_BROWSER_SENDS = new Set<string>([IPC.browserSetViewport,IPC.browserFocus,IPC.browserSetInputFocused]);

/** Maximum concurrent chunked results retained for a connected guest. */
export const DUO_RESOURCE_TRANSFER_LIMIT = 8;

/** Finish a paged host result, releasing its slot if a continuation fails. */
export async function readDuoResource(call: (channel: string, args: unknown[]) => Promise<any>, channel: string, args: unknown[]): Promise<any> {
  const first = await call(channel, args);
  if (!first?.chunk) return first?.value;
  const {chunk: id, total} = first;
  try {
    if (!Number.isSafeInteger(total) || total > 32 * 1024 * 1024 || first.offset !== 0 ||
        typeof first.data !== 'string' || !first.data.length || first.data.length > total) {
      throw Error('Invalid shared resource size.');
    }
    let text = first.data;
    while (text.length < total) {
      const part = await call('chunk', [id, text.length]);
      if (part?.chunk !== id || part.offset !== text.length || part.total !== total ||
          typeof part.data !== 'string' || !part.data.length || part.data.length > total - text.length) {
        throw Error('Invalid shared resource chunk.');
      }
      text += part.data;
    }
    return JSON.parse(text);
  } catch (error) {
    // A disconnected host clears its own transfers. Keep the original read error.
    await call('chunk-abandon', [id]).catch(() => undefined);
    throw error;
  }
}
