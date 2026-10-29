(function webpackUniversalModuleDefinition(root, factory) {

      if(typeof exports === 'object' && typeof module === 'object') {
          module.exports = factory(require("handsontable"));
      }else if(typeof define === 'function' && define.amd) {
          
          define(["handsontable"], factory);

          } else {
          var a = typeof exports === 'object' ? factory(require("handsontable")) : factory(root["Handsontable"]);

          for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];

      }

      })(typeof self !== 'undefined' ? self : this, (__rspack_external__1) => {
          return (() => {
"use strict";
var __webpack_modules__ = ({
1(module) {
module.exports = __rspack_external__1;

},

});
// The module cache
var __webpack_module_cache__ = {};

// The require function
function __webpack_require__(moduleId) {

// Check if module is in cache
var cachedModule = __webpack_module_cache__[moduleId];
if (cachedModule !== undefined) {
return cachedModule.exports;
}
// Create a new module (and put it into the cache)
var module = (__webpack_module_cache__[moduleId] = {
exports: {}
});
// Execute the module function
__webpack_modules__[moduleId](module, module.exports, __webpack_require__);

// Return the exports of the module
return module.exports;

}

// webpack/runtime/compat_get_default_export
(() => {
// getDefaultExport function for compatibility with non-ESM modules
__webpack_require__.n = (module) => {
	var getter = module && module.__esModule ?
		() => (module['default']) :
		() => (module);
	__webpack_require__.d(getter, { a: getter });
	return getter;
};

})();
// webpack/runtime/define_property_getters
(() => {
__webpack_require__.d = (exports, definition) => {
	for(var key in definition) {
        if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
            Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
        }
    }
};
})();
// webpack/runtime/has_own_property
(() => {
__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
})();
// webpack/runtime/make_namespace_object
(() => {
// define __esModule on exports
__webpack_require__.r = (exports) => {
	if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
	}
	Object.defineProperty(exports, '__esModule', { value: true });
};
})();
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (__rspack_default_export)
});
/* import */ var handsontable__rspack_import_0 = __webpack_require__(1);
/* import */ var handsontable__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(handsontable__rspack_import_0);
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
/**
 * @preserve
 * Authors: soakit, HChenZi
 * Last updated: Mar 09, 2023
 *
 * Description: Definition file for Chinese - China language-country.
 */ 
