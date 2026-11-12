export const expandJournalColumns = (table, requestedCount = 0) => {
  if (table?.variant !== "combat-subject-journal") return table;
  const attendance = table.columns.filter((column) => /^attendance_\d+$/.test(column.key));
  const count = Math.max(attendance.length, Number(requestedCount) || 0);
  if (count === attendance.length || !attendance.length) return table;
  const last = attendance[attendance.length - 1];
  const start = Math.max(...attendance.map((column) => Number(column.key.split("_")[1])));
  const added = Array.from({ length: count - attendance.length }, (_, index) => ({
    ...last,
    key: `attendance_${start + index + 1}`,
    label: '202__ж."__"____',
  }));
  const columns = [...table.columns];
  columns.splice(columns.findIndex((column) => column.key === last.key) + 1, 0, ...added);
  const headerRows = table.headerRows.map((row, index) => {
    if (index === 0) return row.map((cell) => cell.key === "attendance_group"
      ? { ...cell, colSpan: Number(cell.colSpan) + added.length } : cell);
    const suffix = index === 1 ? "" : index === 2 ? "_hours" : "_date";
    return [...row, ...added.map((column) => ({
      key: `${column.key}${suffix}`,
      editableKey: `${column.key}${suffix}`,
      label: index === 1 ? column.label : "",
      defaultValue: index === 1 ? column.label : "",
    }))];
  });
  return { ...table, columns, headerRows };
};
