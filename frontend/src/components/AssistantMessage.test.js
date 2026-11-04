import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssistantMessage from './AssistantMessage';

test('formats model output while keeping HTML and code inert', () => {
  const copy = jest.fn();
  const { container } = render(<AssistantMessage text={'# План\n\n- **Проверить** отчёт\n- `Статус`\n\n```html\n<img src=x onerror=alert(1)>\n```'} onCopy={copy} />);
  expect(screen.getByRole('heading', { name: 'План' })).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(container.querySelector('strong')).toHaveTextContent('Проверить');
  expect(container.querySelector('img')).toBeNull();
  fireEvent.click(screen.getByText('Копировать код'));
  expect(copy).toHaveBeenCalledWith('<img src=x onerror=alert(1)>');
});
