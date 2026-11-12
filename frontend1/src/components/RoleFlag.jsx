import React from "react";

const shapes = {
  outpost: "M5 3 21 10 5 17Z",
  regional: "M5 5H22L17 13H5Z",
  admin: "M5 3C10 3 14 4 16 8C17 10 20 11 21 15C21.5 18 23 20 24 21C17 21 14 17 10 17C8 17 6.5 17.4 5 18Z",
};
export default function RoleFlag({ role }) {
  return <svg className="profile-role-flag" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={shapes[role] || shapes.outpost} fill="currentColor" strokeWidth="1" /><path d="M5 3V23" /></svg>;
}
