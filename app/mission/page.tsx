"use client";

import Nav from "@/app/components/Nav";

export default function MissionPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center p-8">
      <div className="w-full max-w-3xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-gray-500 text-sm tracking-[0.3em]">ENKRATEIA</div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">Mission</h1>
          </div>
          <Nav className="justify-end" />
        </header>

        <section className="space-y-8 text-lg leading-relaxed text-gray-200">
          <div className="space-y-4">
            <p className="text-2xl md:text-3xl font-semibold text-white">
              Welcome to Enkrateia.
            </p>
            <p>
              Thank you for answering the call to join me on this journey towards a more
              disciplined life. Whatever your goals may be, it is my hope that this
              platform helps you achieve them.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/60">
            <p className="text-xl md:text-2xl font-semibold text-white whitespace-pre-line">
              What is measured is confronted.
              {"\n"}
              What is confronted is improved.
            </p>
          </div>

          <div className="text-gray-300">
            <div className="font-semibold text-white">-Jack Sommer</div>
            <div>@jack</div>
          </div>

          <div className="pt-4 border-t border-gray-800">
            <div className="text-sm uppercase tracking-[0.2em] text-gray-500">
              Foundations
            </div>
            <p className="mt-3 text-gray-300">
              Here are the words that inspired this platform:
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="text-2xl font-semibold text-white">
                Akrasia (ἀκρασία)
              </div>
              <div className="text-gray-300">
                <span className="text-gray-500">Literal meaning:</span>{" "}
                “Lack of control”
              </div>
              <div className="text-gray-300">
                <span className="text-gray-500">Breakdown:</span> a- (without) +
                kratos (power / rule)
              </div>
              <div className="text-gray-500 uppercase tracking-[0.2em] text-xs mt-3">
                Definition
              </div>
              <p>Acting against your better judgment because of weakness of will.</p>
            </div>

            <div className="space-y-2">
              <div className="text-2xl font-semibold text-white">
                Enkrateia (ἐγκράτεια)
              </div>
              <div className="text-gray-300">
                <span className="text-gray-500">Literal meaning:</span> “Power within”
                / “Self-mastery”
              </div>
              <div className="text-gray-300">
                <span className="text-gray-500">Breakdown:</span> en- (within) +
                kratos (power / rule)
              </div>
              <div className="text-gray-500 uppercase tracking-[0.2em] text-xs mt-3">
                Definition
              </div>
              <p>Self-control; the ability to act according to reason rather than impulse.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
