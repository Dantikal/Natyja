import {render,screen} from '@testing-library/react';import '@testing-library/jest-dom';
import PointsSummary from './PointsSummary';import api from '../api/axios';
jest.mock('../api/axios',()=>({get:jest.fn()}));jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:'ru'})}));
test('shows five periods and separates task and idea awards from deductions',async()=>{
 api.get.mockResolvedValue({data:{periods:['week','1','3','6','12'].map(key=>({key,from:'2026-10-28',to:'2026-11-03',total:16,taskPoints:7,ideaPoints:10,penalties:1}))}});
 render(<PointsSummary/>);await screen.findByText('Неделя');expect(screen.getAllByText('16')).toHaveLength(5);expect(screen.getByText('Квартал')).toBeInTheDocument();expect(screen.getByText('Год')).toBeInTheDocument();expect(screen.getAllByText(/Задачи: \+7/)).toHaveLength(5);
});
