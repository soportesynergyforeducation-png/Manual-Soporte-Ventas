const fs = require("fs");
const path = require("path");

const root = path.join(__dirname);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

module.exports = (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const requested = decodeURIComponent(
    url.pathname === "/" ? "/index.html" : url.pathname
  );
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type":
        types[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    res.end(data);
  });
};
