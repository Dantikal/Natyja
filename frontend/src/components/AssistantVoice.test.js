import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssistantVoice from './AssistantVoice';

afterEach(() => { delete window.SpeechRecognition; delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; });
test('microphone starts only after a click, text is reviewed before sending, reply is spoken and closing aborts capture', () => {
  let instance;
  window.SpeechRecognition = function () { instance = this; this.start = jest.fn(); this.stop = jest.fn(); this.abort = jest.fn(); };
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  window.speechSynthesis = { cancel: jest.fn(), getVoices: () => [], speak: jest.fn() };
  const send = jest.fn(), close = jest.fn();
  const props = { onSend: send, onClose: close, lastAnswer: 'Старый ответ', busy: false };
  const { rerender, unmount } = render(<AssistantVoice {...props} />);
  expect(instance).toBeUndefined();
  fireEvent.click(screen.getByText('Включить микрофон'));
  expect(instance.start).toHaveBeenCalledTimes(1);
  act(() => { instance.onresult({ results: [[{ transcript: 'Мой вопрос' }]] }); instance.onend(); });
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Отправить вопрос'));
  expect(send).toHaveBeenCalledWith('Мой вопрос');
  rerender(<AssistantVoice {...props} busy />);
  rerender(<AssistantVoice {...props} lastAnswer="Новый ответ" />);
  expect(window.speechSynthesis.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Новый ответ' }));
  fireEvent.keyDown(document, { key: 'Escape' }); expect(close).toHaveBeenCalled();
  unmount(); expect(instance.abort).toHaveBeenCalled();
});
test('unsupported browsers explain the fallback without requesting microphone access', () => {
  render(<AssistantVoice onClose={() => {}} />);
  expect(screen.getByText(/Этот браузер не поддерживает/)).toBeInTheDocument();
  expect(screen.getByText('Включить микрофон')).toBeDisabled();
});
