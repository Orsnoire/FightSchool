import { deferred } from './Deferred';
import type { MathEditorProps } from './MathEditorImpl';

export const MathEditor = deferred<MathEditorProps>(
  () => import('./MathEditorImpl').then(module => ({ default: module.MathEditor })),
  'the math editor',
);
