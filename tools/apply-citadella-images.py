from pathlib import Path
import shutil
import sys

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
site = root / "site"
assets = Path(__file__).resolve().parent.parent / "assets/images/budapest"
dest = site / "assets/images/budapest"
assert dest.is_dir(), f"Not a VOY PRO site: {dest}"
expected = ["IMG-20261006-WA0091.jpg", "IMG-20261006-WA0089.jpg", "IMG-20261006-WA0092.jpg", "IMG-20261006-WA0093.jpg"]
missing = [name for name in expected if not (assets / name).is_file()]
assert not missing, f"Missing original photos: {missing}"
for source in assets.glob("IMG-20261006-WA*.jpg"):
    shutil.copy2(source, dest / source.name)

card = site / "budapest/index.html"
s = card.read_text(encoding="utf-8")
old = 'data-tour-image="citadella" style="--tour-card-image:url(\'/assets/images/budapest/img02.jpg\')"'
new = 'data-tour-image="citadella" style="--tour-card-image:url(\'/assets/images/budapest/IMG-20261006-WA0091.jpg\')"'
assert old in s or new in s, "Cannot find Citadella tour card"
card.write_text(s.replace(old, new), encoding="utf-8")

for lang in ["", "he/", "hu/"]:
    path = site / lang / "budapest/tours/citadella-advanced-ezraider-tour/index.html"
    s = path.read_text(encoding="utf-8")
    s = s.replace("https://voy-pro.com/assets/images/budapest/img12.jpg", "/assets/images/budapest/IMG-20261006-WA0091.jpg")
    gallery = '<section class="section citadella-gallery"><div class="wrap"><h2>Citadella · EZRaider views</h2><div class="citadella-gallery-grid">'
    for file, alt in [
        ("IMG-20261006-WA0091.jpg", "EZRaider riders above Budapest"),
        ("IMG-20261006-WA0089.jpg", "Liberty Statue at Citadella"),
        ("IMG-20261006-WA0092.jpg", "Sunset near Citadella"),
        ("IMG-20261006-WA0093.jpg", "Budapest panorama from Gellért Hill"),
    ]:
        gallery += f'<figure><img src="/assets/images/budapest/{file}" alt="{alt}" loading="lazy" decoding="async"/></figure>'
    gallery += "</div></div></section>"
    if 'class="citadella-gallery"' not in s:
        anchor = '<section class="section route-itinerary"'
        assert anchor in s, f"Missing route section: {path}"
        s = s.replace(anchor, gallery + anchor, 1)
    path.write_text(s, encoding="utf-8")

css = site / "assets/site.css"
s = css.read_text(encoding="utf-8")
style = """
/* Citadella route gallery */
.citadella-gallery-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.citadella-gallery-grid figure{margin:0;overflow:hidden;border-radius:16px;aspect-ratio:3/4;background:#e8eef1}
.citadella-gallery-grid img{width:100%;height:100%;object-fit:cover;display:block}
@media(max-width:760px){.citadella-gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
"""
if "/* Citadella route gallery */" not in s:
    css.write_text(s + style, encoding="utf-8")
print("Applied 4 Citadella photos to EN/HE/HU route pages and Budapest card.")
