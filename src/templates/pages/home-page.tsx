import { Layout } from '../layout.js'
import { BookForm } from '../partials/book-form.js'

export const HomePage = () => {
  return (
    <Layout>
      <BookForm />
      <div id="result"></div>
    </Layout>
  )
}
