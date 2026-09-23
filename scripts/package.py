"""Build an offline HTML and an itch.io upload archive. No third-party packages."""
from pathlib import Path
import base64
import re
import zipfile
from urllib.parse import quote

root = Path(__file__).resolve().parent.parent
public = root / "public"
html = (public / "index.html").read_text()
css = (public / "style.css").read_text().replace("@import url('');\n", "")
parts = []
for filename in ("config.js", "core.js", "art.js", "terrain.js", "net.js", "peer.js", "room-code.js", "peer-code.js", "game.js", "mp.js"):
    source = (public / filename).read_text()
    source = re.sub(r"^import .+?;\s*$", "", source, flags=re.M)
    source = re.sub(r"^export ", "", source, flags=re.M)
    parts.append(source)
js = "\n".join(parts)
# Inline itch.io weapon sprites so the single file works offline.
for png in sorted((public / "assets" / "weapons").glob("*.png")):
    uri = "data:image/png;base64," + base64.b64encode(png.read_bytes()).decode()
    js = js.replace(f"assets/weapons/{png.name}", uri)
assert "assets/weapons/" not in js, "unresolved weapon sprite reference"
html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{css}</style>")
icon = quote((public / 'favicon.svg').read_text(), safe='')
html = html.replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">', f'<link rel="icon" href="data:image/svg+xml,{icon}" type="image/svg+xml">')
# Use a plain script so file:// needs neither module loading nor a local server.
html = html.replace('<script type="module" src="game.js"></script>', f'<script>\n(() => {{\n{js}\n}})();\n</script>')
(root / "play.html").write_text(html)
dist = root / "dist"
dist.mkdir(exist_ok=True)
(dist / "index.html").write_text(html)
with zipfile.ZipFile(dist / "sector-itch.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("index.html", html)
    archive.write(root / "ASSET_CREDITS.md", "ASSET_CREDITS.md")
with zipfile.ZipFile(dist / "sector-itch.zip") as archive:
    assert archive.testzip() is None
    assert "index.html" in archive.namelist()
assert '<script type="module"' not in html
assert 'src="game.js"' not in html
assert 'href="style.css"' not in html
assert not re.search(r"^import .+?;", js, re.M)
print(f"Offline game: {root / 'play.html'} ({len(html.encode()):,} bytes)")
print(f"itch.io archive: {dist / 'sector-itch.zip'}")
