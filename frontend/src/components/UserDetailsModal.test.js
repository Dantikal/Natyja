import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../context/LanguageContext';
import api from '../api/axios';
import UserDetailsModal from './UserDetailsModal';
jest.mock('../api/axios', () => ({ get: jest.fn(), patch: jest.fn(), post: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, role: 'admin' } }) }));
jest.mock('react-router-dom', () => ({ Link: ({children,to,...props}) => <a href={to} {...props}>{children}</a> }));
const detail={ user:{id:2,full_name:'Тестовый пользователь',email:'test@example.invalid',role:'user',approved:1,soldier_id:2,reprimands:0,years_of_service:0},tasks:[],activity:{items:[],total:0,nextOffset:null}};
beforeEach(()=>{jest.clearAllMocks();localStorage.setItem('lang','ru');api.get.mockImplementation(url=>Promise.resolve({data:url==='/users/2'?detail:[]}));});
test('editing failure preserves the editable form and its error',async()=>{
 api.patch.mockRejectedValue({response:{data:{error:'Этот email уже зарегистрирован'}}});
 render(<LanguageProvider><UserDetailsModal userId={2} initialEdit onChanged={jest.fn()} onClose={jest.fn()}/></LanguageProvider>);
 await screen.findByDisplayValue('test@example.invalid');
 fireEvent.click(screen.getByRole('button',{name:'Сохранить изменения'}));
 await screen.findByRole('alert'); expect(screen.getByDisplayValue('test@example.invalid')).toBeTruthy();
});
test('password reset requires confirmation and displays only the returned temporary password',async()=>{
 api.post.mockResolvedValue({data:{temporaryPassword:'FixtureTemporary123'}});
 render(<LanguageProvider><UserDetailsModal userId={2} onChanged={jest.fn()} onClose={jest.fn()}/></LanguageProvider>);
 await screen.findByRole('button',{name:'Редактировать'});
 expect(screen.getAllByText('0').length).toBe(2);
 fireEvent.click(screen.getByRole('button',{name:'Действия'}));
 fireEvent.click(screen.getByRole('button',{name:'Сбросить пароль'})); expect(api.post).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Подтвердить'}));
 await waitFor(()=>expect(screen.getByDisplayValue('FixtureTemporary123')).toBeTruthy());
 expect(api.post).toHaveBeenCalledWith('/users/2/reset-password');
});
