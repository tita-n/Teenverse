import { Helmet } from "react-helmet-async";

export default function Titan() {
  return (
    <>
      <Helmet>
        <title>Titan | Teen Tech Founder of TeenVerse</title>
        <meta name="description" content="Titan (Restoration Michael), Nigerian teenage tech genius, founder of TeenVerse. Making waves from Lagos to the world." />
        <meta name="keywords" content="Titan, TeenVerse, Nigerian Tech Founder, Restoration Michael, Teen Tech CEO, Teen entrepreneur" />
        <meta name="author" content="Titan" />
        <meta property="og:title" content="Titan | Teen Tech Genius & Visionary" />
        <meta property="og:description" content="Restoration Michael aka Titan is a 14-year-old Nigerian tech prodigy and founder of TeenVerse, a social platform revolutionizing Gen Z interaction." />
        <meta property="og:image" content="https://i.postimg.cc/j2LxXtQh/Chat-GPT-Image-Apr-27-2025-08-41-04-PM.png" />
        <meta property="og:url" content="https://teenverse.onrender.com/titan" />
        <meta name="twitter:card" content="summary_large_image" />

        <script type="application/ld+json">
          {`
          {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": "Titan",
            "alternateName": "Restoration Michael",
            "birthDate": "2010-09-04",
            "description": "Teen tech founder of TeenVerse",
            "url": "https://teenverse.onrender.com/titan",
            "sameAs": [
              "mailto:restorationmichael3@gmail.com"
            ],
            "jobTitle": "Tech Founder",
            "nationality": "Nigerian"
          }
          `}
        </script>
      </Helmet>

      <main className="max-w-5xl mx-auto px-6 py-16 text-white bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <h1 className="text-4xl md:text-6xl font-extrabold text-center mb-8">Titan</h1>
        <p className="text-center text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-6 italic">“Changing the world one idea at a time.”</p>

        <div className="mt-12 space-y-10">
          <section>
            <h2 className="text-2xl font-bold mb-2">Who is Titan?</h2>
            <p>
              Titan, born Restoration Michael on September 4, 2010, is a Nigerian teenage tech genius, entrepreneur, and visionary.
              He’s the mind behind <strong>TeenVerse</strong> — a bold social platform built exclusively for teenagers, by a teenager.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-2">Known For</h2>
            <ul className="list-disc ml-6 space-y-2">
              <li>Founder & CEO of <strong>TeenVerse</strong> (2025)</li>
              <li>Started learning AI dev without knowing how to code — but mastered it through dedication.</li>
              <li>On a mission to dominate the tech space before turning 18.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-2">Personality</h2>
            <p>
              Titan is street-smart, sharp-witted, Lagos-bred, and globally minded.  
              He blends raw ambition with real emotions. He’s hyped, bold, and never backs down from a challenge.  
              He reps Nigeria proudly, speaks like a real Naija guy, and moves with the confidence of a CEO-in-the-making.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-2">Motto</h2>
            <p className="text-xl font-semibold text-green-400">“If they won’t give me the stage, I’ll build my own stadium.”</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-2">Contact</h2>
            <p>Email: <a href="mailto:restorationmichael3@gmail.com" className="text-blue-400">restorationmichael3@gmail.com</a></p>
          </section>
        </div>
      </main>
    </>
  );
}
