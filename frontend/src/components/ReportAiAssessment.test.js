import {render,screen,fireEvent,waitFor} from '@testing-library/react';import '@testing-library/jest-dom';
import ReportAiAssessment from './ReportAiAssessment';import api from '../api/axios';
jest.mock('../api/axios',()=>({post:jest.fn()}));jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:'ru'})}));
test('shows provisional points with evidence and lets the author request review',async()=>{
 api.post.mockResolvedValue({data:{ok:true}});const refresh=jest.fn();
 render(<ReportAiAssessment submitted own taskId={1} onUpdated={refresh} review={{id:2,state:'ready',points:5,decision:'accept',analysis:{summary:'Нужно уточнение.',criteria:{clarity:{score:1,reason:'Не указан результат',quote:'Проведена проверка'}},improvements:['Указать результат']}}}/>);
 expect(screen.getByText('+5 баллов')).toBeInTheDocument();expect(screen.getByText(/Отдельно|отдельно/)).toBeInTheDocument();
 fireEvent.click(screen.getByText('Почему такая оценка'));expect(screen.getByText('Проведена проверка')).toBeInTheDocument();
 fireEvent.click(screen.getByText('Не согласен с оценкой'));fireEvent.change(screen.getByLabelText('Что оценено неправильно?'),{target:{value:'Результат указан в третьем разделе отчёта.'}});fireEvent.click(screen.getByText('Отправить руководителю'));
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/report-assessments/2/appeal',{text:'Результат указан в третьем разделе отчёта.'}));expect(refresh).toHaveBeenCalled();
});
test('does not display invented points when a file requires manual inspection',()=>{
 render(<ReportAiAssessment submitted taskId={1} review={{state:'needs_review',points:null,analysis:{summary:'Не удалось прочитать вложение.'}}}/>);
 expect(screen.getByText('Не удалось прочитать вложение.')).toBeInTheDocument();expect(screen.queryByText(/\+\d.*баллов/)).not.toBeInTheDocument();
});
