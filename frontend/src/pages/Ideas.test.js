import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import Ideas from './Ideas';
import api from '../api/axios';
jest.mock('../api/axios',()=>({get:jest.fn(),post:jest.fn(),patch:jest.fn()}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:1,role:'commander'}})}));
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:'ru'})}));
beforeEach(()=>{jest.clearAllMocks();api.get.mockResolvedValue({data:[]});api.post.mockResolvedValue({data:{id:1}});api.patch.mockResolvedValue({data:{points:10}});});
test('submits an idea without fabricating an AI score or awarding points',async()=>{
 render(<Ideas/>);await screen.findByText('Идей с таким статусом пока нет.');
 fireEvent.click(screen.getByText('＋ Подать идею'));
 fireEvent.change(screen.getByLabelText('Название'),{target:{value:'Чек-лист отчётов'}});
 const description='Проверить единый чек-лист на одном отчёте и сравнить количество ошибок.';
 fireEvent.change(screen.getByLabelText(/Какую проблему/),{target:{value:description}});
 fireEvent.click(screen.getByText('Отправить руководителю и на анализ ИИ'));
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/ideas',{title:'Чек-лист отчётов',description}));
 await screen.findByText(/Идея отправлена руководителю/);
 expect(screen.queryByText(/100$/)).not.toBeInTheDocument();
});
test('shows explainable AI assessment and sends only the human decision and justification',async()=>{
 api.get.mockResolvedValue({data:[{id:2,title:'Предложение',description:'Описание идеи',author_name:'Автор',created_at:'2026-11-03',status:'pending',canReview:true,ai_status:'ready',ai_score:80,ai_priority:'high',ai_analysis:{summary:'Проверить пилотом.',criteria:{usefulness:20},strengths:['Уменьшает ошибки'],concerns:['Нужен замер'],nextSteps:['Пилот']}}]});
 render(<Ideas/>);await screen.findByText('80/100');expect(screen.getByText('Приоритет: Высокий')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Решение'),{target:{value:'approved'}});
 fireEvent.change(screen.getByLabelText('Обоснование'),{target:{value:'Одобрено для пилота'}});
 fireEvent.click(screen.getByText('Сохранить решение'));
 await waitFor(()=>expect(api.patch).toHaveBeenCalledWith('/ideas/2/review',{decision:'approved',comment:'Одобрено для пилота'}));
});
