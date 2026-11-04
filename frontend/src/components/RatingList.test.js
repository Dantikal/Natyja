import {render,screen,fireEvent} from '@testing-library/react';
import {LanguageProvider} from '../context/LanguageContext';
import RatingList from './RatingList';
jest.mock('react-router-dom',()=>({Link:({to,children,...props})=><a href={to} {...props}>{children}</a>}));
test('rating starts compact and exposes personnel and period points only when expanded',()=>{
 localStorage.setItem('lang','ru');
 render(<LanguageProvider><RatingList soldiers={[{id:9,full_name:'Тестовый солдат',rank_name:'сержант',position_name:'Водитель',military_unit_name:'Часть 1',characteristic:'Подробная характеристика',task_rating:0,earned_points:1,penalty_points:1}]}/></LanguageProvider>);
 expect(screen.queryByText('Водитель')).toBeNull();expect(screen.queryByText('Подробная характеристика')).toBeNull();
 const button=screen.getByRole('button');expect(button.getAttribute('aria-expanded')).toBe('false');
 fireEvent.click(button);expect(screen.getByText('Водитель')).toBeTruthy();expect(screen.getByText('Подробная характеристика')).toBeTruthy();expect(screen.getByText('+1')).toBeTruthy();expect(screen.getByText('−1')).toBeTruthy();
 expect(screen.getByRole('link').getAttribute('href')).toBe('/soldier/9');
 fireEvent.click(button);expect(screen.queryByText('Подробная характеристика')).toBeNull();
});
