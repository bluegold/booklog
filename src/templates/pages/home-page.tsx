import { Layout } from '../layout.js'
import { BookForm } from '../partials/book-form.js'

export const HomePage = () => {
  return (
    <Layout>
      <div class="space-y-4">
        <BookForm />
        <div id="result" class="min-h-12"></div>
      </div>
    </Layout>
  )
}
