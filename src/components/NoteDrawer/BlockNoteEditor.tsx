import { useEffect, useRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

interface BlockNoteEditorProps {
  nodeId: string | null;
  note: string;
  onSave: (content: string) => void;
}

const EMPTY_BLOCK = [{ type: 'paragraph', content: '' }] as const;

function parseNote(note: string) {
  if (!note) return EMPTY_BLOCK as unknown as Parameters<typeof editor.replaceBlocks>[1];
  try {
    return JSON.parse(note);
  } catch {
    return EMPTY_BLOCK as unknown as Parameters<typeof editor.replaceBlocks>[1];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNoteBlocks(note: string): any[] {
  if (!note) return [{ type: 'paragraph', content: '' }];
  try {
    return JSON.parse(note);
  } catch {
    return [{ type: 'paragraph', content: '' }];
  }
}

export function BlockNoteEditor({ nodeId, note, onSave }: BlockNoteEditorProps) {
  const isProgrammaticUpdate = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useCreateBlockNote({
    initialContent: parseNoteBlocks(note),
  });

  // nodeId가 바뀌면 해당 노드의 note로 에디터 내용 교체
  useEffect(() => {
    if (!editor) return;
    isProgrammaticUpdate.current = true;
    const blocks = parseNoteBlocks(note);
    editor.replaceBlocks(editor.document, blocks);
    // onChange가 동기적으로 발생할 수 있으므로 다음 tick에 플래그 해제
    setTimeout(() => {
      isProgrammaticUpdate.current = false;
    }, 0);
  // note가 아닌 nodeId 변경 시에만 에디터 내용을 교체 (외부 저장과 구분)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const handleChange = () => {
    if (isProgrammaticUpdate.current || !nodeId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const serialized = JSON.stringify(editor.document);
      onSave(serialized);
    }, 300);
  };

  return (
    <div className="h-full overflow-y-auto bn-container" data-color-scheme="dark">
      <BlockNoteView
        editor={editor}
        theme="dark"
        onChange={handleChange}
        style={{ minHeight: '100%' }}
      />
    </div>
  );
}
