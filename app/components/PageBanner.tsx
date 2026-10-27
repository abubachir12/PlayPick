export default function PageBanner({ title, text, image }: { title: string; text: string; image: string }) {
  return (
    <div className="page-banner">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="page-banner-image" />
      <div className="page-banner-shade" />
      <div className="page-banner-content">
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
