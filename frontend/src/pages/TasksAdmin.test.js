import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import TasksAdmin from './TasksAdmin';
import api from '../api/axios';
jest.mock('../api/axios',()=>({get:jest.fn(),patch:jest.fn()}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:99,role:'admin',soldierId:99}})}));
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:'ru',tr:text=>text})}));
jest.mock('../components/FileUpload',()=>()=>null);jest.mock('../components/WordEditor',()=>()=>null);jest.mock('../components/ExcelEditor',()=>()=>null);jest.mock('../components/TaskAttachment',()=>()=>null);jest.mock('../components/ReportEditorModal',()=>()=>null);
test('requires an explicit quality grade and sends 7 points for excellent work',async()=>{
 api.get.mockImplementation(url=>Promise.resolve({data:url==='/tasks'?[{id:3,title:'Отчёт',status:'на_проверке',soldier_id:1,soldier_name:'Автор',due_date:'2026-11-03',assignment_stage:'executor',report_type:'text',report_html:'<p>Отчёт</p>'}]:[]}));api.patch.mockResolvedValue({data:{}});
 render(<TasksAdmin/>);fireEvent.click(await screen.findByText('Проверить отчёт'));
 const accept=screen.getByRole('button',{name:'Принять задачу'});expect(accept).toBeDisabled();
 fireEvent.change(screen.getByLabelText(/Оценка выполнения/),{target:{value:'7'}});expect(accept).toBeEnabled();fireEvent.click(accept);
 await waitFor(()=>expect(api.patch).toHaveBeenCalledWith('/tasks/3/approve',{adminComment:'',qualityPoints:7}));
});
