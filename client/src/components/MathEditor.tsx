import { useEffect, useRef } from 'react';
import 'mathlive';
import type { MathfieldElement } from 'mathlive';

interface MathEditorProps {
  value: string;
  onChange: (latex: string) => void;
  placeholder?: string;
  className?: string;
  containKeyboard?: boolean;
}

export function MathEditor({
  value,
  onChange,
  placeholder = 'Enter math expression...',
  className = '',
  containKeyboard = false,
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

    // Radix dialogs make body-level portals inert. Keep MathLive's keyboard
    // inside the combat dialog so its keys remain visible and clickable.
    const keyboard = window.mathVirtualKeyboard;
    const previousContainer = keyboard?.container;
    const keyboardHost = containKeyboard
      ? containerRef.current.closest('[role="dialog"]')?.querySelector<HTMLElement>('[data-math-keyboard-host]')
      : null;
    if (keyboard && keyboardHost) keyboard.container = keyboardHost;

    if (value) {
      mathfield.value = value;
    }

    return () => {
      if (keyboard && keyboardHost) {
        keyboard.hide();
        keyboard.container = previousContainer || document.body;
      }
      mathfield.removeEventListener('input', handleInput);
      mathfield.remove();
    };
  }, [className, containKeyboard]);

  useEffect(() => {
    if (mathfieldRef.current && value !== mathfieldRef.current.value) {
      mathfieldRef.current.value = value;
    }
  }, [value]);

  return <div ref={containerRef} />;
}
