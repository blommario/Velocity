import { useState } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import type { MapDifficulty } from '../../services/types';

const DIFFICULTIES: MapDifficulty[] = ['Easy', 'Medium', 'Hard', 'Expert'];

export function SavePublishModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [mapName, setMapName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<MapDifficulty>('Medium');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const exportMapData = useEditorStore((s) => s.exportMapData);
  const validate = useEditorStore((s) => s.validate);
  const token = useAuthStore((s) => s.token);

  const handlePublish = async () => {
    const errors = validate();
    if (errors.length > 0) {
      setResult(`Validation errors: ${errors.join(', ')}`);
      return;
    }

    if (!token) {
      setResult('You must be logged in to publish maps');
      return;
    }

    if (!mapName.trim()) {
      setResult('Map name is required');
      return;
    }

    setPublishing(true);
    setResult(null);

    try {
      const mapData = exportMapData();
      await api.post('/maps', {
        name: mapName.trim(),
        description: description.trim(),
        difficulty,
        mapDataJson: JSON.stringify(mapData),
      });
      setResult('Map published successfully!');
    } catch (err) {
      setResult(`Failed to publish: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveLocal = () => {
    const mapData = exportMapData();
    const json = JSON.stringify(mapData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapName || 'map'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadLocal = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        useEditorStore.getState().importMapData(data);
        setResult('Map loaded successfully');
      } catch {
        setResult('Invalid map file');
      }
    };
    input.click();
  };

  return (
    <>
      {/* Trigger button in toolbar — rendered by EditorToolbar via keyboard Ctrl+S */}
      <SaveButton onClick={() => setIsOpen(true)} />

      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-[400px] text-white">
            <h2 className="text-lg font-bold mb-4">Save / Publish Map</h2>

            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs uppercase">Map Name</label>
                <input
                  type="text"
                  value={mapName}
                  onChange={(e) => setMapName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white mt-1"
                  placeholder="My Awesome Map"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white mt-1"
                  rows={3}
                  placeholder="A short description of your map..."
                  maxLength={500}
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as MapDifficulty)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white mt-1"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {result && (
                <div className={`text-sm ${result.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                  {result}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white font-bold py-2 rounded transition-colors cursor-pointer"
                >
                  {publishing ? 'Publishing...' : 'Publish'}
                </button>
                <button
                  onClick={handleSaveLocal}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded transition-colors cursor-pointer"
                >
                  Save File
                </button>
                <button
                  onClick={handleLoadLocal}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 rounded transition-colors cursor-pointer"
                >
                  Load File
                </button>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-full text-gray-400 hover:text-white text-sm mt-2 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SaveButton({ onClick }: { onClick: () => void }) {
  // Render nothing — triggered via Ctrl+S in shortcuts
  // But we also add a hidden listener
  return (
    <div className="hidden">
      <button onClick={onClick} id="editor-save-btn" />
    </div>
  );
}
