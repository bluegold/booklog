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
        <script src="https://unpkg.com/htmx.org@1.9.12"></script>
      </head>
      <body>
        <h1>Reading Log</h1>
        {props.children}
      </body>
    </html>
  )
}
