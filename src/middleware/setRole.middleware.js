export const setRole = (role) => (req, res, next) => {
  req.body.role = role;
  next();
};