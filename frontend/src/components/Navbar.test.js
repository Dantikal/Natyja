import {render,screen,fireEvent} from '@testing-library/react';
import Navbar from './Navbar';
import {LanguageProvider} from '../context/LanguageContext';
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:{role:'commander'},logout:jest.fn()})}));
jest.mock('./Brand',()=>()=> <span>НАТЫЙЖА</span>);
jest.mock('react-router-dom',()=>({Link:({to,children,replace,state,...props})=><a href={to} {...props}>{children}</a>,useNavigate:()=>jest.fn(),useLocation:()=>({pathname:'/profile',search:'',hash:''})}));
test('mobile menu opens, closes with Escape, and closes after choosing a destination',()=>{
 localStorage.setItem('lang','ru');render(<LanguageProvider><Navbar/></LanguageProvider>);
 let toggle=screen.getByRole('button',{name:'Меню'});expect(toggle.getAttribute('aria-expanded')).toBe('false');
 fireEvent.click(toggle);toggle=screen.getByRole('button',{name:'Закрыть'});expect(toggle.getAttribute('aria-expanded')).toBe('true');
 fireEvent.keyDown(toggle,{key:'Escape'});expect(screen.getByRole('button',{name:'Меню'}).getAttribute('aria-expanded')).toBe('false');
 fireEvent.click(screen.getByRole('button',{name:'Меню'}));fireEvent.click(screen.getByRole('link',{name:'Мои задачи'}));expect(screen.getByRole('button',{name:'Меню'}).getAttribute('aria-expanded')).toBe('false');
});
