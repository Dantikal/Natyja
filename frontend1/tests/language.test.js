import test from "node:test";
import assert from "node:assert/strict";
import { translate } from "../src/translations.js";

test("interface labels translate in both directions", () => {
  assert.equal(translate("Кирүү", "ru"), "Войти");
  assert.equal(translate("Настройки сайта", "ky"), "Сайттын жөндөөлөрү");
  assert.equal(translate("Айдын талдоосу", "ru"), "Анализ за месяц");
});
test("counters and whitespace are preserved", () => {
  assert.equal(translate("Өтүнмөлөр (12)", "ru"), "Заявки (12)");
  assert.equal(translate("  Кирүү ", "ru"), "  Войти ");
});
test("unknown text and non-text values pass through", () => {
  assert.equal(translate("Документ пользователя №123", "ky"), "Документ пользователя №123");
  assert.equal(translate(null, "ru"), null);
  assert.equal(translate(42, "ky"), 42);
});
