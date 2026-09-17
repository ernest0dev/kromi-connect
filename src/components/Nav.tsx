"use client";

export function Nav() {
  return (
    <nav className="nav">
      <div className="wrap">
        <div className="brand">
          <svg width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24.5,4.9c-.5-6.5-11.1-7.1-12.5,1.7-4.4-1-6.8,1.8-6.8,4.3s3.2,4.3,5.1,3.8v.2c0,.9.8,1.5,1.6,1.3l7-1.3c.6-.1,1.1-.7,1.1-1.3v-1.2c-1.3,0-2.3-.6-2.9-1.1-.3-.2,0-.7.3-.6,2,.3,3.3,0,4-.4,1.4-.6,3.3-2.1,3.1-5.4Z" fill="#0066D2"/>
            <path d="M33.9,17.6h-7.5c-.3,0-.5.1-.7.3l-5.3,7.1c-.2.2-.5.1-.5-.2v-6.6c0-.5-.5-1-1-.9l-6.9,1.2c-.4,0-.7.4-.7.9v19.6c0,.5.4.9.9.9h6.9c.5,0,.9-.4.9-.9v-5.1c0-.3.1-.6.3-.9h0c.4-.5,1.2-.6,1.7-.3,2.6,1.7,3.5,4.9,3.8,6.4s.5.8.9.8h7.4c.6,0,1-.5.9-1.1-.4-2.1-1.5-6.9-7-10.6-.2-.2-.3-.5-.1-.7l6.8-8.6c.5-.6,0-1.4-.7-1.4h-.1Z" fill="#F28D19"/>
          </svg>
          <span className="brand-name">
            kromi<span>connect</span>
          </span>
        </div>
        <div className="nav-links">
          <a href="#problema">El problema</a>
          <a href="#solucion">La solución</a>
          <a href="#sla">Automatización</a>
          <a href="#stack">Stack</a>
        </div>
        <a className="nav-cta" href="#contacto">
          Hablemos
        </a>
      </div>
    </nav>
  );
}
