import { useEffect } from 'react';
import { EditorToolbar } from './EditorToolbar';
import { ObjectPalette } from './ObjectPalette';
import { PropertiesPanel } from './PropertiesPanel';
import { EditorViewport } from './EditorViewport';
import { SavePublishModal } from './SavePublishModal';
import { useEditorStore, EDITOR_TOOLS } from '../../stores/editorStore';
import { useGameStore } from '../../stores/gameStore';
import { GameCanvas } from '../game/GameCanvas';

/** Keyboard shortcuts for the editor */
function useEditorShortcuts() {
  const setTool = useEditorStore((s) => s.setTool);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const selectedId = useEditorStore((s) => s.selectedId);
  const removeObject = useEditorStore((s) => s.removeObject);
  const duplicateObject = useEditorStore((s) => s.duplicateObject);
  const toggleTestPlay = useEditorStore((s) => s.toggleTestPlay);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (e.code === 'KeyY') {
          e.preventDefault();
          redo();
          return;
        }
        if (e.code === 'KeyD' && selectedId) {
          e.preventDefault();
          duplicateObject(selectedId);
          return;
        }
        if (e.code === 'KeyS') {
          e.preventDefault();
          document.getElementById('editor-save-btn')?.click();
          return;
        }
      }

      switch (e.code) {
        case 'KeyV': setTool(EDITOR_TOOLS.SELECT); break;
        case 'KeyP': setTool(EDITOR_TOOLS.PLACE); break;
        case 'KeyG': setTool(EDITOR_TOOLS.MOVE); break;
        case 'KeyR': setTool(EDITOR_TOOLS.ROTATE); break;
        case 'KeyS':
          if (!e.ctrlKey && !e.metaKey) setTool(EDITOR_TOOLS.SCALE);
          break;
        case 'Tab':
          e.preventDefault();
          toggleTestPlay();
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedId) removeObject(selectedId);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, undo, redo, selectedId, removeObject, duplicateObject, toggleTestPlay]);
}

export function MapEditor() {
  useEditorShortcuts();
  const isTestPlaying = useEditorStore((s) => s.isTestPlaying);

  if (isTestPlaying) {
    return <TestPlayMode />;
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 text-white">
      <EditorToolbar />
      <div className="flex flex-1 overflow-hidden">
        <ObjectPalette />
        <div className="flex-1 relative">
          <EditorViewport />
        </div>
        <PropertiesPanel />
      </div>
      <SavePublishModal />
    </div>
  );
}

function TestPlayMode() {
  const toggleTestPlay = useEditorStore((s) => s.toggleTestPlay);
  const exportMapData = useEditorStore((s) => s.exportMapData);

  useEffect(() => {
    const mapData = exportMapData();
    useGameStore.getState().loadMap('editor-test', mapData);
  }, [exportMapData]);

  // Listen for Tab to exit test play
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        toggleTestPlay();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleTestPlay]);

  return (
    <div className="relative w-screen h-screen">
      <GameCanvas />
      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-1 rounded text-sm z-50 pointer-events-none">
        Press Tab to return to editor
      </div>
    </div>
  );
}
