type ResultMessageProps = {
  message: string
}

export const ResultMessage = (props: ResultMessageProps) => {
  return <p>{props.message}</p>
}
