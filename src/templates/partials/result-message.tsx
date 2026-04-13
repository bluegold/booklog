type ResultMessageProps = {
  message: string
  tone?: 'success' | 'error'
}

export const ResultMessage = (props: ResultMessageProps) => {
  const toneClass =
    props.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  return <p class={`rounded-xl border px-4 py-3 text-sm font-medium ${toneClass}`}>{props.message}</p>
}
