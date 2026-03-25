import { Helmet } from "react-helmet-async";

export default function Titan() {
  return (
    <>
      <Helmet>
        <title>Titan | Teen Tech Founder of TeenVerse</title>
        <meta name="description" content="Titan (Restoration Michael), Nigerian teenage tech genius, founder of TeenVerse." />
      </Helmet>

      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-4xl md:text-6xl font-extrabold text-center mb-4">Titan</h1>
          <p className="text-center text-lg text-gray-400 italic mb-12">"Changing the world one idea at a time."</p>

          <div className="space-y-10">
            <section>
              <h2 className="text-2xl font-bold mb-3">Who is Titan?</h2>
              <p className="text-gray-300 leading-relaxed">
                Titan, born Restoration Michael on September 4, 2010, is a Nigerian teenage tech genius and visionary.
                He's the mind behind <strong className="text-white">TeenVerse</strong> — a bold social platform built exclusively for teenagers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">Known For</h2>
              <ul className="list-disc ml-6 space-y-2 text-gray-300">
                <li>Founder & CEO of <strong className="text-white">TeenVerse</strong> (2025)</li>
                <li>Mastered AI development through dedication</li>
                <li>On a mission to dominate the tech space before turning 18</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">Motto</h2>
              <p className="text-xl font-semibold text-green-400">"If they won't give me the stage, I'll build my own stadium."</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">Contact</h2>
              <a href="mailto:restorationmichael3@gmail.com" className="text-blue-400 hover:underline">
                restorationmichael3@gmail.com
              </a>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