var C = (handsontable__rspack_import_0_default().languages.dictionaryKeys);
var _obj;
var dictionary = (_obj = {
    languageCode: 'zh-CN'
}, _define_property(_obj, C.OK, '确认'), _define_property(_obj, C.CANCEL, '取消'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ROW_ABOVE, '上方插入行'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ROW_BELOW, '下方插入行'), _define_property(_obj, C.CONTEXTMENU_ITEMS_INSERT_LEFT, '左方插入列'), _define_property(_obj, C.CONTEXTMENU_ITEMS_INSERT_RIGHT, '右方插入列'), _define_property(_obj, C.CONTEXTMENU_ITEMS_REMOVE_ROW, [
    '移除该行',
    '移除多行'
]), _define_property(_obj, C.CONTEXTMENU_ITEMS_REMOVE_COLUMN, [
    '移除该列',
    '移除多列'
]), _define_property(_obj, C.CONTEXTMENU_ITEMS_UNDO, '撤销'), _define_property(_obj, C.CONTEXTMENU_ITEMS_REDO, '恢复'), _define_property(_obj, C.CONTEXTMENU_ITEMS_READ_ONLY, '只读'), _define_property(_obj, C.CONTEXTMENU_ITEMS_CLEAR_COLUMN, '清空该列'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ALIGNMENT, '对齐'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ALIGNMENT_LEFT, '左对齐'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ALIGNMENT_CENTER, '水平居中'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ALIGNMENT_RIGHT, '右对齐'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ALIGNMENT_JUSTIFY, '两端对齐'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ALIGNMENT_TOP, '顶端对齐'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ALIGNMENT_MIDDLE, '垂直居中'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ALIGNMENT_BOTTOM, '底端对齐'), _define_property(_obj, C.CONTEXTMENU_ITEMS_FREEZE_COLUMN, '冻结该列'), _define_property(_obj, C.CONTEXTMENU_ITEMS_UNFREEZE_COLUMN, '取消冻结'), _define_property(_obj, C.CONTEXTMENU_ITEMS_BORDERS, '边框'), _define_property(_obj, C.CONTEXTMENU_ITEMS_BORDERS_TOP, '上'), _define_property(_obj, C.CONTEXTMENU_ITEMS_BORDERS_RIGHT, '右'), _define_property(_obj, C.CONTEXTMENU_ITEMS_BORDERS_BOTTOM, '下'), _define_property(_obj, C.CONTEXTMENU_ITEMS_BORDERS_LEFT, '左'), _define_property(_obj, C.CONTEXTMENU_ITEMS_REMOVE_BORDERS, '移除边框'), _define_property(_obj, C.CONTEXTMENU_ITEMS_ADD_COMMENT, '插入批注'), _define_property(_obj, C.CONTEXTMENU_ITEMS_EDIT_COMMENT, '编辑批注'), _define_property(_obj, C.CONTEXTMENU_ITEMS_REMOVE_COMMENT, '删除批注'), _define_property(_obj, C.CONTEXTMENU_ITEMS_READ_ONLY_COMMENT, '只读批注'), _define_property(_obj, C.CONTEXTMENU_ITEMS_MERGE_CELLS, '合并'), _define_property(_obj, C.CONTEXTMENU_ITEMS_UNMERGE_CELLS, '取消合并'), _define_property(_obj, C.CONTEXTMENU_ITEMS_COPY, '复制'), _define_property(_obj, C.CONTEXTMENU_ITEMS_COPY_WITH_COLUMN_HEADERS, '带标题的复制'), _define_property(_obj, C.CONTEXTMENU_ITEMS_COPY_WITH_COLUMN_GROUP_HEADERS, '带标题组的复制'), _define_property(_obj, C.CONTEXTMENU_ITEMS_COPY_COLUMN_HEADERS_ONLY, '仅复制标题'), _define_property(_obj, C.CONTEXTMENU_ITEMS_CUT, '剪切'), _define_property(_obj, C.CONTEXTMENU_ITEMS_EXPORT, '导出'), _define_property(_obj, C.CONTEXTMENU_ITEMS_EXPORT_FILE_CSV, '为 CSV'), _define_property(_obj, C.CONTEXTMENU_ITEMS_EXPORT_FILE_XLSX, '为 Excel'), _define_property(_obj, C.EXPORT_FILE_DIALOG_TITLE, '正在导出…'), _define_property(_obj, C.CONTEXTMENU_ITEMS_NESTED_ROWS_INSERT_CHILD, '插入子行'), _define_property(_obj, C.CONTEXTMENU_ITEMS_NESTED_ROWS_DETACH_CHILD, '与母行分离'), _define_property(_obj, C.CONTEXTMENU_ITEMS_HIDE_COLUMN, [
    '隐藏该列',
    '隐藏多列'
]), _define_property(_obj, C.CONTEXTMENU_ITEMS_SHOW_COLUMN, [
    '显示该列',
    '显示多列'
]), _define_property(_obj, C.CONTEXTMENU_ITEMS_HIDE_ROW, [
    '隐藏该行',
    '隐藏多行'
]), _define_property(_obj, C.CONTEXTMENU_ITEMS_SHOW_ROW, [
    '显示该行',
    '显示多行'
]), _define_property(_obj, C.FILTERS_CONDITIONS_NONE, '无'), _define_property(_obj, C.FILTERS_CONDITIONS_EMPTY, '为空'), _define_property(_obj, C.FILTERS_CONDITIONS_NOT_EMPTY, '不为空'), _define_property(_obj, C.FILTERS_CONDITIONS_EQUAL, '等于'), _define_property(_obj, C.FILTERS_CONDITIONS_NOT_EQUAL, '不等于'), _define_property(_obj, C.FILTERS_CONDITIONS_BEGINS_WITH, '开头是'), _define_property(_obj, C.FILTERS_CONDITIONS_ENDS_WITH, '结尾是'), _define_property(_obj, C.FILTERS_CONDITIONS_CONTAINS, '包含'), _define_property(_obj, C.FILTERS_CONDITIONS_NOT_CONTAIN, '不包含'), _define_property(_obj, C.FILTERS_CONDITIONS_GREATER_THAN, '大于'), _define_property(_obj, C.FILTERS_CONDITIONS_GREATER_THAN_OR_EQUAL, '大于或等于'), _define_property(_obj, C.FILTERS_CONDITIONS_LESS_THAN, '小于'), _define_property(_obj, C.FILTERS_CONDITIONS_LESS_THAN_OR_EQUAL, '小于或等于'), _define_property(_obj, C.FILTERS_CONDITIONS_BETWEEN, '在此范围'), _define_property(_obj, C.FILTERS_CONDITIONS_NOT_BETWEEN, '不在此范围'), _define_property(_obj, C.FILTERS_CONDITIONS_AFTER, '之后'), _define_property(_obj, C.FILTERS_CONDITIONS_AFTER_OR_EQUAL, '之后或等于'), _define_property(_obj, C.FILTERS_CONDITIONS_BEFORE, '之前'), _define_property(_obj, C.FILTERS_CONDITIONS_BEFORE_OR_EQUAL, '之前或等于'), _define_property(_obj, C.FILTERS_CONDITIONS_TODAY, '今天'), _define_property(_obj, C.FILTERS_CONDITIONS_TOMORROW, '明天'), _define_property(_obj, C.FILTERS_CONDITIONS_YESTERDAY, '昨天'), _define_property(_obj, C.FILTERS_VALUES_BLANK_CELLS, '空白单元格'), _define_property(_obj, C.FILTERS_DIVS_FILTER_BY_CONDITION, '按条件过滤'), _define_property(_obj, C.FILTERS_DIVS_FILTER_BY_VALUE, '按值过滤'), _define_property(_obj, C.FILTERS_LABELS_CONJUNCTION, '且'), _define_property(_obj, C.FILTERS_LABELS_DISJUNCTION, '或'), _define_property(_obj, C.FILTERS_BUTTONS_SELECT_ALL, '全选'), _define_property(_obj, C.FILTERS_BUTTONS_CLEAR, '清除'), _define_property(_obj, C.FILTERS_BUTTONS_OK, '确认'), _define_property(_obj, C.FILTERS_BUTTONS_CANCEL, '取消'), _define_property(_obj, C.FILTERS_BUTTONS_PLACEHOLDER_SEARCH, '搜索'), _define_property(_obj, C.FILTERS_BUTTONS_PLACEHOLDER_VALUE, '值'), _define_property(_obj, C.FILTERS_BUTTONS_PLACEHOLDER_SECOND_VALUE, '第二值'), _define_property(_obj, C.PAGINATION_SECTION, '分页'), _define_property(_obj, C.PAGINATION_PAGE_SIZE_SECTION, '每页行数'), _define_property(_obj, C.PAGINATION_PAGE_SIZE_AUTO, '自动'), _define_property(_obj, C.PAGINATION_COUNTER_SECTION, '[start] - [end] 共 [total]'), _define_property(_obj, C.PAGINATION_NAV_SECTION, '第 [currentPage] 页，共 [totalPages] 页'), _define_property(_obj, C.PAGINATION_FIRST_PAGE, '转到第一页'), _define_property(_obj, C.PAGINATION_PREV_PAGE, '转到上一页'), _define_property(_obj, C.PAGINATION_NEXT_PAGE, '转到下一页'), _define_property(_obj, C.PAGINATION_LAST_PAGE, '转到最后一页'), _define_property(_obj, C.LOADING_TITLE, '加载中...'), _define_property(_obj, C.NOTIFICATION_BUTTONS_CLOSE, '关闭'), _define_property(_obj, C.EMPTY_DATA_STATE_TITLE, '暂无数据'), _define_property(_obj, C.EMPTY_DATA_STATE_DESCRIPTION, '暂无内容可显示。'), _define_property(_obj, C.EMPTY_DATA_STATE_TITLE_FILTERS, '未找到结果'), _define_property(_obj, C.EMPTY_DATA_STATE_DESCRIPTION_FILTERS, '看起来您当前的过滤器隐藏了所有结果。'), _define_property(_obj, C.EMPTY_DATA_STATE_BUTTONS_FILTERS_RESET, '重置过滤器'), _define_property(_obj, C.EMPTY_DATA_STATE_TITLE_LOADING, '正在加载数据'), _define_property(_obj, C.EMPTY_DATA_STATE_DESCRIPTION_LOADING, '请稍候。'), _define_property(_obj, C.DATA_PROVIDER_ERRORS_FETCH, '无法加载数据'), _define_property(_obj, C.DATA_PROVIDER_ERRORS_CREATE, '无法创建行'), _define_property(_obj, C.DATA_PROVIDER_ERRORS_UPDATE, '无法更新行'), _define_property(_obj, C.DATA_PROVIDER_ERRORS_REMOVE, '无法删除行'), _define_property(_obj, C.DATA_PROVIDER_ERRORS_REQUEST_FAILED, '请求失败'), _define_property(_obj, C.DATA_PROVIDER_BUTTONS_REFETCH, '重新加载'), _obj);
handsontable__rspack_import_0_default().languages.registerLanguageDictionary(dictionary);
/* export default */ const __rspack_default_export = (dictionary);

})();

__webpack_exports__ = __webpack_exports__.___;return __webpack_exports__;
})()

});