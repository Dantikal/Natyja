import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {AppearanceProvider,useAppearance,normalizeAppearance} from './AppearanceContext';
function Probe(){const {settings,update,reset}=useAppearance();return <><output>{settings.theme}:{settings.brightness}</output><button onClick={()=>update({theme:'dark',brightness:82})}>night</button><button onClick={reset}>reset</button></>;}
beforeEach(()=>localStorage.removeItem('appearance'));
test('validates persisted settings and limits dimming to a readable range',()=>{expect(normalizeAppearance({theme:'invalid',brightness:0,textSize:'bad'})).toEqual(expect.objectContaining({theme:'system',brightness:70,textSize:'normal'}));expect(normalizeAppearance(null).theme).toBe('system');});
test('theme and brightness persist across reloads and can be reset',async()=>{
 render(<AppearanceProvider><Probe/></AppearanceProvider>);fireEvent.click(screen.getByText('night'));
 await waitFor(()=>expect(document.documentElement.dataset.theme).toBe('dark'));
 expect(JSON.parse(localStorage.getItem('appearance')).brightness).toBe(82);
 cleanup();render(<AppearanceProvider><Probe/></AppearanceProvider>);expect(screen.getByText('dark:82')).toBeTruthy();
 fireEvent.click(screen.getByText('reset'));await waitFor(()=>expect(screen.getByText('system:100')).toBeTruthy());
});
