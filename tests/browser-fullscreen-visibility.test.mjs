import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/renderer/src/features/workspace/WorkspaceCanvas.tsx", import.meta.url), "utf8");
const cardStart = source.indexOf("<BrowserCard");
assert.ok(cardStart >= 0);
const visible = source.slice(cardStart, source.indexOf("/>", cardStart)).match(/\bvisible=\{([^}]+)\}/)?.[1];
assert.ok(visible, "test executes the production BrowserCard visibility decision");
const nativeContentVisible = source.match(/const nativeContentVisible = ([\s\S]*?);/)?.[1];
assert.ok(nativeContentVisible, "test executes the shared native content visibility decision");
const evaluateVisibility = new Function("state", `with (state) { const nativeContentVisible = (${nativeContentVisible}); return (${visible}); }`);

const unobstructed = {
  browserViewVisible: true,
  fullscreenSessionId: null,
  homeEditing: false,
  contextMenu: null,
  regionEditor: null,
  commandPaletteOpen: false,
  radialLauncher: null,
  browserOccluded: false,
  browserUnderOverlay: false
};

test("native Browser visibility follows terminal fullscreen enter, switch and exit", () => {
  const state = { ...unobstructed };
  assert.equal(evaluateVisibility(state), true);
  for (const fullscreenSessionId of ["shell", "agent", null, "shell", null]) {
    state.fullscreenSessionId = fullscreenSessionId;
    assert.equal(evaluateVisibility(state), fullscreenSessionId === null,
      fullscreenSessionId === null ? "exiting restores Browser visibility" : "any fullscreen terminal hides Browser");
  }
});

test("exiting fullscreen still respects every existing Browser visibility blocker", () => {
  for (const patch of [
    { browserViewVisible: false }, { homeEditing: true }, { contextMenu: {} },
    { regionEditor: {} }, { commandPaletteOpen: true }, { radialLauncher: {} },
    { browserOccluded: true }, { browserUnderOverlay: true }
  ]) {
    const state = { ...unobstructed, ...patch, fullscreenSessionId: "shell" };
    assert.equal(evaluateVisibility(state), false);
    state.fullscreenSessionId = null;
    assert.equal(evaluateVisibility(state), false, JSON.stringify(patch));
  }
});

test("the native browser yields only while the guest host-folder dialog is rendered", async () => {
  const app = await readFile(new URL("../src/renderer/src/App.tsx", import.meta.url), "utf8");
  const folder = app.match(/const hostFolderVisible = ([\s\S]*?);/)?.[1];
  const visibility = app.match(/browserViewVisible=\{([^\n]+)\}/)?.[1];
  assert.ok(folder && visibility && app.includes("{hostFolderVisible && <HostFolderDialog"));
  const evaluate = new Function("state", `with (state) { const hostFolderVisible = (${folder}); return (${visibility}); }`);
  const state = { hostFolder:{workspace:"one"}, duoGuest:true, duoDocument:true, duoFullCanvas:false,
    duoView:{connected:true,reply:{state:{manage:true,workspaceId:"one"}}}, duoRestricted:false,
    settingsOpen:false,usageHistoryOpen:false,duoOpen:false,shortcutReferenceOpen:false,
    launchProvider:null,pendingTerminalUrl:null,handoffRemarkIds:null };
  assert.equal(evaluate(state), false);
  for (const change of [{hostFolder:null}, {duoGuest:false}, {duoDocument:false}, {hostFolder:{workspace:"two"}},
    {duoView:{...state.duoView,connected:false}}, {duoView:{connected:true,reply:{state:{manage:false,workspaceId:"one"}}}}]) {
    assert.equal(evaluate({...state, ...change}), true);
  }

  // Exercise App's render-time transition with a state setter across successive renders.
  const transition = app.slice(app.indexOf("const hostFolderVisible ="), app.indexOf("const [launchProvider,"));
  const render = new Function("state", "setHostFolder", `with (state) { ${transition} return Boolean(hostFolderVisible); }`);
  const setFolder = request => { state.hostFolder = request; };
  assert.equal(render(state, setFolder), true);
  state.duoView.reply.state.manage = false;
  assert.equal(render(state, setFolder), false);
  state.duoView.reply.state.manage = true;
  assert.equal(render(state, setFolder), false, "restoring control must not reopen the old request");
  setFolder({workspace:"one"});
  assert.equal(render(state, setFolder), true, "a new user action can still open the picker");
});
