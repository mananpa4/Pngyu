import Link from "next/link";

const categories = ["GIF maker", "Video tools", "Optimize", "Effects", "Split", "Add text", "WebP", "APNG"];
const tools = [
  ["Universal converter", "/convert"],
  ["GIF to WebM", "/gif-to-webm"],
  ["GIF to MP4", "/tools/gif-to-mp4"],
  ["GIF to MOV", "/tools/gif-to-mov"],
  ["Video to GIF", "/tools/video-to-gif"],
];

export function Header() {
  return (
    <header>
      <div className="topbar page-width">
        <Link className="brand" href="/" aria-label="Pngyu Tools home"><span>P</span>Pngyu Tools</Link>
        <nav className="categories" aria-label="Tool categories">
          {categories.map((category) => <a href="#tools" key={category}>{category}</a>)}
        </nav>
      </div>
      <nav className="subnav" aria-label="Animated conversion tools">
        <div className="page-width">{tools.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
      </nav>
    </header>
  );
}
