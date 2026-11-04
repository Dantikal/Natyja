import { useLang } from '../context/LanguageContext';
import { DownloadFile } from './FileUpload';

export default function TaskAttachment({ task }) {
  const { tr } = useLang();
  if (!task.task_file) return null;
  return <div className="task-attachment">
    <div><strong>{tr('Документ к задаче')}</strong><span>{task.task_file_name || task.task_file}</span></div>
    <DownloadFile taskId={task.id} filename={task.task_file_name || task.task_file} kind="task" />
  </div>;
}
