import { lazy, Suspense } from 'react';
import { useLang } from '../context/LanguageContext';

const Word = lazy(() => import('./WordEditor'));
const Excel = lazy(() => import('./ExcelEditor'));

function LoadingEditor() {
  const { tr } = useLang();
  return <p role="status">{tr('Загрузка...')}</p>;
}

export function WordEditor(props) {
  return <Suspense fallback={<LoadingEditor />}><Word {...props} /></Suspense>;
}

export function ExcelEditor(props) {
  return <Suspense fallback={<LoadingEditor />}><Excel {...props} /></Suspense>;
}
