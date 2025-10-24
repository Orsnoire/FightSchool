import { useEffect, useRef } from 'react';
import 'mathlive';
import type { MathfieldElement } from 'mathlive';

interface MathEditorProps {
  value: string;
  onChange: (latex: string) => void;
  placeholder?: string;
  className?: string;
}

export function MathEditor({
  value,
  onChange,
  placeholder = 'Enter math expression...',
  className = '',
}: MathEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mathfieldRef = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const mathfield = document.createElement('math-field') as MathfieldElement;
    mathfield.className = `w-full p-4 border border-border rounded-md bg-background ${className}`;
    mathfield.style.fontSize = '16px';
    mathfield.style.minHeight = '60px';
    mathfield.setAttribute('data-testid', 'math-editor');

    const handleInput = () => {
      onChange(mathfield.value);
    };

    mathfield.addEventListener('input', handleInput);
    containerRef.current.appendChild(mathfield);
    mathfieldRef.current = mathfield;

    if (value) {
      mathfield.value = value;
    }

    return () => {
      mathfield.removeEventListener('input', handleInput);
      mathfield.remove();
    };
  }, [className]);

  useEffect(() => {
    if (mathfieldRef.current && value !== mathfieldRef.current.value) {
      mathfieldRef.current.value = value;
    }
  }, [value]);

  return <div ref={containerRef} />;
}
