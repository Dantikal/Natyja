import {render,screen,fireEvent,act,waitFor,cleanup} from '@testing-library/react';
import {TaskNotifications,useTaskNotifications} from './TaskNotifications';
import api from '../api/axios';
const mockUser={id:22,email:'fixture@example.invalid'};
jest.mock('./AuthContext',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('./AppearanceContext',()=>({useAppearance:()=>({settings:{sound:true}})}));
jest.mock('./LanguageContext',()=>({useLang:()=>({tr:s=>s})}));
jest.mock('../api/axios',()=>({get:jest.fn(),post:jest.fn()}));
function Probe(){const {items,read}=useTaskNotifications();return <><output data-testid="count">{items.length}</output><button onClick={read}>read</button></>;}
afterEach(()=>{cleanup();jest.useRealTimers();delete window.AudioContext;});
test('new task updates badge, sounds after interaction once, and read submits only displayed IDs',async()=>{
 localStorage.clear();jest.useFakeTimers();
 const oscillator=()=>({connect:jest.fn(),frequency:{value:0},start:jest.fn(),stop:jest.fn()});
 const ctx={state:'running',currentTime:0,destination:{},resume:jest.fn().mockResolvedValue(),close:jest.fn().mockResolvedValue(),createOscillator:jest.fn(oscillator),createGain:()=>({connect:jest.fn(),gain:{setValueAtTime:jest.fn(),linearRampToValueAtTime:jest.fn(),exponentialRampToValueAtTime:jest.fn()}})};
 window.AudioContext=jest.fn(()=>ctx);api.get.mockResolvedValue({data:[]});api.post.mockResolvedValue({});
 render(<TaskNotifications><Probe/></TaskNotifications>);await act(async()=>{});
 fireEvent.pointerDown(document);await act(async()=>{});
 api.get.mockResolvedValue({data:[{id:8,title:'New task'}]});await act(async()=>{jest.advanceTimersByTime(15000);});
 expect(screen.getByTestId('count').textContent).toBe('1');expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
 await act(async()=>{jest.advanceTimersByTime(15000);});expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
 fireEvent.click(screen.getByText('read'));await waitFor(()=>expect(screen.getByTestId('count').textContent).toBe('0'));expect(api.post).toHaveBeenCalledWith('/tasks/notifications/read',{ids:[8]});
});

test('hidden tabs pause requests and resume immediately when visible',async()=>{
 jest.useFakeTimers();api.get.mockClear();api.get.mockResolvedValue({data:[]});
 const hidden=jest.spyOn(document,'hidden','get').mockReturnValue(true);
 try {
  render(<TaskNotifications><Probe/></TaskNotifications>);
  await act(async()=>{jest.advanceTimersByTime(45000);});
  expect(api.get).not.toHaveBeenCalled();
  hidden.mockReturnValue(false);
  await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));});
  expect(api.get).toHaveBeenCalledTimes(1);
 } finally { hidden.mockRestore(); }
});
