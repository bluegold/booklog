export const BookForm = () => {
  return (
    <form hx-post="/books" hx-target="#result" hx-swap="innerHTML">
      <input name="isbn" placeholder="ISBN" />
      <button type="submit">登録</button>
    </form>
  )
}
