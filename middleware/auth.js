function requireMember(req, res, next) {
  if (!req.session || !req.session.member) {
    return res.status(401).json({ error: "Please log in as a member to do this." });
  }
  next();
}

function requireLibrarian(req, res, next) {
  if (!req.session || !req.session.librarian) {
    return res.status(401).json({ error: "Please log in as a librarian to do this." });
  }
  next();
}

module.exports = { requireMember, requireLibrarian };