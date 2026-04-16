type LayoutProps = {
  children: unknown
}

export const Layout = (props: LayoutProps) => {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reading Log</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="stylesheet" href="/app.css" />
        <script src="https://unpkg.com/htmx.org@1.9.12"></script>
        <script defer src="https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js"></script>
        <script defer src="/barcode-scan.js"></script>
      </head>
      <body class="min-h-screen bg-gradient-to-br from-amber-50 via-stone-100 to-emerald-50 text-stone-800 antialiased [scrollbar-gutter:stable] [font-family:'Noto_Sans_JP','Hiragino_Kaku_Gothic_ProN','Yu_Gothic',sans-serif]">
        <div
          id="result-toast"
          aria-live="polite"
          aria-atomic="true"
          style="position: fixed; right: 1rem; bottom: 1rem; z-index: 60; width: min(28rem, calc(100vw - 2rem)); pointer-events: none;"
        ></div>
        <main class="mx-auto w-full max-w-3xl px-0 py-0 sm:px-6 sm:py-8 lg:py-10">
          <section class="w-full rounded-2xl border border-stone-200/70 bg-white/90 p-5 shadow-[0_12px_40px_-18px_rgba(41,37,36,0.55)] backdrop-blur sm:p-6">
            <h1 class="mb-2 text-3xl font-semibold tracking-tight text-stone-900">
              <a
                href="/"
                aria-label="ホームに戻る"
                title="ホームに戻る（検索条件をリセット）"
                class="inline-block rounded-md px-1 -mx-1 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                Reading Log
              </a>
            </h1>
            <p class="mb-6 text-sm text-stone-600">ISBN を入力して読書ログに登録します。</p>
            {props.children}
          </section>
        </main>
      </body>
    </html>
  )
}
