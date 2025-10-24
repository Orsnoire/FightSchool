import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image as ImageIcon,
  FunctionSquare,
} from 'lucide-react';
import { useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import 'katex/dist/katex.min.css';
import { renderToString } from 'katex';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<string>;
  className?: string;
  compact?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Enter text...',
  onImageUpload,
  className = '',
  compact = false,
}: RichTextEditorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Image,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[80px] p-3',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImageUpload) return;

    try {
      const url = await onImageUpload(file);
      editor?.chain().focus().setImage({ src: url }).run();
      toast({ title: 'Image uploaded successfully' });
    } catch (error) {
      toast({
        title: 'Failed to upload image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMathInput = async () => {
    const latex = prompt('Enter LaTeX formula (e.g., x^2 + y^2 = z^2):');
    if (latex && editor) {
      try {
        const mathHtml = `<span class="math-inline" data-latex="${latex.replace(/"/g, '&quot;')}">${renderToString(latex, { throwOnError: false })}</span>`;
        editor.chain().focus().insertContent(mathHtml).run();
      } catch (error) {
        toast({
          title: 'Invalid LaTeX',
          description: 'Please check your formula syntax',
          variant: 'destructive',
        });
      }
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className={`border border-border rounded-md bg-background ${className}`}>
      <div className={`flex flex-wrap items-center gap-1 p-2 border-b border-border ${compact ? 'gap-0.5' : 'gap-1'}`}>
        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-accent' : ''}
          data-testid="button-bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-accent' : ''}
          data-testid="button-italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'bg-accent' : ''}
          data-testid="button-underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={editor.isActive({ textAlign: 'left' }) ? 'bg-accent' : ''}
          data-testid="button-align-left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={editor.isActive({ textAlign: 'center' }) ? 'bg-accent' : ''}
          data-testid="button-align-center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={editor.isActive({ textAlign: 'right' }) ? 'bg-accent' : ''}
          data-testid="button-align-right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={editor.isActive({ textAlign: 'justify' }) ? 'bg-accent' : ''}
          data-testid="button-align-justify"
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        {onImageUpload && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              data-testid="input-image-upload"
            />
            <Button
              type="button"
              variant="ghost"
              size={compact ? 'sm' : 'icon'}
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-image"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </>
        )}

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          onClick={handleMathInput}
          data-testid="button-insert-math"
        >
          <FunctionSquare className="h-4 w-4" />
        </Button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
