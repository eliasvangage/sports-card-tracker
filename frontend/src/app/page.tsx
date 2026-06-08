export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0f1218] text-white">
      <header className="border-b border-white/10 bg-[#111722]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#ff4d1c] text-lg font-black shadow-[0_0_24px_rgba(255,77,28,0.35)]">
              SC
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#ffb84d]">
                Vault Gallery
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-normal">
                Sports Card Showcase
              </h1>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 text-sm font-bold text-slate-200 sm:flex">
            <a className="rounded-md bg-white px-3 py-2 text-[#111722]" href="#">
              Gallery
            </a>
            <a className="rounded-md px-3 py-2 hover:bg-white/10" href="#">
              Collections
            </a>
            <a className="rounded-md px-3 py-2 hover:bg-white/10" href="#">
              Upload
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#18202d] p-6 shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#ff4d1c]" />
          <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-[#ff4d1c]/20" />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#ffb84d]">
                Private showroom
              </p>
              <h2 className="mt-3 max-w-3xl text-5xl font-black leading-tight tracking-normal sm:text-6xl">
                Build a game-day vault for your best cards.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Display your collection like a pro sports gallery with card
                walls, showcase sections, filters, and upload-ready spaces.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Showcase board
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <ScoreStat label="Cards" value="0" />
                <ScoreStat label="Sets" value="0" />
                <ScoreStat label="Mode" value="Draft" />
              </div>
              <button className="mt-4 h-11 w-full rounded-md bg-[#ff4d1c] text-sm font-black text-white shadow-[0_10px_30px_rgba(255,77,28,0.25)] transition hover:bg-[#ff6a3d]">
                Add first card
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-10 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-white/10 bg-[#151b26] p-4 shadow-xl">
          <div className="mb-5">
            <label
              className="mb-2 block text-sm font-bold text-slate-100"
              htmlFor="card-search"
            >
              Find a card
            </label>
            <input
              id="card-search"
              className="h-11 w-full rounded-md border border-white/10 bg-[#0f1218] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#ffb84d] focus:ring-2 focus:ring-[#ffb84d]/20"
              placeholder="Player, team, year..."
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-100">Sports</p>
            <FilterButton active label="All cards" />
            <FilterButton label="Basketball" />
            <FilterButton label="Baseball" />
            <FilterButton label="Football" />
            <FilterButton label="Hockey" />
          </div>

          <div className="mt-6 rounded-lg border border-[#ffb84d]/25 bg-[#ffb84d]/10 p-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffb84d]">
              Next step
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              Wire this layout to real uploaded cards once the gallery shell
              feels right.
            </p>
          </div>
        </aside>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ffb84d]">
                Display cases
              </p>
              <h3 className="mt-1 text-2xl font-black">Gallery floor</h3>
            </div>
            <div className="hidden rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-300 sm:block">
              Empty collection
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <GallerySlot label="Featured card" accent="bg-[#ff4d1c]" />
            <GallerySlot label="Rookie highlights" accent="bg-[#16a3ff]" />
            <GallerySlot label="Graded slabs" accent="bg-[#ffb84d]" />
            <GallerySlot label="Personal favorites" accent="bg-[#21c55d]" />
            <GallerySlot label="For trade" accent="bg-[#8b5cf6]" />
            <GallerySlot label="Recently added" accent="bg-[#ef3f6b]" />
          </div>
        </section>
      </section>
    </main>
  );
}

function ScoreStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0f1218] px-2 py-3">
      <p className="text-xl font-black leading-none text-white">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function FilterButton({
  active = false,
  label,
}: {
  active?: boolean;
  label: string;
}) {
  return (
    <button
      className={`w-full rounded-md px-3 py-2 text-left text-sm font-bold transition ${
        active
          ? "bg-[#ff4d1c] text-white"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function GallerySlot({ label, accent }: { label: string; accent: string }) {
  return (
    <article className="group rounded-xl border border-white/10 bg-[#151b26] p-4 shadow-xl transition hover:-translate-y-1 hover:border-white/20">
      <div className="aspect-[3/4] rounded-lg border border-white/10 bg-[#0f1218] p-4">
        <div className="flex h-full flex-col justify-between overflow-hidden rounded-md border border-white/10 bg-[#202939] p-4">
          <div className={`h-2 w-16 rounded-full ${accent}`} />
          <div className="grid place-items-center">
            <div className="relative h-40 w-28 rounded-lg border border-white/20 bg-[#0f1218] shadow-2xl">
              <div className={`absolute inset-x-3 top-3 h-14 rounded ${accent}`} />
              <div className="absolute inset-x-3 bottom-3 space-y-2">
                <div className="h-2 rounded bg-white/25" />
                <div className="h-2 w-2/3 rounded bg-white/15" />
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-black text-white">{label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Ready for a real card image
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-black text-white">{label}</p>
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-black text-slate-300">
          Empty
        </span>
      </div>
    </article>
  );
}
