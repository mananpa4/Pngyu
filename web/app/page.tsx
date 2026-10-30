import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="hero page-width"><div><div className="eyebrow">MEDIA UTILITIES, WITHOUT THE CLUTTER</div><h1>Any format.<br/><em>One workflow.</em></h1><p>Convert common images and videos into modern image, animation or video formats with clear controls and automatic cleanup.</p><Link className="primary-button" href="/convert">Open universal converter</Link></div><div className="hero-art" aria-hidden="true"><div className="frame a">Input</div><div className="connector">→</div><div className="frame b">Output</div></div></section>
      <section id="tools" className="page-width tools-section"><div className="section-heading"><div><div className="eyebrow">AVAILABLE NOW</div><h2>Universal media conversion</h2></div><p>One reusable FFmpeg pipeline for image-to-image, image-to-video, video-to-image and video-to-video conversion.</p></div><div className="tool-cards"><Link className="tool-card featured" href="/convert"><span>01</span><h3>Universal converter</h3><p>Choose from video, animated-image and still-image outputs.</p><b>Open tool →</b></Link>{["GIF to WebM","Video to GIF","WebP to MP4"].map((tool, i) => <Link className="tool-card" href="/convert" key={tool}><span>0{i+2}</span><h3>{tool}</h3><p>Handled by the same format-aware conversion pipeline.</p><b>Open converter →</b></Link>)}</div></section>
    </main>
  );
}
