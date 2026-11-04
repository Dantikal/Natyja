const jwt = require('jsonwebtoken');
module.exports = function authSession(user) {
  const unitId = user.resolved_unit_id ?? user.unit_id;
  return {
    token: jwt.sign({ id: user.id, role: user.role, approved: user.approved, soldier_id: user.soldier_id, unit_id: unitId, tokenVersion: Number(user.token_version || 0) }, process.env.JWT_SECRET, { expiresIn: '24h' }),
    id: user.id, role: user.role, fullName: user.full_name, email: user.email,
    soldierId: user.soldier_id, unitId, mustChangePassword: Boolean(user.must_change_password),
  };
};
