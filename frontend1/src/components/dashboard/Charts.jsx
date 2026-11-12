import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartColors = ["#155e3b", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

export function PieMetricChart({ data }) {
  return (
    <ResponsiveContainer height={220} width="100%">
      <PieChart>
        <Pie
          cx="50%"
          cy="50%"
          data={data}
          dataKey="value"
          innerRadius={46}
          outerRadius={72}
          paddingAngle={3}
          nameKey="name"
        >
          {data.map((entry, index) => (
            <Cell fill={chartColors[index % chartColors.length]} key={entry.name} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BarMetricChart({ data, xKey, barKey, barName }) {
  return (
    <ResponsiveContainer height={220} width="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} />
        <YAxis allowDecimals={false} tickLine={false} />
        <Tooltip />
        <Bar dataKey={barKey} fill="#155e3b" name={barName} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineMetricChart({ data, xKey, lineKey, lineName }) {
  return (
    <ResponsiveContainer height={220} width="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} />
        <YAxis allowDecimals={false} tickLine={false} />
        <Tooltip />
        <Line
          activeDot={{ r: 6 }}
          dataKey={lineKey}
          name={lineName}
          stroke="#2563eb"
          strokeWidth={3}
          type="monotone"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
