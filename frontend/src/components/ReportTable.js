import { useState } from 'react';

// Утилита для генерации уникального ID
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ReportTable({ value, onChange, readOnly = false }) {
  // value = { columns: [{id, name}], rows: [{id, cells: {colId: text}}] }
  // Инициализация — если пусто, создаём 3 колонки и 3 строки
  const [table, setTable] = useState(() => {
    if (value && value.columns && value.rows) return value;
    return {
      columns: [
        { id: uid(), name: 'Показатель' },
        { id: uid(), name: 'Значение' },
        { id: uid(), name: 'Примечание' },
      ],
      rows: Array(3).fill(null).map(() => ({
        id: uid(),
        cells: {},
      })),
    };
  });

  function update(newTable) {
    setTable(newTable);
    if (onChange) onChange(newTable);
  }

  function setCell(rowId, colId, text) {
    const newRows = table.rows.map((r) =>
      r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: text } } : r
    );
    update({ ...table, rows: newRows });
  }

  function setColumnName(colId, name) {
    const newCols = table.columns.map((c) =>
      c.id === colId ? { ...c, name } : c
    );
    update({ ...table, columns: newCols });
  }

  function addRow() {
    update({
      ...table,
      rows: [...table.rows, { id: uid(), cells: {} }],
    });
  }

  function removeRow(rowId) {
    update({
      ...table,
      rows: table.rows.filter((r) => r.id !== rowId),
    });
  }

  function addColumn() {
    const newColId = uid();
    const newCols = [...table.columns, { id: newColId, name: 'Новая колонка' }];
    const newRows = table.rows.map((r) => ({
      ...r,
      cells: { ...r.cells, [newColId]: '' },
    }));
    update({ columns: newCols, rows: newRows });
  }

  function removeColumn(colId) {
    if (table.columns.length <= 1) return;
    update({
      columns: table.columns.filter((c) => c.id !== colId),
      rows: table.rows.map((r) => {
        const { [colId]: _, ...rest } = r.cells;
        return { ...r, cells: rest };
      }),
    });
  }

  return (
    <div className="report-table-wrap">
      <div className="report-table-toolbar">
        {!readOnly && (
          <>
            <button type="button" className="btn-small" onClick={addRow}>
              + Строка
            </button>
            <button type="button" className="btn-small" onClick={addColumn}>
              + Колонка
            </button>
          </>
        )}
      </div>

      <table className="report-table">
        <thead>
          <tr>
            {table.columns.map((col) => (
              <th key={col.id}>
                {readOnly ? (
                  col.name
                ) : (
                  <div className="col-header">
                    <input
                      value={col.name}
                      onChange={(e) => setColumnName(col.id, e.target.value)}
                      className="col-name-input"
                    />
                    {table.columns.length > 1 && (
                      <button
                        type="button"
                        className="col-remove"
                        onClick={() => removeColumn(col.id)}
                        title="Удалить колонку"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
              </th>
            ))}
            {!readOnly && <th className="row-actions-col"></th>}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {table.columns.map((col) => (
                <td key={col.id}>
                  {readOnly ? (
                    <div className="cell-text">{row.cells[col.id] || ''}</div>
                  ) : (
                    <input
                      value={row.cells[col.id] || ''}
                      onChange={(e) => setCell(row.id, col.id, e.target.value)}
                      className="cell-input"
                    />
                  )}
                </td>
              ))}
              {!readOnly && (
                <td className="row-actions-col">
                  <button
                    type="button"
                    className="row-remove"
                    onClick={() => removeRow(row.id)}
                    title="Удалить строку"
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {table.rows.length === 0 && (
        <p className="empty-hint">Нет строк. Нажмите «+ Строка» чтобы добавить.</p>
      )}
    </div>
  );
}