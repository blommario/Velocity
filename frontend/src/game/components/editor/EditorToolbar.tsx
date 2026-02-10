import { useEditorStore, EDITOR_TOOLS, LIGHTING_PRESETS, type EditorTool, type LightingPreset } from '@game/stores/editorStore';
import { useGameStore, SCREENS } from '@game/stores/gameStore';

const TOOL_ITEMS: { tool: EditorTool; label: string; shortcut: string }[] = [
  { tool: EDITOR_TOOLS.SELECT, label: 'Select', shortcut: 'V' },
  { tool: EDITOR_TOOLS.PLACE, label: 'Place', shortcut: 'P' },
  { tool: EDITOR_TOOLS.MOVE, label: 'Move', shortcut: 'G' },
  { tool: EDITOR_TOOLS.ROTATE, label: 'Rotate', shortcut: 'R' },
  { tool: EDITOR_TOOLS.SCALE, label: 'Scale', shortcut: 'S' },
];

const PRESET_ITEMS: { preset: LightingPreset; label: string }[] = [
  { preset: LIGHTING_PRESETS.DAY, label: 'Day' },
  { preset: LIGHTING_PRESETS.SUNSET, label: 'Sunset' },
  { preset: LIGHTING_PRESETS.NIGHT, label: 'Night' },
  { preset: LIGHTING_PRESETS.NEON, label: 'Neon' },
];

export function EditorToolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  const gridSize = useEditorStore((s) => s.gridSize);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const cycleGridSize = useEditorStore((s) => s.cycleGridSize);
  const toggleGridVisible = useEditorStore((s) => s.toggleGridVisible);
  const toggleSnapToGrid = useEditorStore((s) => s.toggleSnapToGrid);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const applyLightingPreset = useEditorStore((s) => s.applyLightingPreset);
  const toggleTestPlay = useEditorStore((s) => s.toggleTestPlay);
  const isTestPlaying = useEditorStore((s) => s.isTestPlaying);
  const newMap = useEditorStore((s) => s.newMap);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 border-b border-gray-700 text-xs">
      {/* File */}
      <div className="flex items-center gap-1 mr-3">
        <ToolbarButton label="New" onClick={newMap} />
        <ToolbarButton label="Menu" onClick={() => setScreen(SCREENS.MAIN_MENU)} />
      </div>

      <div className="w-px h-5 bg-gray-700" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1 mx-2">
        <ToolbarButton label="Undo" onClick={undo} disabled={undoStack.length === 0} />
        <ToolbarButton label="Redo" onClick={redo} disabled={redoStack.length === 0} />
      </div>

      <div className="w-px h-5 bg-gray-700" />

      {/* Tools */}
      <div className="flex items-center gap-1 mx-2">
        {TOOL_ITEMS.map((item) => (
          <ToolbarButton
            key={item.tool}
            label={`${item.label} (${item.shortcut})`}
            active={activeTool === item.tool}
            onClick={() => setTool(item.tool)}
          />
        ))}
      </div>

      <div className="w-px h-5 bg-gray-700" />

      {/* Grid */}
      <div className="flex items-center gap-1 mx-2">
        <ToolbarButton
          label={`Grid: ${gridSize}`}
          onClick={cycleGridSize}
        />
        <ToolbarButton
          label="Show Grid"
          active={gridVisible}
          onClick={toggleGridVisible}
        />
        <ToolbarButton
          label="Snap"
          active={snapToGrid}
          onClick={toggleSnapToGrid}
        />
      </div>

      <div className="w-px h-5 bg-gray-700" />

      {/* Lighting presets */}
      <div className="flex items-center gap-1 mx-2">
        {PRESET_ITEMS.map((item) => (
          <ToolbarButton
            key={item.preset}
            label={item.label}
            onClick={() => applyLightingPreset(item.preset)}
          />
        ))}
      </div>

      <div className="flex-1" />

      {/* Test Play */}
      <ToolbarButton
        label={isTestPlaying ? 'Stop (Tab)' : 'Test Play (Tab)'}
        active={isTestPlaying}
        onClick={toggleTestPlay}
        accent
      />
    </div>
  );
}

function ToolbarButton({ label, active, disabled, accent, onClick }: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  const base = 'px-2 py-1 rounded font-medium transition-colors cursor-pointer';
  const style = accent
    ? active
      ? 'bg-red-600 text-white'
      : 'bg-green-600 hover:bg-green-500 text-white'
    : active
      ? 'bg-white/20 text-white'
      : disabled
        ? 'text-gray-600 cursor-not-allowed'
        : 'text-gray-400 hover:text-white hover:bg-white/10';

  return (
    <button
      className={`${base} ${style}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
