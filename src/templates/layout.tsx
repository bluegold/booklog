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
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        <script src="https://unpkg.com/htmx.org@1.9.12"></script>
      </head>
      <body class="min-h-screen bg-gradient-to-br from-amber-50 via-stone-100 to-emerald-50 text-stone-800 antialiased [font-family:'Noto_Sans_JP','Hiragino_Kaku_Gothic_ProN','Yu_Gothic',sans-serif]">
        <main class="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-10">
          <section class="w-full rounded-2xl border border-stone-200/70 bg-white/90 p-6 shadow-[0_12px_40px_-18px_rgba(41,37,36,0.55)] backdrop-blur">
            <h1 class="mb-2 text-3xl font-semibold tracking-tight text-stone-900">Reading Log</h1>
            <p class="mb-6 text-sm text-stone-600">ISBN を入力して読書ログに登録します。</p>
            {props.children}
          </section>
        </main>
      </body>
    </html>
  )
}
